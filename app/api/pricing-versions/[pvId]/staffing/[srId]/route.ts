import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pvId: string; srId: string }> }
) {
  try {
    const { srId } = await params
    const { utilization, weekEntries } = await req.json()

    await prisma.$transaction(async (tx) => {
      await tx.staffingResource.update({
        where: { id: srId },
        data: { utilization: utilization ?? null },
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
  _req: NextRequest,
  { params }: { params: Promise<{ pvId: string; srId: string }> }
) {
  try {
    const { srId } = await params
    await prisma.staffingResource.delete({ where: { id: srId } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to remove staffing resource' }, { status: 500 })
  }
}
