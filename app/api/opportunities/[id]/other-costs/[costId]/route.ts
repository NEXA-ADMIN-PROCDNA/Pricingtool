import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ costId: string }> },
) {
  const { costId } = await params
  await prisma.otherCost.delete({ where: { id: costId } })
  return new NextResponse(null, { status: 204 })
}
