import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mailApprovalRequested } from '@/lib/mail'

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
      select: { id: true, opportunityName: true, opportunityId: true, client: { select: { name: true } } },
    })
    if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })

    const approval = await prisma.approvalRequest.create({
      data: {
        opportunityId: opp.id,
        requestedById,
        approverId,
        approvalType,
        status: 'PENDING',
        requestedAt: new Date(),
      },
      include: { requestedBy: { select: { name: true } }, approver: { select: { name: true, email: true } } },
    })

    const newStage = approvalType === 'SOW_VERIFICATION' ? 'SOW_PENDING' : 'APPROVAL_PENDING'
    await prisma.opportunity.update({ where: { id: opp.id }, data: { stage: newStage } })

    // Fire-and-forget — don't let mail failure block the response
    mailApprovalRequested({
      approverEmail:   approval.approver.email,
      approverName:    approval.approver.name,
      requesterName:   approval.requestedBy.name,
      opportunityId:   opp.opportunityId,
      opportunityName: opp.opportunityName,
      clientName:      opp.client.name,
      approvalType,
    }).catch((e: unknown) => console.error('[mail] approvalRequested:', e))

    return NextResponse.json(approval, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create approval request' }, { status: 500 })
  }
}
