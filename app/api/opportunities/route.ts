// ─────────────────────────────────────────────────────────────────────────────
// /api/opportunities — list (GET) and create (POST) opportunities.
//
// Big picture: GET applies RBAC via getOpportunities(auth) so each role sees only
// what it should. POST generates the next human id (OPP-YY-NNNN, resets each year),
// creates the opportunity owned by the caller (ownerId from the token), and
// optionally attaches new POCs.
//
// RISK: nextOpportunityId() does a read-then-insert with no lock — two concurrent
// creates can compute the same id (collision), and the desc string ordering
// mis-sorts once the counter passes 9999. (See audit C4.) POST also doesn't check
// the dates parse (garbage → 500) and uses parseInt on revenue ("1.5M" → 1). (C7.)
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { getOpportunities } from '@/lib/db/opportunities'
import { OpportunityStage } from '@prisma/client'
import { apiError } from '@/lib/errors'

// New numbering scheme: OPP-YY-NNNN, where YY is the 2-digit creation year
// (sourced from JS Date at insert time — the row's createdAt is stamped in the
// same transaction so the two always agree). NNNN resets each calendar year.
// Old BD-NNN rows are left untouched; the startsWith filter ignores them when
// computing the next number in the current year.
async function nextOpportunityId(): Promise<string> {
  const yy     = String(new Date().getFullYear() % 100).padStart(2, '0')
  const prefix = `OPP-${yy}-`

  const last = await prisma.opportunity.findFirst({
    where:   { opportunityId: { startsWith: prefix } },
    orderBy: { opportunityId: 'desc' },
    select:  { opportunityId: true },
  })

  if (!last) return `${prefix}0001`

  const n = parseInt(last.opportunityId.slice(prefix.length), 10)
  return `${prefix}${String(n + 1).padStart(4, '0')}`
}

export async function GET(req: NextRequest) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const userId = token.id as string | undefined
  const role   = token.role as string | undefined
  const auth   = userId && role ? { userId, role } : undefined

  const opps = await getOpportunities(undefined, undefined, auth)
  return NextResponse.json(opps)
}

export async function POST(req: NextRequest) {
  try {
    const token = await getAuthToken(req)
    const ownerId = token?.id as string | undefined
    if (!ownerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      clientId,
      opportunityName,
      workType,
      businessUnit,
      stage,
      startDate,
      endDate,
      starConnect,
      estimatedRevenue,
      probability,
      pocs,
    } = body

    if (!clientId || !opportunityName || !startDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const parsedEstimatedRevenue = estimatedRevenue ? parseInt(String(estimatedRevenue), 10) : null
    const parsedProbability      = probability      ? parseInt(String(probability),      10) : null

    const opportunityId = await nextOpportunityId()

    const opp = await prisma.opportunity.create({
      data: {
        opportunityId,
        clientId,
        opportunityName,
        workType:         workType?.trim() || null,
        businessUnit:     businessUnit?.trim() || null,
        stage:            (stage as OpportunityStage) ?? 'LEAD',
        ownerId,
        startDate:        new Date(startDate),
        endDate:          endDate ? new Date(endDate) : new Date(startDate),
        starConnect:      starConnect === 'true' || starConnect === true,
        estimatedRevenue: parsedEstimatedRevenue,
        probability:      parsedProbability,
      },
    })

    // Create any new POCs linked to the client
    if (Array.isArray(pocs) && pocs.length > 0) {
      await prisma.clientPOC.createMany({
        data: pocs
          .filter((p: { name: string; email: string; phone: string }) => p.name?.trim())
          .map((p: { name: string; email: string; phone: string }) => ({
            clientId,
            name:  p.name.trim(),
            email: p.email?.trim() || null,
            phone: p.phone?.trim() || null,
          })),
      })
    }

    return NextResponse.json(opp, { status: 201 })
  } catch (err) {
    console.error(err)
    return apiError('OPP_CREATE_FAILED')
  }
}
