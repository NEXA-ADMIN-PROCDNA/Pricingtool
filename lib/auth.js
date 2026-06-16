// ─────────────────────────────────────────────────────────────────────────────
// auth.js — NextAuth configuration (the identity brain of the app).
//
// Big picture: defines HOW people sign in and WHAT ends up in their session.
// Two providers:
//   1. Azure AD (the real path) — corporate SSO. We only admit users who were
//      pre-provisioned by the sync script (the signIn callback rejects unknowns).
//   2. Credentials (/login2 backup) — email + one shared CREDENTIALS_SECRET.
//
// The callbacks are the important part:
//   • signIn  — the gate: provisioned + active users only; refreshes azureId.
//   • jwt     — stamps id/role/location INTO the token at sign-in so later
//               requests don't need a DB hit to know who you are.
//   • session — copies those onto session.user for the client.
//
// RISK 1 (critical): the Credentials provider uses ONE shared password for ALL
// users and logs you in as whatever email you type — leak that secret and anyone
// can be anyone, including ADMIN. (See audit S1.)
// RISK 2 (medium): role/location are cached in the JWT for the 8h session and only
// refreshed on re-sign-in — deactivating a user or changing a role doesn't take
// effect until the token expires. No real-time revocation. (See audit S9.)
// ─────────────────────────────────────────────────────────────────────────────
import AzureADProvider from "next-auth/providers/azure-ad"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"

// Azure AD usageLocation is a 2-letter ISO code (IN, US, GB, …)
function mapLocation(usageLocation) {
  if (!usageLocation) return null
  if (usageLocation === 'IN') return 'INDIA'
  if (usageLocation === 'US') return 'US'
  return null
}

/** @type {import('next-auth').NextAuthOptions} */
export const authOptions = {
  providers: [
    AzureADProvider({
      clientId:     process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId:     process.env.AZURE_AD_TENANT_ID,
      authorization: {
        params: { scope: 'openid profile email User.Read' },
      },
    }),

    CredentialsProvider({
      name: 'Email',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // RISK (critical): this compares the typed password against a SINGLE shared
        // secret, then trusts the typed email — so anyone holding CREDENTIALS_SECRET
        // can sign in as ANY existing active user. There is no per-user password.
        const secret = process.env.CREDENTIALS_SECRET
        if (!secret || !credentials?.password || credentials.password !== secret) return null

        const user = await prisma.user.findUnique({
          where:  { email: credentials.email },
          select: { id: true, email: true, name: true, isActive: true },
        })

        if (!user || !user.isActive) return null
        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],

  callbacks: {
    async signIn({ account, profile }) {
      // credentials provider handles validation in authorize() above
      if (account?.provider === 'credentials') return true
      if (account?.provider !== 'azure-ad') return false
      if (!profile?.email) return false

      // Only allow users already provisioned by the sync script
      const existing = await prisma.user.findUnique({
        where:  { email: profile.email },
        select: { id: true, isActive: true },
      })

      if (!existing)          return '/login?error=not_provisioned'
      if (!existing.isActive) return '/login?error=account_disabled'

      // Update azureId and location if they came through in the token
      const location = mapLocation(profile.usageLocation)
      await prisma.user.update({
        where: { email: profile.email },
        data: {
          azureId: profile.sub,
          ...(location !== null && { location }),
        },
      })

      return true
    },

    async jwt({ token, trigger }) {
      // On every sign-in (trigger === 'signIn') re-fetch from DB so token has current role/location
      if ((trigger === 'signIn' || !token.id) && token.email) {
        const dbUser = await prisma.user.findUnique({
          where:  { email: token.email },
          select: { id: true, role: true, location: true },
        })
        if (dbUser) {
          token.id       = dbUser.id
          token.role     = dbUser.role
          token.location = dbUser.location
        }
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id       = token.id
        session.user.role     = token.role
        session.user.location = token.location
      }
      return session
    },
  },

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60,  // 8 hours
  },

  pages: {
    signIn: '/login',
  },
}
