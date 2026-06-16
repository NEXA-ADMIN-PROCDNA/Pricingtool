// ─────────────────────────────────────────────────────────────────────────────
// PATCH/DELETE /api/clients/[id] — admin-only client edit and delete.
// Big picture: edits the client IN PLACE (same id) so every opportunity/POC pointing
// at it stays valid; clientId is the admin-assigned human code (nullable, unique).
// DELETE is a HARD delete, blocked while the client still has opportunities (POCs
// cascade). A P2002 error = the assigned clientId is already taken.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

function clean(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

// PATCH — admin only. Updates the client row IN PLACE (same id), so every
// opportunity / POC / reference that points at this client stays valid.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')
  if ((token.role as string) !== 'ADMIN') return apiError('ADMIN_ONLY')

  const { id } = await params
  const body = await req.json().catch(() => ({})) as {
    name?: string; businessUnit?: string; industry?: string; region?: string; clientId?: string
  }
  if (!body.name?.trim()) return apiError('CLIENT_UPDATE_FAILED', 'Client name is required')

  try {
    const updated = await prisma.client.update({
      where: { id },
      data: {
        name:         body.name.trim(),
        businessUnit: clean(body.businessUnit),
        industry:     clean(body.industry),
        region:       clean(body.region),
        clientId:     clean(body.clientId),   // admin-assigned ID (nullable); unique enforced by DB
      },
    })
    return NextResponse.json(updated)
  } catch (err) {
    // Unique-constraint violation on clientId → friendly "already taken" message
    if ((err as { code?: string })?.code === 'P2002') return apiError('CLIENT_ID_TAKEN')
    return apiError('CLIENT_UPDATE_FAILED')
  }
}

// DELETE — admin only. Hard delete. Blocked when the client still has
// opportunities (they FK-reference it); POCs cascade-delete automatically.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')
  if ((token.role as string) !== 'ADMIN') return apiError('ADMIN_ONLY')

  const { id } = await params
  try {
    const oppCount = await prisma.opportunity.count({ where: { clientId: id } })
    if (oppCount > 0) return apiError('CLIENT_HAS_OPPS')
    await prisma.client.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return apiError('CLIENT_DELETE_FAILED')
  }
}
