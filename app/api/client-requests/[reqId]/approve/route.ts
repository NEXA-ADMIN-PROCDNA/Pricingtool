import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

async function nextClientId(): Promise<string> {
  const last = await prisma.client.findFirst({
    orderBy: { clientId: 'desc' },
    select: { clientId: true },
  })
  if (!last) return 'CL-001'
  const n = parseInt(last.clientId.replace('CL-', ''), 10)
  return `CL-${String(n + 1).padStart(3, '0')}`
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reqId: string }> }
) {
  const token = await getToken({ req })
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

    const clientId = await nextClientId()

    await prisma.$transaction([
      prisma.client.create({
        data: {
          clientId,
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
