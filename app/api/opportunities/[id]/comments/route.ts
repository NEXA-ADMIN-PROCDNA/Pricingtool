import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getAuthToken(req)
  if (!token?.id) return apiError('UNAUTHORIZED')

  const { id: opportunityId } = await params
  const { content, parentId } = await req.json()

  if (!content?.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  const opp = await prisma.opportunity.findUnique({
    where: { opportunityId },
    select: { id: true },
  })
  if (!opp) return apiError('OPP_NOT_FOUND')

  const comment = await prisma.comment.create({
    data: {
      opportunityId: opp.id,
      authorId: token.id as string,
      content: content.trim(),
      parentId: parentId ?? null,
    },
    include: {
      author: true,
      replies: { include: { author: true } },
    },
  })

  return NextResponse.json(comment, { status: 201 })
}
