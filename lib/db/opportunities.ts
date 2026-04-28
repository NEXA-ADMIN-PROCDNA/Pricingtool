import { prisma } from '@/lib/prisma'
import { OpportunityStatus } from '@prisma/client'

export type OpportunityRow = Awaited<ReturnType<typeof getOpportunities>>[number]
export type OpportunityDetail = NonNullable<Awaited<ReturnType<typeof getOpportunityDetail>>>

export async function getOpportunities(status?: OpportunityStatus | 'ALL') {
  return prisma.opportunity.findMany({
    where: status && status !== 'ALL' ? { status } : {},
    include: {
      client: { select: { name: true, clientId: true } },
      owner:   { select: { name: true } },
      coOwner: { select: { name: true } },
      pricingVersions: {
        where: { isFinal: true },
        select: { proposedBillings: true, grossMarginPct: true },
        take: 1,
      },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getOpportunityDetail(opportunityId: string) {
  return prisma.opportunity.findUnique({
    where: { opportunityId },
    include: {
      client: { include: { pocs: true } },
      owner: true,
      coOwner: true,
      pricingVersions: {
        include: {
          staffingResources: {
            include: { weeklyHours: true, rateCard: true },
          },
          scheduleOfPayments: { orderBy: { month: 'asc' } },
          financialSnapshots: { orderBy: { month: 'asc' } },
        },
        orderBy: { versionNumber: 'desc' },
      },
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
}

export async function getDashboardStats() {
  const [counts, billing] = await Promise.all([
    prisma.opportunity.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.pricingVersion.aggregate({
      where: { isFinal: true },
      _sum: { proposedBillings: true },
      _avg: { grossMarginPct: true },
    }),
  ])

  const byStatus = Object.fromEntries(counts.map(c => [c.status, c._count._all]))
  return {
    total:        counts.reduce((s, c) => s + c._count._all, 0),
    open:         byStatus['OPEN']      ?? 0,
    won:          byStatus['WON']       ?? 0,
    lost:         byStatus['LOST']      ?? 0,
    abandoned:    byStatus['ABANDONED'] ?? 0,
    totalPipeline: Number(billing._sum.proposedBillings ?? 0),
    avgMargin:     Number(billing._avg.grossMarginPct   ?? 0),
  }
}
