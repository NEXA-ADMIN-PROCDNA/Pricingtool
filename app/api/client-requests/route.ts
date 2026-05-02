import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const requests = await prisma.clientRequest.findMany({
    where: { status: 'PENDING' },
    include: { requestedBy: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(requests)
}

export async function POST(req: NextRequest) {
  try {
    const { name, businessUnit, industry, region, notes, requestedById } = await req.json()
    if (!name?.trim() || !requestedById) {
      return NextResponse.json({ error: 'name and requestedById are required' }, { status: 400 })
    }

    const request = await prisma.clientRequest.create({
      data: {
        name: name.trim(),
        businessUnit: businessUnit?.trim() || null,
        industry: industry?.trim() || null,
        region: region?.trim() || null,
        notes: notes?.trim() || null,
        requestedById,
      },
    })
    return NextResponse.json(request, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 })
  }
}
