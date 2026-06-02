import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const { id: opportunityId } = await params
  const body = await req.json() as { preContractAgreed?: boolean; status?: string; projectCodeProceed?: boolean }

  const opp = await prisma.opportunity.findUnique({ where: { opportunityId } })
  if (!opp) return apiError('OPP_NOT_FOUND')

  if (typeof body.preContractAgreed === 'boolean') {
    await prisma.opportunity.update({
      where: { id: opp.id },
      data:  { preContractAgreed: body.preContractAgreed },
    })

    if (body.preContractAgreed && opp.stage === 'SOW_PENDING') {
      await prisma.opportunity.update({ where: { id: opp.id }, data: { stage: 'SOW_SUBMITTED' } })
    } else if (!body.preContractAgreed && opp.stage === 'SOW_SUBMITTED') {
      const [sowCount, poCount] = await Promise.all([
        prisma.sOWDocument.count({ where: { opportunityId: opp.id, isActive: true } }),
        prisma.pODocument.count({ where: { opportunityId: opp.id, isActive: true } }),
      ])
      if (sowCount === 0 && poCount === 0) {
        await prisma.opportunity.update({ where: { id: opp.id }, data: { stage: 'SOW_PENDING' } })
      }
    }
  }

  if (
    body.status === 'OPEN' ||
    body.status === 'WON' ||
    body.status === 'LOST' ||
    body.status === 'ABANDONED'
  ) {
    await prisma.opportunity.update({
      where: { id: opp.id },
      data:  { status: body.status as 'OPEN' | 'WON' | 'LOST' | 'ABANDONED' },
    })
  }

  if (body.projectCodeProceed === true) {
    await prisma.opportunity.update({
      where: { id: opp.id },
      data:  { projectCodeProceed: true },
    })
  }

  const updated = await prisma.opportunity.findUnique({
    where:  { id: opp.id },
    select: { status: true, preContractAgreed: true, stage: true, projectCodeProceed: true },
  })

  return NextResponse.json(updated)
}
