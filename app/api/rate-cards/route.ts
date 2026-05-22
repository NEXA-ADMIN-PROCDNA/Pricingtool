import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
