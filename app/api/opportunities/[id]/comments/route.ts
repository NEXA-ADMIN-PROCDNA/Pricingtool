import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: opportunityId } = await params
  const { content, parentId } = await req.json()

  if (!content?.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  const opp = await prisma.opportunity.findUnique({
    where: { opportunityId },
    select: { id: true },
  })
  if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })

  const comment = await prisma.comment.create({
    data: {
      opportunityId: opp.id,
      authorId: session.user.id,
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
