import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { mailApprovalRejected } from '@/lib/mail'
import { apiError } from '@/lib/errors'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const { id } = await params
  const userId  = token.id as string
  const isAdmin = (token.role as string | undefined) === 'ADMIN'
  const { reason } = await req.json().catch(() => ({ reason: '' }))

  const approval = await prisma.approvalRequest.findUnique({
    where:   { id },
    include: {
      requestedBy: { select: { name: true, email: true } },
      approver:    { select: { name: true, email: true } },
      opportunity: { select: { opportunityId: true, opportunityName: true } },
    },
  })
  if (!approval) return apiError('APPROVAL_NOT_FOUND')
  if (!isAdmin && approval.approverId !== userId) return apiError('APPROVAL_WRONG_USER')
  if (approval.status !== 'PENDING') return apiError('APPROVAL_TOKEN_USED')

  const updated = await prisma.approvalRequest.update({
    where: { id },
    data:  {
      status:          'REJECTED',
      decidedAt:       new Date(),
      rejectionReason: reason?.trim() || null,
    },
  })

  // A PRICING rejection invalidates the whole downstream SOW track: pricing and
  // SOW verification can be requested in parallel, so a SOW verification may
  // already be pending or even approved. Withdraw any such SOW verification so
  // the opportunity resets cleanly to PRICE_LINKED and the owner can redo the
  // flow once pricing is re-approved. (A SOW rejection only rolls its own track.)
  if (approval.approvalType === 'PRICING') {
    await prisma.approvalRequest.updateMany({
      where: {
        opportunityId: approval.opportunityId,
        approvalType:  'SOW_VERIFICATION',
        status:        { in: ['PENDING', 'APPROVED'] },
      },
      data: {
        status:           'WITHDRAWN',
        decidedAt:        new Date(),
        withdrawalReason: 'Auto-invalidated — the pricing approval was rejected.',
      },
    })
  }

  const rollbackStage = approval.approvalType === 'SOW_VERIFICATION' ? 'SOW_SUBMITTED' : 'PRICE_LINKED'
  await prisma.opportunity.update({ where: { id: approval.opportunityId }, data: { stage: rollbackStage } })

  await mailApprovalRejected({
    requesterEmail:   approval.requestedBy.email,
    requesterName:    approval.requestedBy.name,
    approverEmail:    approval.approver.email,
    approverName:     approval.approver.name,
    opportunityId:    approval.opportunity.opportunityId,
    opportunityName:  approval.opportunity.opportunityName,
    approvalType:     approval.approvalType,
    reason:           reason?.trim() || undefined,
  })

  return NextResponse.json(updated)
}
