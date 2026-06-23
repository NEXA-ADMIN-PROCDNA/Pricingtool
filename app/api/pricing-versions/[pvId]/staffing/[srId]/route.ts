// ─────────────────────────────────────────────────────────────────────────────
// PATCH/DELETE /api/pricing-versions/[pvId]/staffing/[srId] — update or remove one
// staffing resource. PATCH saves the resource fields (utilisation, bill rate, active/
// billable) AND upserts a batch of weekly-hour entries.
//
// Why the week upserts run as a parallel Promise.all and NOT inside a $transaction:
// there can be 52–520 weeks; wrapping them in one interactive transaction would blow
// past the ~5s Supabase pooler limit. Each upsert is atomic on its own. (Relaxes on RDS.)
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pvId: string; srId: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  try {
    const { srId } = await params
    const { utilization, weekEntries, effectiveBillRate, isActive, isBillable, potMem } = await req.json()

    // Resource update first — atomic by itself.
    await prisma.staffingResource.update({
      where: { id: srId },
      data: {
        ...(utilization       !== undefined && { utilization: utilization ?? null }),
        ...(effectiveBillRate !== undefined && { effectiveBillRate }),
        ...(isActive          !== undefined && { isActive }),
        ...(isBillable        !== undefined && { isBillable }),
        ...(potMem            !== undefined && { potMem: potMem ?? null }),
      },
    })

    // Week-entry upserts run in parallel, NOT inside an interactive transaction.
    // Each upsert is atomic on its own, and N can grow large (52+ weeks) — wrapping
    // them in a $transaction blows past the 5s interactive-tx timeout on the
    // Supabase transaction-mode pooler.
    if (Array.isArray(weekEntries) && weekEntries.length > 0) {
      await Promise.all(
        weekEntries.map(({ weekStartDate, hours }) =>
          prisma.staffingWeekEntry.upsert({
            where: {
              staffingResourceId_weekStartDate: {
                staffingResourceId: srId,
                weekStartDate: new Date(weekStartDate),
              },
            },
            update: { hours },
            create: { staffingResourceId: srId, weekStartDate: new Date(weekStartDate), hours },
          }),
        ),
      )
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return apiError('STAFFING_SAVE_FAILED')
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pvId: string; srId: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  try {
    const { srId } = await params
    await prisma.staffingResource.delete({ where: { id: srId } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return apiError('STAFFING_SAVE_FAILED')
  }
}
