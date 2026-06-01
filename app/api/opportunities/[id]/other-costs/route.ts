import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const { id: oppId } = await params
  const { description, amount, markupPct, lineOfBusiness } = await req.json()

  if (!description?.trim() || amount == null) {
    return NextResponse.json({ error: 'description and amount are required' }, { status: 400 })
  }

  const opp = await prisma.opportunity.findUnique({ where: { opportunityId: oppId } })
  if (!opp) return apiError('OPP_NOT_FOUND')

  try {
    const cost = await prisma.otherCost.create({
      data: {
        opportunityId: opp.id,
        description:   description.trim(),
        amount:        Number(amount),
        markupPct:     markupPct != null ? Number(markupPct) : null,
        lineOfBusiness: lineOfBusiness ?? null,
      },
    })
    return NextResponse.json(cost, { status: 201 })
  } catch (e: any) {
    return apiError('STAFFING_SAVE_FAILED', e?.message)
  }
}
