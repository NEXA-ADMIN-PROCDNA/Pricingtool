import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pvId: string; srId: string }> }
) {
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
    return NextResponse.json({ error: 'Failed to update staffing resource' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pvId: string; srId: string }> }
) {
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { srId } = await params
    await prisma.staffingResource.delete({ where: { id: srId } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to remove staffing resource' }, { status: 500 })
  }
}
