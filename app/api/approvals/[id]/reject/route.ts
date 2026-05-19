import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { mailApprovalRejected } from '@/lib/mail'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const userId = token.id as string
  const { reason } = await req.json().catch(() => ({ reason: '' }))

  const approval = await prisma.approvalRequest.findUnique({
    where:   { id },
    include: {
      requestedBy: { select: { name: true, email: true } },
      approver:    { select: { name: true } },
      opportunity: { select: { opportunityId: true, opportunityName: true } },
    },
  })
  if (!approval) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (approval.approverId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (approval.status !== 'PENDING') return NextResponse.json({ error: 'Already decided' }, { status: 409 })

  const updated = await prisma.approvalRequest.update({
    where: { id },
    data:  {
      status:          'REJECTED',
      decidedAt:       new Date(),
      rejectionReason: reason?.trim() || null,
    },
  })

  await prisma.opportunity.update({ where: { id: approval.opportunityId }, data: { stage: 'LEAD' } })

  mailApprovalRejected({
    requesterEmail:  approval.requestedBy.email,
    requesterName:   approval.requestedBy.name,
    approverName:    approval.approver.name,
    opportunityId:   approval.opportunity.opportunityId,
    opportunityName: approval.opportunity.opportunityName,
    approvalType:    approval.approvalType,
    reason:          reason?.trim() || undefined,
  }).catch((e: unknown) => console.error('[mail] approvalRejected:', e))

  return NextResponse.json(updated)
}
