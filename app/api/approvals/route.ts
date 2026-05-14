import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = token.id as string
  const url = new URL(req.url)
  const onlyPending = url.searchParams.get('pending') === 'true'

  const approvals = await prisma.approvalRequest.findMany({
    where: {
      approverId: userId,
      ...(onlyPending ? { status: 'PENDING' } : {}),
    },
    include: {
      requestedBy: { select: { id: true, name: true, role: true } },
      opportunity: {
        select: {
          opportunityId: true,
          opportunityName: true,
          startDate: true,
          endDate: true,
          client: { select: { name: true } },
          pricingVersions: {
            where: { isFinal: true },
            select: {
              versionNumber: true,
              proposedBillings: true,
              grossMarginPct: true,
              totalHours: true,
              discountPremiumPct: true,
              businessJustification: true,
            },
            take: 1,
          },
        },
      },
    },
    orderBy: { requestedAt: 'desc' },
  })

  return NextResponse.json(approvals)
}
