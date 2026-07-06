// ─────────────────────────────────────────────────────────────────────────────
// db/opportunities.ts — opportunity read layer + the RBAC core.
//
// Big picture: server components call these helpers to fetch opportunities. The
// key function is resolveOwnerFilter() — it turns the signed-in user's ROLE into a
// Prisma `where` fragment, which is how row-level access control is enforced (SEL
// sees own, DIRECTOR/ED see down the hierarchy, PARTNER/ADMIN see all).
//
// serialize() exists because Prisma returns Decimal objects for money fields;
// React state needs plain numbers, so it deep-converts Decimal → Number.
//
// RISK 1: resolveOwnerFilter scopes by ROLE, not by TEAM — a DIRECTOR sees EVERY
// SEL's deals company-wide (no managerId traversal). Intended simplification, but
// it's cross-team data exposure. (See audit S8.)
// RISK 2: this filter only guards the READS in this file. Most MUTATING API routes
// don't apply an equivalent check, so they're IDOR-able by opportunity id. (S5.)
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '@/lib/prisma'
import { OpportunityStatus } from '@prisma/client'

// Called when a SOW_VERIFICATION approval is approved.
export async function setOpportunityWon(internalId: string) {
  await prisma.opportunity.update({ where: { id: internalId }, data: { status: 'WON' } })
}

export type OpportunityRow    = Awaited<ReturnType<typeof getOpportunities>>[number]
export type OpportunityDetail = NonNullable<Awaited<ReturnType<typeof getOpportunityDetail>>>

// Auth context passed in from server components
export type AuthCtx = { userId: string; role: string }

// Decimal → number serializer; preserves all other types
function serialize<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      value?.constructor?.name === 'Decimal' ? Number(value) : value
    )
  ) as T
}

// Returns a Prisma `where` fragment that scopes opportunities by role hierarchy:
//   SEL      → own only
//   DIRECTOR → own + any SEL-owned
//   ED       → own + any DIRECTOR or SEL-owned
//   PARTNER  → all
//   ADMIN    → all
function resolveOwnerFilter(auth: AuthCtx): object {
  const { userId, role } = auth

  if (role === 'ADMIN' || role === 'PARTNER') return {}

  if (role === 'SEL') return { ownerId: userId }

  if (role === 'DIRECTOR') return {
    OR: [
      { ownerId: userId },
      { owner: { role: 'SEL' } },
    ],
  }

  if (role === 'ED') return {
    OR: [
      { ownerId: userId },
      { owner: { role: { in: ['DIRECTOR', 'SEL'] } } },
    ],
  }

  // Unknown role — fail closed
  return { ownerId: userId }
}

// ✅ LIST VIEW
export async function getOpportunities(
  status?: OpportunityStatus | 'ALL',
  q?: string,
  auth?: AuthCtx,
) {
  const search      = q?.trim()
  const ownerFilter = auth ? resolveOwnerFilter(auth) : {}

  const data = await prisma.opportunity.findMany({
    where: {
      isActive: true,
      ...ownerFilter,
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(search ? {
        OR: [
          { opportunityName: { contains: search, mode: 'insensitive' } },
          { client: { name: { contains: search, mode: 'insensitive' } } },
        ],
      } : {}),
    },
    select: {
      id: true,
      opportunityId: true,
      opportunityName: true,
      status: true,
      stage: true,
      primaryLob: true,
      startDate: true,
      endDate: true,
      estimatedRevenue: true,
      probability: true,
      projectCodeProceed: true,
      createdAt: true,
      client:   { select: { name: true, clientId: true } },
      owner:    { select: { id: true, name: true } },
      coOwner:  { select: { id: true, name: true } },
      _count:  { select: { comments: true } },
      pricingVersions: {
        where:  { isFinal: true },
        select: { proposedBillings: true },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return serialize(data)
}

// ✅ DETAIL VIEW
export async function getOpportunityDetail(opportunityId: string, auth?: AuthCtx) {
  const ownerFilter = auth ? resolveOwnerFilter(auth) : {}

  const data = await prisma.opportunity.findFirst({
    where: { opportunityId, ...ownerFilter },
    include: {
      client: { include: { pocs: true } },
      owner: true,
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
      otherCosts:    { orderBy: [{ month: 'asc' }, { createdAt: 'asc' }] },
      sowDocuments:  { where: { isActive: true }, orderBy: { uploadedAt: 'desc' } },
      poDocuments:   { where: { isActive: true }, orderBy: { uploadedAt: 'desc' } },
      approvalRequests: {
        include: { requestedBy: true, approver: true, approver2: true },
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
export async function getDashboardStats(auth?: AuthCtx) {
  const ownerFilter = auth ? resolveOwnerFilter(auth) : {}

  const [counts, oppsForPipeline] = await Promise.all([
    prisma.opportunity.groupBy({
      by: ['status'],
      where: ownerFilter,
      _count: { _all: true },
    }),
    prisma.opportunity.findMany({
      // Lost/Abandoned opps stay visible (and get auto-archived later) but must
      // not inflate pipeline/weighted revenue, so exclude them from the sum here.
      where: { isActive: true, status: { notIn: ['LOST', 'ABANDONED'] }, ...ownerFilter },
      select: {
        estimatedRevenue:   true,
        probability:        true,
        status:             true,
        projectCodeProceed: true,
        pricingVersions: {
          where:  { isFinal: true },
          select: { proposedBillings: true },
          take: 1,
        },
      },
    }),
  ])

  let estimatedRevenue = 0
  let weightedRevenue  = 0
  for (const opp of oppsForPipeline) {
    const finalBillings = opp.pricingVersions[0]?.proposedBillings
    const raw = finalBillings != null ? Number(finalBillings) : (opp.estimatedRevenue ?? 0)
    estimatedRevenue += raw
    // WON + project code confirmed → effectively certain, treat as 100%
    const certain = opp.status === 'WON' && opp.projectCodeProceed
    const probPct = certain ? 100 : (opp.probability ?? 100)
    weightedRevenue += raw * (probPct / 100)
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
    weightedRevenue,
  }
}
