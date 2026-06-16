// ─────────────────────────────────────────────────────────────────────────────
// getAuthToken — the ONE way the whole app reads the logged-in user.
//
// Big picture: every API route and the proxy call this instead of next-auth's raw
// getToken(). It decrypts the NextAuth session cookie (a signed JWT) and returns
// { id, role, location, email, … } or null. Centralising it means the cookie-name
// and secret handling live in exactly one place.
//
// Why the explicit params: on Vercel's Edge runtime NextAuth's auto-detection of
// the secret and cookie name is unreliable (env vars aren't always inlined into
// the bundle), which caused silent login loops and 401s. Passing them explicitly
// removes the guessing.
//
// RISK (latent login loop): the secure-cookie detection below keys off the EXACT
// cookie name. When the session JWT grows past ~4KB (e.g. a user in many Azure AD
// groups), NextAuth SPLITS it into `…session-token.0`, `.1`, … and never sets the
// un-suffixed base name — so the check returns false, the wrong name is used,
// getToken returns null, and that user is stuck redirecting to /login forever.
// Fix = also check for the `.0` chunk. (See docs/codebase-audit.html · C1.)
// ─────────────────────────────────────────────────────────────────────────────
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
