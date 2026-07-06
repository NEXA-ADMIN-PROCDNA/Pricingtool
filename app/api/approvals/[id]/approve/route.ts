// ─────────────────────────────────────────────────────────────────────────────
// POST /api/approvals/[id]/approve — approve a pending request from inside the app.
//
// Big picture: the in-app twin of the email-action approve. Only the assigned
// approver (or an ADMIN) may approve. It flips the request to APPROVED and advances
// the opportunity stage. Track-aware: PRICING normally → SOW_PENDING, but if SOW
// verification was already approved on the parallel track it jumps straight to
// TO_BE_ARCHIVED; SOW_VERIFICATION → TO_BE_ARCHIVED. Then emails both parties.
//
// RISK: the status flip + stage update aren't in one transaction — a failure between
// them leaves a half-applied state. (See audit C3.)
// ─────────────────────────────────────────────────────────────────────────────
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
      approver2:   { select: { name: true, email: true } },
      opportunity: { select: { opportunityId: true, opportunityName: true, client: { select: { name: true } } } },
    },
  })
  if (!approval) return apiError('APPROVAL_NOT_FOUND')

  const isApprover1 = userId === approval.approverId
  const isApprover2 = !!approval.approverId2 && userId === approval.approverId2
  if (!isAdmin && !isApprover1 && !isApprover2) return apiError('APPROVAL_WRONG_USER')

  const isDual = !!approval.approverId2

  // For dual approval: each approver has their own status field to flip.
  // For single approval: existing behaviour — flip status directly.
  let updated
  if (!isDual || isApprover1) {
    if (approval.status !== 'PENDING') return apiError('APPROVAL_TOKEN_USED')
    updated = await prisma.approvalRequest.update({
      where: { id },
      data:  { status: 'APPROVED', decidedAt: new Date() },
    })
  } else {
    // Approver2 acting
    if (approval.approver2Status !== 'PENDING') return apiError('APPROVAL_TOKEN_USED')
    updated = await prisma.approvalRequest.update({
      where: { id },
      data:  { approver2Status: 'APPROVED', decidedAt: new Date() },
    })
  }

  // Only advance stage when BOTH approvals are in (or single-approval is done).
  const approver1Done = updated.status === 'APPROVED'
  const approver2Done = !isDual || updated.approver2Status === 'APPROVED'
  const fullyApproved = approver1Done && approver2Done

  if (fullyApproved) {
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
      clientName:       approval.opportunity.client?.name ?? '',
      approvalType:     approval.approvalType,
    })
  }

  return NextResponse.json(updated)
}
