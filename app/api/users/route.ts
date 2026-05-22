import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const users = await prisma.user.findMany({ where: { isActive: true } })
    return NextResponse.json(users)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((token.role as string) !== 'ADMIN') return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 })

  try {
    const body = await req.json()

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        role: body.role ?? 'BD',
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
