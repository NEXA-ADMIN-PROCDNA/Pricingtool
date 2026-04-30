import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LineOfBusiness, OpportunityStage, OpportunityType } from '@prisma/client'

async function nextOpportunityId(): Promise<string> {
  const last = await prisma.opportunity.findFirst({
    orderBy: { opportunityId: 'desc' },
    select: { opportunityId: true },
  })
  if (!last) return 'BD-001'
  const n = parseInt(last.opportunityId.replace('BD-', ''), 10)
  return `BD-${String(n + 1).padStart(3, '0')}`
}

export async function GET() {
  const opps = await prisma.opportunity.findMany({
    include: {
      client:  { select: { name: true, clientId: true } },
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
  return NextResponse.json(opps)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      clientId,
      opportunityName,
      opportunityType,
      primaryLob,
      stage,
      ownerId,
      coOwnerId,
      startDate,
      endDate,
      nextSteps,
      notes,
      starConnect,
      estimatedRevenue,
      probability,
    } = body

    if (!clientId || !opportunityName || !primaryLob || !ownerId || !startDate) {
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
        stage:            (stage as OpportunityStage) ?? 'LEAD',
        ownerId,
        coOwnerId:        coOwnerId || null,
        startDate:        new Date(startDate),
        endDate:          endDate ? new Date(endDate) : new Date(startDate),
        nextSteps:        nextSteps || null,
        notes:            notes || null,
        starConnect:      starConnect === 'true' || starConnect === true,
        estimatedRevenue: parsedEstimatedRevenue,
        probability:      parsedProbability,
      },
    })

    return NextResponse.json(opp, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create opportunity' }, { status: 500 })
  }
}
