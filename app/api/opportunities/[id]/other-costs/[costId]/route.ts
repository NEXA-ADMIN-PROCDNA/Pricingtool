import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ costId: string }> },
) {
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  req: NextRequest,
  { params }: { params: Promise<{ costId: string }> },
) {
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { costId } = await params
  await prisma.otherCost.delete({ where: { id: costId } })
  return new NextResponse(null, { status: 204 })
}
