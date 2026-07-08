import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { mailApprovalRequested, mailApprovalApproved, type ApprovalMailContext } from '@/lib/mail'
import { apiError } from '@/lib/errors'

// Mirrors the same function in app/api/opportunities/[id]/approvals/route.ts
function computeContext(
  staffing: {
    isActive: boolean; isBillable: boolean; location: string
    effectiveBillRate: unknown; systemBillRatePerHour: unknown; costRatePerHour: unknown
    weeklyHours: { hours: unknown }[]
  }[],
  otherCosts: { amount: unknown; isBillable: boolean; markupPct: unknown }[],
  startDate: Date | null,
  endDate:   Date | null,
): ApprovalMailContext {
  const n = (v: unknown) => Number(v ?? 0)
  let a1 = 0, recRev = 0, b = 0, f1 = 0, f2 = 0, indiaHrs = 0
  for (const row of staffing.filter(r => r.isActive)) {
    const hours = row.weeklyHours.reduce((s, wh) => s + n(wh.hours), 0)
    b += hours * n(row.costRatePerHour)
    if (row.isBillable) {
      const effRate = n(row.effectiveBillRate) || n(row.systemBillRatePerHour)
      a1     += hours * effRate
      recRev += hours * n(row.systemBillRatePerHour)
      f1     += hours
      if (row.location === 'INDIA') indiaHrs += hours
    } else {
      f2 += hours
    }
  }
  const a2 = otherCosts.filter(oc => oc.isBillable)
    .reduce((s, oc) => s + n(oc.amount) * (1 + n(oc.markupPct) / 100), 0)
  const c  = otherCosts.reduce((s, oc) => s + n(oc.amount), 0)
  const a  = a1 + a2
  const d  = a - b - c
  const f  = f1 + f2
  return {
    startDate: startDate?.toISOString().slice(0, 10) ?? null,
    endDate:   endDate?.toISOString().slice(0, 10) ?? null,
    a, d,
    dPct: a > 0 ? (d / a) * 100 : 0,
    ePct: recRev > 0 ? (a1 / recRev - 1) * 100 : 0,
    f,
    g: f > 0 ? (indiaHrs / f) * 100 : 0,
    h: f > 0 ? a1 / f : 0,
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const { id } = await params
  const userId  = token.id as string
  const isAdmin = (token.role as string | undefined) === 'ADMIN'

  const approval = await prisma.approvalRequest.findUnique({
    where:   { id },
    include: {
      requestedBy: { select: { name: true, email: true } },
      approver:    { select: { name: true, email: true } },
      approver2:   { select: { name: true, email: true } },
      opportunity: { select: { id: true, opportunityId: true, opportunityName: true, startDate: true, endDate: true, client: { select: { name: true } } } },
    },
  })
  if (!approval) return apiError('APPROVAL_NOT_FOUND')

  const isApprover1 = userId === approval.approverId
  const isApprover2 = !!approval.approverId2 && userId === approval.approverId2
  if (!isAdmin && !isApprover1 && !isApprover2) return apiError('APPROVAL_WRONG_USER')

  const isDual = !!approval.approverId2

  if (isApprover2) {
    if (approval.approver2Status === null) {
      return NextResponse.json(
        { error: 'Approver 1 (Finance) has not yet approved. Please wait.' },
        { status: 403 }
      )
    }
    if (approval.approver2Status !== 'PENDING') return apiError('APPROVAL_TOKEN_USED')

    const updated = await prisma.approvalRequest.update({
      where: { id },
      data:  { status: 'APPROVED', approver2Status: 'APPROVED', decidedAt: new Date() },
    })

    let newStage: 'TO_BE_ARCHIVED' | 'SOW_PENDING'
    if (approval.approvalType === 'SOW_VERIFICATION') {
      newStage = 'TO_BE_ARCHIVED'
    } else {
      const sowApproved = await prisma.approvalRequest.findFirst({
        where:  { opportunityId: approval.opportunityId, approvalType: 'SOW_VERIFICATION', status: 'APPROVED' },
        select: { id: true },
      })
      newStage = sowApproved ? 'TO_BE_ARCHIVED' : 'SOW_PENDING'
    }
    await prisma.opportunity.update({ where: { id: approval.opportunityId }, data: { stage: newStage } })

    await mailApprovalApproved({
      requesterEmail:   approval.requestedBy.email,
      requesterName:    approval.requestedBy.name,
      approverEmail:    approval.approver.email,
      approverName:     approval.approver.name,
      opportunityId:    approval.opportunity.opportunityId,
      opportunityName:  approval.opportunity.opportunityName,
      clientName:       approval.opportunity.client?.name ?? '',
      approvalType:     approval.approvalType,
    })

    return NextResponse.json(updated)
  }

  // ── Approver 1 (or single-approval) path ──────────────────────────────────
  if (approval.status !== 'PENDING') return apiError('APPROVAL_TOKEN_USED')

  if (!isDual) {
    const updated = await prisma.approvalRequest.update({
      where: { id },
      data:  { status: 'APPROVED', decidedAt: new Date() },
    })

    let newStage: 'TO_BE_ARCHIVED' | 'SOW_PENDING'
    if (approval.approvalType === 'SOW_VERIFICATION') {
      newStage = 'TO_BE_ARCHIVED'
    } else {
      const sowApproved = await prisma.approvalRequest.findFirst({
        where:  { opportunityId: approval.opportunityId, approvalType: 'SOW_VERIFICATION', status: 'APPROVED' },
        select: { id: true },
      })
      newStage = sowApproved ? 'TO_BE_ARCHIVED' : 'SOW_PENDING'
    }
    await prisma.opportunity.update({ where: { id: approval.opportunityId }, data: { stage: newStage } })

    await mailApprovalApproved({
      requesterEmail:   approval.requestedBy.email,
      requesterName:    approval.requestedBy.name,
      approverEmail:    approval.approver.email,
      approverName:     approval.approver.name,
      opportunityId:    approval.opportunity.opportunityId,
      opportunityName:  approval.opportunity.opportunityName,
      clientName:       approval.opportunity.client?.name ?? '',
      approvalType:     approval.approvalType,
    })

    return NextResponse.json(updated)
  }

  // ── Dual: A1 approves — unlock A2 and send them the full detailed email ──
  const updated = await prisma.approvalRequest.update({
    where: { id },
    data:  { approver2Status: 'PENDING' },
  })

  const a2User = approval.approver2 ?? (
    approval.approverId2
      ? await prisma.user.findUnique({ where: { id: approval.approverId2 }, select: { name: true, email: true } })
      : null
  )

  if (a2User) {
    // Fetch pricing context so A2 gets the same detailed email as A1 did
    const [finalVersion, otherCosts] = await Promise.all([
      prisma.pricingVersion.findFirst({
        where:   { opportunityId: approval.opportunityId, isFinal: true },
        include: {
          staffingResources: {
            select: {
              isActive: true, isBillable: true, location: true,
              effectiveBillRate: true, systemBillRatePerHour: true, costRatePerHour: true,
              weeklyHours: { select: { hours: true } },
            },
          },
        },
      }),
      prisma.otherCost.findMany({
        where:  { opportunityId: approval.opportunityId },
        select: { amount: true, isBillable: true, markupPct: true },
      }),
    ])

    const context = {
      ...computeContext(
        finalVersion?.staffingResources ?? [],
        otherCosts,
        (approval.opportunity as any).startDate ?? null,
        (approval.opportunity as any).endDate   ?? null,
      ),
      versionNumber: finalVersion?.versionNumber ?? undefined,
    }

    await mailApprovalRequested({
      approverEmail:         a2User.email,
      approverName:          a2User.name,
      requesterEmail:        approval.requestedBy.email,
      requesterName:         approval.requestedBy.name,
      opportunityId:         approval.opportunity.opportunityId,
      opportunityName:       approval.opportunity.opportunityName,
      clientName:            approval.opportunity.client?.name ?? '',
      approvalType:          approval.approvalType,
      approvalRecordId:      approval.id,
      approverId:            approval.approverId2!,
      businessJustification: approval.businessJustification,
      context,
    })
  } else {
    console.error('[dual-approve] approverId2 set but user not found:', approval.approverId2)
  }

  return NextResponse.json(updated)
}
