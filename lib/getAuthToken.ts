import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

// Wrapper around next-auth's getToken that explicitly passes the secret + cookie
// name. NextAuth's auto-detection of these values reads process.env at runtime,
// which doesn't work reliably across all Vercel deploy environments (depends on
// whether env vars get inlined into the build for that specific route). Passing
// them explicitly here forces Next.js to inline NEXTAUTH_SECRET at build time
// and removes the cookie-name guessing entirely.
export function getAuthToken(req: NextRequest) {
  // Pick the session-cookie name from the cookie the request actually carries —
  // NOT from NEXTAUTH_URL. On Vercel's Edge runtime env vars aren't reliably
  // inlined (the reason the secret is passed explicitly below), so deriving the
  // name from process.env would read `undefined` and break. Detecting from the
  // incoming cookie keeps getToken in lockstep with whatever NextAuth wrote, on
  // either transport, with zero env dependency:
  //   • HTTPS (e.g. Vercel)   → "__Secure-next-auth.session-token"
  //   • plain HTTP (e.g. EC2) → "next-auth.session-token"
  const useSecureCookies = req.cookies.has('__Secure-next-auth.session-token')
  return getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: useSecureCookies,
    cookieName: useSecureCookies
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token',
  })
}
