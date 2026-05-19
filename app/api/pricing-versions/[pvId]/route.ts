import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ pvId: string }> }
) {
  try {
    const { pvId } = await params
    await prisma.pricingVersion.delete({ where: { id: pvId } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete pricing version' }, { status: 500 })
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pvId: string }> },
) {
  const { pvId } = await params
  const version = await prisma.pricingVersion.findUnique({
    where: { id: pvId },
    include: {
      staffingResources: {
        include: {
          weeklyHours: { orderBy: { weekStartDate: 'asc' } },
          rateCard: true,
        },
      },
      scheduleOfPayments: { orderBy: { month: 'asc' } },
      financialSnapshots: { orderBy: { month: 'asc' } },
    },
  })
  if (!version) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(version)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pvId: string }> }
) {
  try {
    const { pvId } = await params
    const body = await req.json()

    if (body.isFinal === true) {
      // Unset isFinal on all sibling versions, then set this one
      const current = await prisma.pricingVersion.findUnique({ where: { id: pvId }, select: { opportunityId: true } })
      if (current) {
        await prisma.pricingVersion.updateMany({
          where: { opportunityId: current.opportunityId, isFinal: true },
          data: { isFinal: false },
        })
        // Advance stage to PRICE_LINKING_PENDING only from LEAD
        await prisma.opportunity.updateMany({
          where: { id: current.opportunityId, stage: 'LEAD' },
          data: { stage: 'PRICE_LINKING_PENDING' },
        })
      }
    }

    const updated = await prisma.pricingVersion.update({
      where: { id: pvId },
      data: {
        ...(body.isFinal             !== undefined && { isFinal:             body.isFinal             }),
        ...(body.totalHours          != null && { totalHours:          body.totalHours          }),
        ...(body.totalCost           != null && { totalCost:           body.totalCost           }),
        ...(body.proposedBillings    != null && { proposedBillings:    body.proposedBillings    }),
        ...(body.grossMarginPct      != null && { grossMarginPct:      body.grossMarginPct      }),
        ...(body.offshorePct         != null && { offshorePct:         body.offshorePct         }),
        ...(body.effectiveRatePerHour!= null && { effectiveRatePerHour:body.effectiveRatePerHour}),
        ...(body.discountPremiumPct  != null && { discountPremiumPct:  body.discountPremiumPct  }),
        ...(body.revenueSharePct    != null && { revenueSharePct:     body.revenueSharePct     }),
      },
    })
    return NextResponse.json(updated)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update pricing version' }, { status: 500 })
  }
}
