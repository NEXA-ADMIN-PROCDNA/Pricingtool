// ─────────────────────────────────────────────────────────────────────────────
// /api/emergency — break-glass admin login. PUBLIC (excluded from proxy auth).
//
// Big picture: a backdoor for when SSO is broken. Hit it with ?token=EMERGENCY_TOKEN
// and it mints an 8-hour ADMIN session cookie for the first active admin user, then
// redirects to /dashboard. Exists so you can never fully lock yourself out.
//
// RISK (high): the secret travels in the URL query string → it lands in server/proxy
// access logs, browser history and Referer headers. It is static, with no rate limit
// and no IP gate — anyone who learns the token gets permanent admin. On AWS (no
// platform shield) it's directly brute-forceable: front it with a WAF/IP allow-list,
// make it POST, give it a short TTL, or drop it in prod. (See audit S2 / A4.)
// NOTE (AWS): it picks the cookie name from req.protocol === 'https:'. Behind an
// Nginx/ALB that terminates TLS the app sees http → wrong/insecure cookie. Trust the
// X-Forwarded-Proto header instead. (See audit A2.)
// ─────────────────────────────────────────────────────────────────────────────
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
