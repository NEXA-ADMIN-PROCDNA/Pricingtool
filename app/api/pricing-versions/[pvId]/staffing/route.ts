import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pvId: string }> }
) {
  try {
    const { pvId } = await params
    const { rateCardId } = await req.json()
    if (!rateCardId) return NextResponse.json({ error: 'rateCardId required' }, { status: 400 })

    const rc = await prisma.rateCard.findUnique({ where: { id: rateCardId } })
    if (!rc) return NextResponse.json({ error: 'Rate card not found' }, { status: 404 })

    const sr = await prisma.staffingResource.create({
      data: {
        pricingVersionId: pvId,
        rateCardId,
        resourceDesignation: rc.jobRole,
        location: rc.location,
        costRatePerHour: rc.costRatePerHour,
        systemBillRatePerHour: rc.billRatePerHour,
      },
      include: { weeklyHours: true },
    })
    return NextResponse.json(sr, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to add staffing resource' }, { status: 500 })
  }
}
