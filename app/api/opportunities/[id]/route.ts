// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/opportunities/[id] — the multi-purpose opportunity update.
//
// Big picture: one endpoint handles several distinct edits, each its own branch:
// preContractAgreed (drives SOW_PENDING ↔ SOW_SUBMITTED), status (manual OPEN/WON/
// LOST/ABANDONED), projectCodeProceed (permanent commit), BU/Star-Connect cells, and
// start/end dates. Changing dates invalidates pricing, so that branch runs
// resetOpportunityPricing inside a $transaction and rolls the stage back.
//
// RISK (high): only the BU/Star-Connect/dates branch is owner/admin-gated. status,
// preContractAgreed and the IRREVERSIBLE projectCodeProceed are reachable by ANY
// authenticated user on ANY opportunity. Move the ownership gate above all branches.
// (See audit S6.)
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'
import { resetOpportunityPricing } from '@/lib/db/recompute'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const { id: opportunityId } = await params
  const body = await req.json() as {
    preContractAgreed?: boolean; status?: string; projectCodeProceed?: boolean
    businessUnit?: string | null; starConnect?: boolean; workType?: string | null
    startDate?: string; endDate?: string
  }

  const opp = await prisma.opportunity.findUnique({ where: { opportunityId } })
  if (!opp) return apiError('OPP_NOT_FOUND')

  // Owner-or-admin gate for the editable detail fields (BU / Star Connect / dates).
  const editsDetails =
    body.businessUnit !== undefined || typeof body.starConnect === 'boolean' ||
    body.workType !== undefined ||
    body.startDate !== undefined || body.endDate !== undefined
  if (editsDetails) {
    const isOwner = opp.ownerId === (token.id as string)
    const isAdmin = (token.role as string) === 'ADMIN'
    if (!isOwner && !isAdmin) return apiError('OPP_EDIT_FORBIDDEN')
  }

  if (typeof body.preContractAgreed === 'boolean') {
    await prisma.opportunity.update({
      where: { id: opp.id },
      data:  { preContractAgreed: body.preContractAgreed },
    })

    if (body.preContractAgreed && opp.stage === 'SOW_PENDING') {
      await prisma.opportunity.update({ where: { id: opp.id }, data: { stage: 'SOW_SUBMITTED' } })
    } else if (!body.preContractAgreed && opp.stage === 'SOW_SUBMITTED') {
      const [sowCount, poCount] = await Promise.all([
        prisma.sOWDocument.count({ where: { opportunityId: opp.id, isActive: true } }),
        prisma.pODocument.count({ where: { opportunityId: opp.id, isActive: true } }),
      ])
      if (sowCount === 0 && poCount === 0) {
        await prisma.opportunity.update({ where: { id: opp.id }, data: { stage: 'SOW_PENDING' } })
      }
    }
  }

  if (
    body.status === 'OPEN' ||
    body.status === 'WON' ||
    body.status === 'LOST' ||
    body.status === 'ABANDONED'
  ) {
    await prisma.opportunity.update({
      where: { id: opp.id },
      data:  { status: body.status as 'OPEN' | 'WON' | 'LOST' | 'ABANDONED' },
    })
  }

  if (body.projectCodeProceed === true) {
    await prisma.opportunity.update({
      where: { id: opp.id },
      data:  { projectCodeProceed: true },
    })
  }

  // Business Unit / Star Connect — simple in-place cell updates.
  const simpleData: { businessUnit?: string | null; starConnect?: boolean; workType?: string | null } = {}
  if (body.businessUnit !== undefined) simpleData.businessUnit = (body.businessUnit ?? '').toString().trim() || null
  if (typeof body.starConnect === 'boolean') simpleData.starConnect = body.starConnect
  if (body.workType !== undefined) simpleData.workType = (body.workType ?? '').toString().trim() || null
  if ((body as any).coOwnerId !== undefined) (simpleData as any).coOwnerId = (body as any).coOwnerId || null
  if ((body as any).sharepointUrl !== undefined) (simpleData as any).sharepointUrl = (body as any).sharepointUrl?.trim() || null
  if (Object.keys(simpleData).length > 0) {
    await prisma.opportunity.update({ where: { id: opp.id }, data: simpleData })
  }

  // Start / End date — changing the window invalidates the existing pricing, so
  // we reset it (clear hours + metrics + derived rows) and roll the stage back to
  // PRICE_LINKED; the owner re-enters efforts and re-requests approval. Blocked
  // while an approval is actively in progress.
  if (body.startDate !== undefined || body.endDate !== undefined) {
    const newStart = body.startDate ? new Date(body.startDate) : opp.startDate
    const newEnd   = body.endDate   ? new Date(body.endDate)   : opp.endDate
    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime()) || newEnd < newStart) {
      return apiError('OPP_DATE_INVALID')
    }
    const changed =
      newStart.getTime() !== opp.startDate.getTime() ||
      newEnd.getTime()   !== opp.endDate.getTime()
    if (changed) {
      if (opp.stage === 'APPROVAL_PENDING' || opp.stage === 'SOW_REVIEW_PENDING') {
        return apiError('OPP_DATE_LOCKED')
      }
      await prisma.$transaction(async (tx) => {
        await tx.opportunity.update({
          where: { id: opp.id },
          data:  { startDate: newStart, endDate: newEnd },
        })
        await resetOpportunityPricing(tx, opp.id)
        if (['SOW_PENDING', 'SOW_SUBMITTED', 'TO_BE_ARCHIVED'].includes(opp.stage)) {
          await tx.opportunity.update({ where: { id: opp.id }, data: { stage: 'PRICE_LINKED' } })
        }
      }, { timeout: 30_000 })
    }
  }

  const updated = await prisma.opportunity.findUnique({
    where:  { id: opp.id },
    select: {
      status: true, preContractAgreed: true, stage: true, projectCodeProceed: true,
      businessUnit: true, starConnect: true, startDate: true, endDate: true, primaryLob: true, workType: true, sharepointUrl: true,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const { id: opportunityId } = await params
  const opp = await prisma.opportunity.findUnique({ where: { opportunityId } })
  if (!opp) return apiError('OPP_NOT_FOUND')

  const isOwner = opp.ownerId === (token.id as string)
  const isAdmin = (token.role as string) === 'ADMIN'
  if (!isOwner && !isAdmin) return apiError('OPP_EDIT_FORBIDDEN')

  await prisma.opportunity.update({ where: { id: opp.id }, data: { isActive: false } })

  return NextResponse.json({ ok: true })
}
