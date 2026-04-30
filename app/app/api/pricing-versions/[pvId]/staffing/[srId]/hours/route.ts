import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ pvId: string; srId: string }> }
) {
  try {
    const { srId } = await params
    const { weekStartDate, hours } = await req.json()
    if (!weekStartDate || hours == null) {
      return NextResponse.json({ error: 'weekStartDate and hours required' }, { status: 400 })
    }

    const date = new Date(weekStartDate)
    const entry = await prisma.staffingWeekEntry.upsert({
      where: { staffingResourceId_weekStartDate: { staffingResourceId: srId, weekStartDate: date } },
      update: { hours },
      create: { staffingResourceId: srId, weekStartDate: date, hours },
    })
    return NextResponse.json(entry)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update hours' }, { status: 500 })
  }
}
