import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pvId: string; srId: string }> }
) {
  const token = await getToken({ req })
  if (!token) return apiError('UNAUTHORIZED')

  try {
    const { srId } = await params
    const { utilization, weekEntries, effectiveBillRate, isActive, isBillable } = await req.json()

    await prisma.$transaction(async (tx) => {
      await tx.staffingResource.update({
        where: { id: srId },
        data: {
          ...(utilization       !== undefined && { utilization: utilization ?? null }),
          ...(effectiveBillRate !== undefined && { effectiveBillRate }),
          ...(isActive          !== undefined && { isActive }),
          ...(isBillable        !== undefined && { isBillable }),
        },
      })
      if (Array.isArray(weekEntries) && weekEntries.length > 0) {
        for (const { weekStartDate, hours } of weekEntries) {
          await tx.staffingWeekEntry.upsert({
            where: {
              staffingResourceId_weekStartDate: {
                staffingResourceId: srId,
                weekStartDate: new Date(weekStartDate),
              },
            },
            update: { hours },
            create: { staffingResourceId: srId, weekStartDate: new Date(weekStartDate), hours },
          })
        }
      }
    })

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
  const token = await getToken({ req })
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
