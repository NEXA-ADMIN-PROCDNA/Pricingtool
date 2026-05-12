import AzureADProvider from "next-auth/providers/azure-ad"
import { prisma } from "@/lib/prisma"

// Azure AD usageLocation is a 2-letter ISO code (IN, US, GB, …)
function mapLocation(usageLocation) {
  if (!usageLocation) return null
  if (usageLocation === 'IN') return 'INDIA'
  if (usageLocation === 'US') return 'US'
  return null
}

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
  ],

  callbacks: {
    async signIn({ account, profile }) {
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
      if (trigger === 'signIn' || !token.id) {
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
      session.user.id       = token.id
      session.user.role     = token.role
      session.user.location = token.location
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
