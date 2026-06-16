// DELETE /api/client-pocs/[id] — remove a single client point-of-contact by id.
// Open to any signed-in user (no role gate), matching the POC create route.
import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const { id } = await params
  try {
    await prisma.clientPOC.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return apiError('POC_DELETE_FAILED')
  }
}
