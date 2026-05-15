import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: opportunityId } = await params
  const body = await req.json() as { preContractAgreed?: boolean }

  const opp = await prisma.opportunity.findUnique({ where: { opportunityId } })
  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (typeof body.preContractAgreed === 'boolean') {
    await prisma.opportunity.update({
      where: { id: opp.id },
      data:  { preContractAgreed: body.preContractAgreed },
    })
  }

  const updated = await prisma.opportunity.findUnique({
    where:  { id: opp.id },
    select: { status: true, preContractAgreed: true },
  })

  return NextResponse.json(updated)
}
