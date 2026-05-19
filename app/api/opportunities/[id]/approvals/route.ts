import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mailApprovalRequested, type ApprovalMailContext } from '@/lib/mail'

function computeContext(
  staffing: {
    isActive: boolean; isBillable: boolean; location: string
    effectiveBillRate: number | null; systemBillRatePerHour: number | null; costRatePerHour: number | null
    weeklyHours: { hours: number }[]
  }[],
  otherCosts: { amount: number; isBillable: boolean; markupPct: number | null }[],
  startDate: Date | null,
  endDate:   Date | null,
): ApprovalMailContext {
  let a1 = 0, recRev = 0, b = 0, f1 = 0, f2 = 0, indiaHrs = 0
  for (const row of staffing.filter(r => r.isActive)) {
    const hours = row.weeklyHours.reduce((s, wh) => s + wh.hours, 0)
    b += hours * (row.costRatePerHour ?? 0)
    if (row.isBillable) {
      a1     += hours * (row.effectiveBillRate ?? row.systemBillRatePerHour ?? 0)
      recRev += hours * (row.systemBillRatePerHour ?? 0)
      f1     += hours
      if (row.location === 'INDIA') indiaHrs += hours
    } else {
      f2 += hours
    }
  }
  const a2 = otherCosts.filter(oc => oc.isBillable).reduce((s, oc) => s + oc.amount * (1 + (oc.markupPct ?? 0) / 100), 0)
  const c  = otherCosts.reduce((s, oc) => s + oc.amount, 0)
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
  try {
    const { id: opportunityId } = await params
    const { approverId, requestedById, approvalType = 'PRICING' } = await req.json()

    if (!approverId || !requestedById) {
      return NextResponse.json({ error: 'Missing approverId or requestedById' }, { status: 400 })
    }

    const opp = await prisma.opportunity.findUnique({
      where:  { opportunityId },
      select: {
        id: true, opportunityName: true, opportunityId: true,
        startDate: true, endDate: true,
        client: { select: { name: true } },
      },
    })
    if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })

    const [approval, finalVersion, otherCosts] = await Promise.all([
      prisma.approvalRequest.create({
        data: {
          opportunityId: opp.id,
          requestedById,
          approverId,
          approvalType,
          status: 'PENDING',
          requestedAt: new Date(),
        },
        include: { requestedBy: { select: { name: true, email: true } }, approver: { select: { name: true, email: true } } },
      }),
      prisma.pricingVersion.findFirst({
        where:   { opportunityId: opp.id, isFinal: true },
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
        where:  { opportunityId: opp.id },
        select: { amount: true, isBillable: true, markupPct: true },
      }),
    ])

    const newStage = approvalType === 'SOW_VERIFICATION' ? 'SOW_PENDING' : 'APPROVAL_PENDING'
    await prisma.opportunity.update({ where: { id: opp.id }, data: { stage: newStage } })

    const context = computeContext(
      finalVersion?.staffingResources ?? [],
      otherCosts,
      opp.startDate,
      opp.endDate,
    )

    // Fire-and-forget — don't let mail failure block the response
    mailApprovalRequested({
      approverEmail:   approval.approver.email,
      approverName:    approval.approver.name,
      requesterEmail:  approval.requestedBy.email,
      requesterName:   approval.requestedBy.name,
      opportunityId:   opp.opportunityId,
      opportunityName: opp.opportunityName,
      clientName:      opp.client.name,
      approvalType,
      context,
    }).catch((e: unknown) => console.error('[mail] approvalRequested:', e))

    return NextResponse.json(approval, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create approval request' }, { status: 500 })
  }
}
