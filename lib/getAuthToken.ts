import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

// Wrapper around next-auth's getToken that explicitly passes the secret + cookie
// name. NextAuth's auto-detection of these values reads process.env at runtime,
// which doesn't work reliably across all Vercel deploy environments (depends on
// whether env vars get inlined into the build for that specific route). Passing
// them explicitly here forces Next.js to inline NEXTAUTH_SECRET at build time
// and removes the cookie-name guessing entirely.
export function getAuthToken(req: NextRequest) {
  // Mirror NextAuth's own cookie-security rule, which keys off the NEXTAUTH_URL
  // protocol: https → Secure "__Secure-next-auth.session-token"; http → plain
  // "next-auth.session-token". Reading it here at runtime keeps getToken in
  // lockstep with the cookie NextAuth actually wrote, so auth works behind HTTPS
  // (Vercel) AND over plain HTTP (e.g. an EC2 box that has no TLS in front yet —
  // the browser refuses to store a Secure cookie over http, which silently
  // breaks login otherwise).
  const useSecureCookies = (process.env.NEXTAUTH_URL ?? '').startsWith('https://')
  return getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: useSecureCookies,
    cookieName: useSecureCookies
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token',
  })
}
