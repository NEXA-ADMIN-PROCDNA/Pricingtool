import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: opportunityId } = await params
  const body = await req.json().catch(() => ({}))

  const opp = await prisma.opportunity.findUnique({
    where: { opportunityId },
    select: { id: true },
  })
  if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })

  const last = await prisma.pricingVersion.findFirst({
    where: { opportunityId: opp.id },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true },
  })
  const nextVersion = (last?.versionNumber ?? 0) + 1

  const version = await prisma.pricingVersion.create({
    data: {
      opportunityId: opp.id,
      versionNumber: nextVersion,
      label: body.label ?? null,
      isFinal: false,
    },
    include: {
      staffingResources: {
        include: {
          weeklyHours: { orderBy: { weekStartDate: 'asc' } },
          rateCard: true,
        },
      },
      scheduleOfPayments: { orderBy: { month: 'asc' } },
      financialSnapshots: { orderBy: { month: 'asc' } },
    },
  })

  return NextResponse.json(version, { status: 201 })
}
