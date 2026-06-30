// ─────────────────────────────────────────────────────────────────────────────
// proxy.ts — THE FRONT DOOR. The app's single global authentication gate.
//
// Big picture: Next.js 16 renamed the middleware convention from `middleware.ts`
// to `proxy.ts`. This function runs on EVERY request (on the Edge runtime, before
// any page or API code) and answers one question: does this request carry a valid
// session? No token → redirect to /login, remembering where they were headed
// (callbackUrl) so they land back there after signing in.
//
// Why it matters: this is what makes the entire app private. Get it wrong and you
// land in one of two failure modes — everyone locked out, or everything public.
//
// RISK: the `matcher` at the bottom is a DENYLIST of public paths. Anything listed
// there is reachable with NO authentication. Be deliberate before adding to it.
// ─────────────────────────────────────────────────────────────────────────────
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

// The matcher excludes (= leaves PUBLIC) the login pages, the NextAuth handler,
// the one-click email approval endpoint (token-protected on its own), the
// emergency admin login (env-token protected), the ALB health check (no
// session cookie on health-check requests), and Next.js static assets.
// Everything NOT matched here is forced through the auth check above.
export const config = {
  matcher: ['/((?!login|login2|api/auth|api/approvals/email-action|api/emergency|api/health|_next/static|_next/image|favicon.ico).*)'],
}
