// ─────────────────────────────────────────────────────────────────────────────
// POST /api/opportunities/[id]/pricing-versions — create a new pricing version.
// Big picture: an opportunity can hold multiple pricing scenarios; versionNumber
// auto-increments off the latest. Creating the FIRST one moves the opp LEAD →
// PRICE_LINKING_PENDING. Returns the version with its (empty) staffing/schedule/
// financial relations ready for the pricing drawer to fill in.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const { id: opportunityId } = await params
  const body = await req.json().catch(() => ({}))

  const opp = await prisma.opportunity.findUnique({
    where: { opportunityId },
    select: { id: true, stage: true },
  })
  if (!opp) return apiError('OPP_NOT_FOUND')

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

  if (opp.stage === 'LEAD') {
    await prisma.opportunity.update({ where: { id: opp.id }, data: { stage: 'PRICE_LINKING_PENDING' } })
  }

  return NextResponse.json(version, { status: 201 })
}
