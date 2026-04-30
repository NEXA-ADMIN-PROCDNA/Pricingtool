import { prisma } from '@/lib/prisma'
import { OpportunityStatus } from '@prisma/client'

export type OpportunityRow = Awaited<ReturnType<typeof getOpportunities>>[number]
export type OpportunityDetail = NonNullable<Awaited<ReturnType<typeof getOpportunityDetail>>>

// Decimal → number serializer; preserves all other types
function serialize<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      value?.constructor?.name === 'Decimal' ? Number(value) : value
    )
  ) as T
}

// ✅ LIST VIEW
export async function getOpportunities(status?: OpportunityStatus | 'ALL') {
  const data = await prisma.opportunity.findMany({
    where: status && status !== 'ALL' ? { status } : {},
    include: {
      client:  { select: { name: true, clientId: true } },
      owner:   { select: { name: true } },
      coOwner: { select: { name: true } },
      _count:  { select: { comments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return serialize(data)
}

// ✅ DETAIL VIEW
export async function getOpportunityDetail(opportunityId: string) {
  const data = await prisma.opportunity.findUnique({
    where: { opportunityId },
    include: {
      client: { include: { pocs: true } },
      owner: true,
      coOwner: true,
      pricingVersions: {
        include: {
          staffingResources: {
            include: { weeklyHours: { orderBy: { weekStartDate: 'asc' } }, rateCard: true },
          },
          scheduleOfPayments: { orderBy: { month: 'asc' } },
          financialSnapshots: { orderBy: { month: 'asc' } },
        },
        orderBy: { versionNumber: 'asc' },
      },
      otherCosts: { orderBy: [{ month: 'asc' }, { createdAt: 'asc' }] },
      approvalRequests: {
        include: { requestedBy: true, approver: true },
        orderBy: { requestedAt: 'desc' },
      },
      comments: {
        include: {
          author: true,
          replies: { include: { author: true } },
        },
        where: { parentId: null },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  return serialize(data)
}

// ✅ DASHBOARD STATS
export async function getDashboardStats() {
  const [counts, oppsForPipeline] = await Promise.all([
    prisma.opportunity.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    // Fetch all active opportunities with their final pricing to compute weighted revenue
    prisma.opportunity.findMany({
      where: { isActive: true },
      select: {
        estimatedRevenue: true,
        probability:      true,
        pricingVersions: {
          where: { isFinal: true },
          select: { proposedBillings: true },
          take: 1,
        },
      },
    }),
  ])

  // Weighted estimated revenue:
  // - If final pricing exists → use proposedBillings
  // - Else if estimatedRevenue + probability are set → estimatedRevenue × (probability / 100)
  let estimatedRevenue = 0
  for (const opp of oppsForPipeline) {
    const finalBillings = opp.pricingVersions[0]?.proposedBillings
    if (finalBillings != null) {
      estimatedRevenue += Number(finalBillings)
    } else if (opp.estimatedRevenue != null && opp.probability != null) {
      estimatedRevenue += opp.estimatedRevenue * (opp.probability / 100)
    }
  }

  const byStatus = Object.fromEntries(
    counts.map(c => [c.status, c._count._all])
  )

  return {
    total:            counts.reduce((s, c) => s + c._count._all, 0),
    open:             byStatus['OPEN']      ?? 0,
    won:              byStatus['WON']       ?? 0,
    lost:             byStatus['LOST']      ?? 0,
    abandoned:        byStatus['ABANDONED'] ?? 0,
    estimatedRevenue,
  }
}