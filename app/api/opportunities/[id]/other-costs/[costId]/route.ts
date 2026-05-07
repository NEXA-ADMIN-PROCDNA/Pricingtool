import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ costId: string }> },
) {
  const { costId } = await params
  const { isBillable, markupPct } = await req.json()
  await prisma.otherCost.update({
    where: { id: costId },
    data: {
      ...(isBillable  !== undefined && { isBillable }),
      ...(markupPct   !== undefined && { markupPct: markupPct ?? null }),
    },
  })
  return new NextResponse(null, { status: 204 })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ costId: string }> },
) {
  const { costId } = await params
  await prisma.otherCost.delete({ where: { id: costId } })
  return new NextResponse(null, { status: 204 })
}
