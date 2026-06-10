import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'

export async function proxy(req: NextRequest) {
  // Uses the shared helper so the cookie name/security it looks for always
  // matches what NextAuth set (https → Secure cookie, http → plain cookie).
  const token = await getAuthToken(req)

  if (!token) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!login|login2|api/auth|api/approvals/email-action|api/emergency|_next/static|_next/image|favicon.ico).*)'],
}
