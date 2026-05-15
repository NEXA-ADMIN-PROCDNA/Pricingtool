import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { setOpportunityWon } from '@/lib/db/opportunities'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const userId = token.id as string

  const approval = await prisma.approvalRequest.findUnique({ where: { id } })
  if (!approval) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (approval.approverId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (approval.status !== 'PENDING') return NextResponse.json({ error: 'Already decided' }, { status: 409 })

  const updated = await prisma.approvalRequest.update({
    where: { id },
    data: { status: 'APPROVED', decidedAt: new Date() },
  })

  if (approval.approvalType === 'SOW_VERIFICATION') {
    await setOpportunityWon(approval.opportunityId)
  }

  return NextResponse.json(updated)
}
