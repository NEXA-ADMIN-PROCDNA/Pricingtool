import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req })
  if (!token) return apiError('UNAUTHORIZED')

  const { id } = await params
  const userId = token.id as string

  const approval = await prisma.approvalRequest.findUnique({
    where:  { id },
    select: { id: true, status: true, approvalType: true, requestedById: true, opportunityId: true },
  })

  if (!approval)                           return apiError('APPROVAL_NOT_FOUND')
  if (approval.requestedById !== userId)   return apiError('APPROVAL_WRONG_USER')
  if (approval.status !== 'PENDING')       return apiError('APPROVAL_TOKEN_USED')

  await prisma.approvalRequest.update({
    where: { id },
    data:  { status: 'WITHDRAWN', decidedAt: new Date() },
  })

  await prisma.opportunity.update({
    where: { id: approval.opportunityId },
    data:  { stage: 'PRICE_LINKED' },
  })

  return NextResponse.json({ ok: true })
}
