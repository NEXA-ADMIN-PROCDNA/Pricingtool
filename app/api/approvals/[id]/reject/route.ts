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
      approver2:   { select: { name: true, email: true } },
      opportunity: { select: { opportunityId: true, opportunityName: true, client: { select: { name: true } } } },
    },
  })
  if (!approval) return apiError('APPROVAL_NOT_FOUND')

  const isApprover2 = !!approval.approverId2 && userId === approval.approverId2
  const isApprover1 = userId === approval.approverId

  if (!isAdmin && !isApprover1 && !isApprover2) return apiError('APPROVAL_WRONG_USER')

  let updated

  if (isApprover2) {
    // Approver 2 can only reject after Approver 1 has approved
    if (approval.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Approver 1 (Finance) has not yet approved.' },
        { status: 403 }
      )
    }
    if (approval.approver2Status !== 'PENDING') return apiError('APPROVAL_TOKEN_USED')

    updated = await prisma.approvalRequest.update({
      where: { id },
      data:  { approver2Status: 'REJECTED', decidedAt: new Date(), rejectionReason: reason?.trim() || null },
    })
  } else {
    // Approver 1 (or single-approval / admin) path
    if (approval.status !== 'PENDING') return apiError('APPROVAL_TOKEN_USED')

    updated = await prisma.approvalRequest.update({
      where: { id },
      data:  { status: 'REJECTED', decidedAt: new Date(), rejectionReason: reason?.trim() || null },
    })
  }

  // Roll back opportunity stage
  const rollbackStage = approval.approvalType === 'SOW_VERIFICATION' ? 'SOW_SUBMITTED' : 'PRICE_LINKED'
  await prisma.opportunity.update({ where: { id: approval.opportunityId }, data: { stage: rollbackStage } })

  // A PRICING rejection invalidates any parallel SOW verification
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

  const rejecterName  = isApprover2 ? (approval.approver2?.name ?? 'Approver 2') : approval.approver.name
  const rejecterEmail = isApprover2 ? (approval.approver2?.email ?? '') : approval.approver.email

  await mailApprovalRejected({
    requesterEmail:   approval.requestedBy.email,
    requesterName:    approval.requestedBy.name,
    approverEmail:    rejecterEmail,
    approverName:     rejecterName,
    opportunityId:    approval.opportunity.opportunityId,
    opportunityName:  approval.opportunity.opportunityName,
    clientName:       approval.opportunity.client?.name ?? '',
    approvalType:     approval.approvalType,
    reason:           reason?.trim() || undefined,
  })

  return NextResponse.json(updated)
}
