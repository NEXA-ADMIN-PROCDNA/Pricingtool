import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

export async function GET(req: NextRequest) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

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
