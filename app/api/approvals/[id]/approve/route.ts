import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { mailApprovalApproved } from '@/lib/mail'
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
    data:  { status: 'APPROVED', decidedAt: new Date() },
  })

  // Stage transition is track-aware because pricing and SOW verification can be
  // approved in parallel (in either order):
  //  • SOW_VERIFICATION approved → engagement is verified → TO_BE_ARCHIVED.
  //  • PRICING approved → normally SOW_PENDING, but if a SOW verification was
  //    already approved on the parallel track, the deal is fully done, so go
  //    straight to TO_BE_ARCHIVED instead of bouncing the stage backwards.
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
  await prisma.opportunity.update({
    where: { id: approval.opportunityId },
    data:  { stage: newStage },
  })

  await mailApprovalApproved({
    requesterEmail:   approval.requestedBy.email,
    requesterName:    approval.requestedBy.name,
    approverEmail:    approval.approver.email,
    approverName:     approval.approver.name,
    opportunityId:    approval.opportunity.opportunityId,
    opportunityName:  approval.opportunity.opportunityName,
    approvalType:     approval.approvalType,
  })

  return NextResponse.json(updated)
}
