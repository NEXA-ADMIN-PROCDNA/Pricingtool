import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { getOpportunities } from '@/lib/db/opportunities'
import { LineOfBusiness, OpportunityStage, OpportunityType } from '@prisma/client'
import { apiError } from '@/lib/errors'

async function nextOpportunityId(): Promise<string> {
  const last = await prisma.opportunity.findFirst({
    orderBy: { opportunityId: 'desc' },
    select: { opportunityId: true },
  })
  if (!last) return 'BD-001'
  const n = parseInt(last.opportunityId.replace('BD-', ''), 10)
  return `BD-${String(n + 1).padStart(3, '0')}`
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req })
  if (!token) return apiError('UNAUTHORIZED')

  const userId = token.id as string | undefined
  const role   = token.role as string | undefined
  const auth   = userId && role ? { userId, role } : undefined

  const opps = await getOpportunities(undefined, undefined, auth)
  return NextResponse.json(opps)
}

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req })
    const ownerId = token?.id as string | undefined
    if (!ownerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      clientId,
      opportunityName,
      opportunityType,
      primaryLob,
      businessUnit,
      stage,
      startDate,
      endDate,
      notes,
      starConnect,
      estimatedRevenue,
      probability,
      pocs,
    } = body

    if (!clientId || !opportunityName || !primaryLob || !startDate) {
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
        opportunityType:  (opportunityType as OpportunityType) ?? 'NEW',
        primaryLob:       primaryLob as LineOfBusiness,
        businessUnit:     businessUnit?.trim() || null,
        stage:            (stage as OpportunityStage) ?? 'LEAD',
        ownerId,
        startDate:        new Date(startDate),
        endDate:          endDate ? new Date(endDate) : new Date(startDate),
        notes:            notes || null,
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
