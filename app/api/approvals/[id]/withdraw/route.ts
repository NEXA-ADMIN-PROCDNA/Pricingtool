import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'
import { mailApprovalWithdrawn } from '@/lib/mail'
import type { ApprovalStatus } from '@prisma/client'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req })
  if (!token) return apiError('UNAUTHORIZED')

  const { id } = await params
  const userId = token.id as string
  const body   = await req.json().catch(() => ({})) as { reason?: string }
  const reason = (body.reason ?? '').trim() || null

  const approval = await prisma.approvalRequest.findUnique({
    where:   { id },
    include: {
      requestedBy: { select: { name: true, email: true } },
      approver:    { select: { name: true, email: true } },
      opportunity: { select: { opportunityId: true, opportunityName: true } },
    },
  })

  if (!approval)                           return apiError('APPROVAL_NOT_FOUND')
  if (approval.requestedById !== userId)   return apiError('APPROVAL_WRONG_USER')
  if (approval.status !== 'PENDING')       return apiError('APPROVAL_TOKEN_USED')

  try {
    await prisma.approvalRequest.update({
      where: { id },
      data:  { status: 'WITHDRAWN' as ApprovalStatus, decidedAt: new Date(), withdrawalReason: reason },
    })

    await prisma.opportunity.update({
      where: { id: approval.opportunityId },
      data:  { stage: 'PRICE_LINKED' },
    })
  } catch (err) {
    console.error('[withdraw] DB error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  await mailApprovalWithdrawn({
    approverEmail:   approval.approver.email,
    approverName:    approval.approver.name,
    requesterEmail:  approval.requestedBy.email,
    requesterName:   approval.requestedBy.name,
    opportunityId:   approval.opportunity.opportunityId,
    opportunityName: approval.opportunity.opportunityName,
    approvalType:    approval.approvalType,
    reason:          reason ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
