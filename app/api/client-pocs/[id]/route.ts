import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req })
  if (!token) return apiError('UNAUTHORIZED')

  const { id } = await params
  try {
    await prisma.clientPOC.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return apiError('POC_DELETE_FAILED')
  }
}
