import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const cards = await prisma.rateCard.findMany({
    where: { isActive: true },
    orderBy: [{ location: 'asc' }, { jobRole: 'asc' }],
    select: {
      id: true,
      jobRole: true,
      location: true,
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
