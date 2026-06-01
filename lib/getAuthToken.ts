import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

// Wrapper around next-auth's getToken that explicitly passes the secret + cookie
// name. NextAuth's auto-detection of these values reads process.env at runtime,
// which doesn't work reliably across all Vercel deploy environments (depends on
// whether env vars get inlined into the build for that specific route). Passing
// them explicitly here forces Next.js to inline NEXTAUTH_SECRET at build time
// and removes the cookie-name guessing entirely.
export function getAuthToken(req: NextRequest) {
  return getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: true,
    cookieName: '__Secure-next-auth.session-token',
  })
}
