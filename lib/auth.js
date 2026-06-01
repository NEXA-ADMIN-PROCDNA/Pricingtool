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
      console.log('[auth.signIn] provider:', account?.provider, 'profile keys:', profile ? Object.keys(profile) : null, 'email:', profile?.email)
      // credentials provider handles validation in authorize() above
      if (account?.provider === 'credentials') return true
      if (account?.provider !== 'azure-ad') { console.log('[auth.signIn] DENY: provider not azure-ad'); return false }
      if (!profile?.email) { console.log('[auth.signIn] DENY: profile.email is falsy. Full profile:', JSON.stringify(profile)); return false }

      // Only allow users already provisioned by the sync script
      let existing
      try {
        existing = await prisma.user.findUnique({
          where:  { email: profile.email },
          select: { id: true, isActive: true },
        })
      } catch (e) {
        console.log('[auth.signIn] DENY: prisma.findUnique threw:', e?.message)
        return false
      }
      console.log('[auth.signIn] db lookup result:', existing)

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

  debug: true,
}
