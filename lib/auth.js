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

      const location = mapLocation(profile.usageLocation)

      // Upsert: create on first login, update name/azureId/location on subsequent logins
      await prisma.user.upsert({
        where:  { email: profile.email },
        update: {
          name:    profile.name ?? profile.email,
          azureId: profile.sub,
          ...(location !== null && { location }),
        },
        create: {
          email:   profile.email,
          name:    profile.name ?? profile.email,
          role:    'SEL',       // default — admin promotes as needed
          azureId: profile.sub,
          location,
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

  pages: {
    signIn: '/login',
  },
}
