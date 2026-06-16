// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rate-cards — list active rate cards (job role × location × cost/bill rate).
// Big picture: rate cards are the source of staffing bill/cost rates used across ALL
// pricing. Decimals are coerced to Number for the client. Visible to any signed-in
// user — note this includes sensitive cost rates / margin inputs.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

export async function GET(req: NextRequest) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const cards = await prisma.rateCard.findMany({
    where: { isActive: true },
    orderBy: [{ location: 'asc' }, { jobRole: 'asc' }],
    select: {
      id: true,
      jobRole: true,
      location: true,
      domain: true,
      costRatePerHour: true,
      billRatePerHour: true,
    },
  })
  return NextResponse.json(
    cards.map(c => ({
      ...c,
      costRatePerHour: Number(c.costRatePerHour),
      billRatePerHour: Number(c.billRatePerHour),
    }))
  )
}
