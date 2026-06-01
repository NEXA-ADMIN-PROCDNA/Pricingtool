import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ costId: string }> },
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const { costId } = await params
  const { isBillable, markupPct, lineOfBusiness } = await req.json()
  await prisma.otherCost.update({
    where: { id: costId },
    data: {
      ...(isBillable     !== undefined && { isBillable }),
      ...(markupPct      !== undefined && { markupPct: markupPct ?? null }),
      ...(lineOfBusiness !== undefined && { lineOfBusiness: lineOfBusiness ?? null }),
    },
  })
  return new NextResponse(null, { status: 204 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ costId: string }> },
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const { costId } = await params
  await prisma.otherCost.delete({ where: { id: costId } })
  return new NextResponse(null, { status: 204 })
}
