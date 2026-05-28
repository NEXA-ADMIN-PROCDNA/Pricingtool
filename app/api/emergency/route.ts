import { NextRequest, NextResponse } from 'next/server'
import { encode } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token || token !== process.env.EMERGENCY_TOKEN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminUser = await prisma.user.findFirst({
    where:  { role: 'ADMIN', isActive: true },
    select: { id: true, name: true, email: true, role: true, location: true },
  })

  if (!adminUser) {
    return NextResponse.json({ error: 'No admin user found in DB' }, { status: 500 })
  }

  const secret = process.env.NEXTAUTH_SECRET!
  const now    = Math.floor(Date.now() / 1000)

  const jwt = await encode({
    secret,
    token: {
      name:     adminUser.name,
      email:    adminUser.email,
      id:       adminUser.id,
      role:     adminUser.role,
      location: adminUser.location,
      iat:      now,
      exp:      now + 8 * 60 * 60,
    },
  })

  const isSecure   = req.nextUrl.protocol === 'https:'
  const cookieName = isSecure ? '__Secure-next-auth.session-token' : 'next-auth.session-token'

  const res = NextResponse.redirect(new URL('/dashboard', req.url))
  res.cookies.set(cookieName, jwt, {
    httpOnly: true,
    secure:   isSecure,
    sameSite: 'lax',
    maxAge:   8 * 60 * 60,
    path:     '/',
  })

  return res
}
