// ─────────────────────────────────────────────────────────────────────────────
// POST /api/client-requests/[reqId]/approve — admin approves a new-client request.
// Big picture: in ONE $transaction it creates the real Client (no clientId yet —
// finance/admins assign the code later) and marks the request APPROVED. The admin half
// of the "request a client" workflow that started in /api/client-requests.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

// Client IDs are assigned manually by finance/admins later (e.g. 1004VL3002),
// so new clients are created without one — see the edit form on the client page.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reqId: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')
  if ((token.role as string) !== 'ADMIN') return apiError('ADMIN_ONLY')

  try {
    const { reqId } = await params
    const { reviewerId } = await req.json()
    if (!reviewerId) return NextResponse.json({ error: 'reviewerId required' }, { status: 400 })

    const clientReq = await prisma.clientRequest.findUnique({ where: { id: reqId } })
    if (!clientReq) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    if (clientReq.status !== 'PENDING') {
      return NextResponse.json({ error: 'Request already reviewed' }, { status: 409 })
    }

    await prisma.$transaction([
      prisma.client.create({
        data: {
          name: clientReq.name,
          businessUnit: clientReq.businessUnit,
          industry: clientReq.industry,
          region: clientReq.region,
          createdById: clientReq.requestedById,
        },
      }),
      prisma.clientRequest.update({
        where: { id: reqId },
        data: {
          status: 'APPROVED',
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
      }),
    ])

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to approve request' }, { status: 500 })
  }
}
