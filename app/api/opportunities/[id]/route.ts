import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'
import { recomputeOpportunityWindow } from '@/lib/db/recompute'
import type { LineOfBusiness } from '@prisma/client'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const { id: opportunityId } = await params
  const body = await req.json() as {
    preContractAgreed?: boolean; status?: string; projectCodeProceed?: boolean
    businessUnit?: string | null; starConnect?: boolean
    startDate?: string; endDate?: string
  }

  const opp = await prisma.opportunity.findUnique({ where: { opportunityId } })
  if (!opp) return apiError('OPP_NOT_FOUND')

  // Owner-or-admin gate for the editable detail fields (BU / Star Connect / dates).
  const editsDetails =
    body.businessUnit !== undefined || typeof body.starConnect === 'boolean' ||
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
  const simpleData: { businessUnit?: string | null; starConnect?: boolean } = {}
  if (body.businessUnit !== undefined) simpleData.businessUnit = (body.businessUnit ?? '').toString().trim() || null
  if (typeof body.starConnect === 'boolean') simpleData.starConnect = body.starConnect
  if (Object.keys(simpleData).length > 0) {
    await prisma.opportunity.update({ where: { id: opp.id }, data: simpleData })
  }

  // Start / End date — heavy path: trims out-of-window weeks across all versions,
  // recomputes metrics + SoP + snapshots + primaryLob, and rolls the stage back
  // to PRICE_LINKED. Blocked while an approval is actively in progress.
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
        const { primaryLob } = await recomputeOpportunityWindow(tx, opp.id, newStart, newEnd)
        const rollback = ['SOW_PENDING', 'SOW_SUBMITTED', 'TO_BE_ARCHIVED'].includes(opp.stage)
        if (rollback || primaryLob) {
          await tx.opportunity.update({
            where: { id: opp.id },
            data: {
              ...(rollback ? { stage: 'PRICE_LINKED' as const } : {}),
              ...(primaryLob ? { primaryLob: primaryLob as LineOfBusiness } : {}),
            },
          })
        }
      }, { timeout: 30_000 })
    }
  }

  const updated = await prisma.opportunity.findUnique({
    where:  { id: opp.id },
    select: {
      status: true, preContractAgreed: true, stage: true, projectCodeProceed: true,
      businessUnit: true, starConnect: true, startDate: true, endDate: true, primaryLob: true,
    },
  })

  return NextResponse.json(updated)
}
