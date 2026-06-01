import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pvId: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  try {
    const { pvId } = await params
    const { rateCardId } = await req.json()
    if (!rateCardId) return NextResponse.json({ error: 'rateCardId required' }, { status: 400 })

    const rc = await prisma.rateCard.findUnique({ where: { id: rateCardId } })
    if (!rc) return apiError('RATE_CARD_NOT_FOUND')

    const sr = await prisma.staffingResource.create({
      data: {
        pricingVersionId: pvId,
        rateCardId,
        resourceDesignation: rc.jobRole,
        location: rc.location,
        domain: rc.domain ?? null,
        costRatePerHour: rc.costRatePerHour,
        systemBillRatePerHour: rc.billRatePerHour,
        effectiveBillRate: rc.billRatePerHour,
      },
      include: { weeklyHours: true },
    })
    return NextResponse.json(sr, { status: 201 })
  } catch (err) {
    console.error(err)
    return apiError('STAFFING_SAVE_FAILED')
  }
}
