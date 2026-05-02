import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ oppId: string }> },
) {
  const { oppId } = await params
  const { description, amount } = await req.json()

  if (!description?.trim() || amount == null) {
    return NextResponse.json({ error: 'description and amount are required' }, { status: 400 })
  }

  const opp = await prisma.opportunity.findUnique({ where: { opportunityId: oppId } })
  if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })

  const cost = await prisma.otherCost.create({
    data: {
      opportunityId: opp.id,
      description: description.trim(),
      amount,
    },
  })

  return NextResponse.json(cost, { status: 201 })
}
