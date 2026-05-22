import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pvId: string }> }
) {
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  req: NextRequest,
  { params }: { params: Promise<{ pvId: string }> },
) {
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { pvId } = await params
    const body = await req.json()

    if (body.isFinal === true) {
      const current = await prisma.pricingVersion.findUnique({
        where:  { id: pvId },
        select: { opportunityId: true, isFinal: true },
      })
      if (current) {
        // Unset isFinal on all sibling versions
        await prisma.pricingVersion.updateMany({
          where: { opportunityId: current.opportunityId, isFinal: true },
          data:  { isFinal: false },
        })

        const opp = await prisma.opportunity.findUnique({
          where:  { id: current.opportunityId },
          select: { stage: true },
        })

        if (opp?.stage === 'STATUS_CHANGE_PENDING') {
          // Pricing approval was already given — changing final version invalidates it
          await prisma.opportunity.update({
            where: { id: current.opportunityId },
            data:  { stage: 'LEAD' },
          })
        } else if (opp?.stage === 'LEAD') {
          // Advance stage only from LEAD
          await prisma.opportunity.update({
            where: { id: current.opportunityId },
            data:  { stage: 'PRICE_LINKING_PENDING' },
          })
        }
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
