import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { mailApprovalRequested, mailApprovalApproved } from '@/lib/mail'
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

  if (isApprover2) {
    // Sequential guard: Approver 2 can only act after Approver 1 has approved
    if (approval.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Approver 1 (Finance) has not yet approved. Please wait.' },
        { status: 403 }
      )
    }
    if (approval.approver2Status !== 'PENDING') return apiError('APPROVAL_TOKEN_USED')

    // Approver 2 approves → fully approved → advance stage
    const updated = await prisma.approvalRequest.update({
      where: { id },
      data:  { approver2Status: 'APPROVED', decidedAt: new Date() },
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

    return NextResponse.json(updated)
  }

  // Approver 1 (or single-approval) path
  if (approval.status !== 'PENDING') return apiError('APPROVAL_TOKEN_USED')

  const updated = await prisma.approvalRequest.update({
    where: { id },
    data:  { status: 'APPROVED', decidedAt: new Date() },
  })

  if (!isDual) {
    // Single approval — advance stage immediately
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
  } else {
    // Dual approval — Approver 1 just approved; now email Approver 2 with action buttons
    if (approval.approver2) {
      await mailApprovalRequested({
        approverEmail:         approval.approver2.email,
        approverName:          approval.approver2.name,
        requesterEmail:        approval.requestedBy.email,
        requesterName:         approval.requestedBy.name,
        opportunityId:         approval.opportunity.opportunityId,
        opportunityName:       approval.opportunity.opportunityName,
        clientName:            approval.opportunity.client?.name ?? '',
        approvalType:          approval.approvalType,
        approvalRecordId:      approval.id,
        approverId:            approval.approverId2!,
        businessJustification: approval.businessJustification,
      })
    }
  }

  return NextResponse.json(updated)
}
