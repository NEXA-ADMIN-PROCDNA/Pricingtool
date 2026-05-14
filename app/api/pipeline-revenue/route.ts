import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const opps = await prisma.opportunity.findMany({
    where: { isActive: true },
    select: {
      estimatedRevenue: true,
      pricingVersions: {
        where: { isFinal: true },
        select: { proposedBillings: true },
        take: 1,
      },
    },
  })

  let total = 0
  for (const opp of opps) {
    const finalBillings = opp.pricingVersions[0]?.proposedBillings
    total += finalBillings != null ? Number(finalBillings) : Number(opp.estimatedRevenue ?? 0)
  }

  return NextResponse.json({ total })
}
