// POST /api/client-requests/[reqId]/reject — admin rejects a new-client request
// (marks it REJECTED with reviewer + timestamp; no Client is created).
import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

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

    await prisma.clientRequest.update({
      where: { id: reqId },
      data: {
        status: 'REJECTED',
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    })

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to reject request' }, { status: 500 })
  }
}
