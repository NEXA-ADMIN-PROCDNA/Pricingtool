import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: opportunityId } = await params
    const { approverId, requestedById } = await req.json()

    if (!approverId || !requestedById) {
      return NextResponse.json({ error: 'Missing approverId or requestedById' }, { status: 400 })
    }

    const opp = await prisma.opportunity.findUnique({
      where: { opportunityId },
      select: { id: true },
    })
    if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })

    const approval = await prisma.approvalRequest.create({
      data: {
        opportunityId: opp.id,
        requestedById,
        approverId,
        status: 'PENDING',
        requestedAt: new Date(),
      },
      include: { requestedBy: true, approver: true },
    })

    return NextResponse.json(approval, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create approval request' }, { status: 500 })
  }
}
