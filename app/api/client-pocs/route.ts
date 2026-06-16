// ─────────────────────────────────────────────────────────────────────────────
// POST /api/client-pocs — add a point-of-contact to a client. Big picture: POCs are
// the client-side people attached to a Client, shown on the client + opportunity
// pages. Open to any signed-in user by design (no role gate); any clientId can be
// targeted.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

// Create a client POC. Open to any signed-in user (no role gate) — anyone can
// add a point of contact from the client detail page.
export async function POST(req: NextRequest) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const body = await req.json().catch(() => ({})) as {
    clientId?: string; name?: string; email?: string; phone?: string; jobTitle?: string
  }

  if (!body.name?.trim()) return apiError('POC_NAME_REQUIRED')
  if (!body.clientId)     return apiError('POC_CREATE_FAILED', 'Missing client reference')

  try {
    const poc = await prisma.clientPOC.create({
      data: {
        clientId: body.clientId,
        name:     body.name.trim(),
        email:    body.email?.trim()    || null,
        phone:    body.phone?.trim()    || null,
        jobTitle: body.jobTitle?.trim() || null,
      },
    })
    return NextResponse.json(poc)
  } catch {
    return apiError('POC_CREATE_FAILED')
  }
}
