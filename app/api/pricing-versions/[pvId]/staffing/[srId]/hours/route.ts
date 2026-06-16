// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/pricing-versions/[pvId]/staffing/[srId]/hours — upsert ONE week's hours.
// Big picture: the fine-grained save used when editing a single week cell in the efforts
// grid (keyed uniquely on staffingResource + weekStartDate). The batch equivalent lives
// in the parent staffing PATCH.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ pvId: string; srId: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

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
    return apiError('HOURS_SAVE_FAILED')
  }
}
