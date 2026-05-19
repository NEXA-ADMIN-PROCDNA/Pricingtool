import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mailApprovalRequested, type ApprovalMailContext } from '@/lib/mail'

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
  // Prisma returns Decimal objects for numeric fields — convert to plain numbers
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
  try {
    const { id: opportunityId } = await params
    const { approverId, requestedById, approvalType = 'PRICING', businessJustification, ccIds } = await req.json()

    if (!approverId || !requestedById) {
      return NextResponse.json({ error: 'Missing approverId or requestedById' }, { status: 400 })
    }
    if (!businessJustification?.trim()) {
      return NextResponse.json({ error: 'Business justification is required' }, { status: 400 })
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

    const ccUserIds: string[] = Array.isArray(ccIds) ? ccIds : []

    const [finalVersion, otherCosts, ccUsers] = await Promise.all([
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
      ccUserIds.length > 0
        ? prisma.user.findMany({ where: { id: { in: ccUserIds } }, select: { email: true } })
        : Promise.resolve([] as { email: string }[]),
    ])

    const approval = await prisma.approvalRequest.create({
      data: {
        opportunityId:        opp.id,
        requestedById,
        approverId,
        approvalType,
        status:               'PENDING',
        requestedAt:          new Date(),
        pricingVersionNumber: finalVersion?.versionNumber ?? null,
        businessJustification: businessJustification.trim(),
      },
      include: { requestedBy: { select: { name: true, email: true } }, approver: { select: { name: true, email: true } } },
    })

    const newStage = approvalType === 'SOW_VERIFICATION' ? 'SOW_PENDING' : 'APPROVAL_PENDING'
    await prisma.opportunity.update({ where: { id: opp.id }, data: { stage: newStage } })

    const context = {
      ...computeContext(
        finalVersion?.staffingResources ?? [],
        otherCosts,
        opp.startDate,
        opp.endDate,
      ),
      versionNumber: finalVersion?.versionNumber ?? undefined,
    }

    // Fire-and-forget — don't let mail failure block the response
    mailApprovalRequested({
      approverEmail:         approval.approver.email,
      approverName:          approval.approver.name,
      requesterEmail:        approval.requestedBy.email,
      requesterName:         approval.requestedBy.name,
      ccEmails:              ccUsers.map(u => u.email),
      opportunityId:         opp.opportunityId,
      opportunityName:       opp.opportunityName,
      clientName:            opp.client.name,
      approvalType,
      approvalRecordId:      approval.id,
      approverId:            approval.approverId,
      businessJustification: businessJustification.trim(),
      context,
    }).catch((e: unknown) => console.error('[mail] approvalRequested:', e))

    return NextResponse.json(approval, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create approval request' }, { status: 500 })
  }
}
