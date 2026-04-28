/**
 * Pulls users from Microsoft Azure AD (via Graph API) and upserts them
 * into the Supabase `users` table with the correct UserRole.
 *
 * Only users whose Azure AD jobTitle maps to SEL, DIRECTOR, ED, or PARTNER
 * are synced. Everyone else is skipped with a warning.
 *
 * Usage:
 *   npx tsx prisma/sync-azure-users.ts
 *
 * Required env vars (in .env):
 *   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, DATABASE_URL
 */

import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, UserRole } from '@prisma/client'
import { ClientSecretCredential } from '@azure/identity'
import { Client } from '@microsoft/microsoft-graph-client'
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js'

// ── Prisma client ─────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool, { schema: 'procdna_database' })
const prisma = new PrismaClient({ adapter })

// ── Role mapping ──────────────────────────────────────────────────
// Keys are lowercase substrings to match against the Azure AD jobTitle.
// Adjust these to match exactly how your company titles appear in Azure AD.
const TITLE_TO_ROLE: Array<{ match: string; role: UserRole }> = [
  { match: 'partner',           role: UserRole.PARTNER   },
  { match: 'engagement director', role: UserRole.ED      },
  { match: ' ed ',              role: UserRole.ED        },
  { match: 'executive director', role: UserRole.ED       },
  { match: 'director',          role: UserRole.DIRECTOR  },
  { match: 'sel',               role: UserRole.SEL       },
  { match: 'senior engagement', role: UserRole.SEL       },
]

function mapTitleToRole(jobTitle: string | null | undefined): UserRole | null {
  if (!jobTitle) return null
  const lower = jobTitle.toLowerCase()
  for (const { match, role } of TITLE_TO_ROLE) {
    if (lower.includes(match)) return role
  }
  return null
}

// ── Graph API types ───────────────────────────────────────────────
interface GraphUser {
  id: string
  displayName: string | null
  mail: string | null
  userPrincipalName: string | null
  jobTitle: string | null
}

interface GraphResponse {
  value: GraphUser[]
  '@odata.nextLink'?: string
}

// ── Fetch all users from Azure AD (handles pagination) ────────────
async function fetchAllAzureUsers(graphClient: Client): Promise<GraphUser[]> {
  const users: GraphUser[] = []
  let url: string | undefined =
    '/users?$select=id,displayName,mail,userPrincipalName,jobTitle&$top=999'

  while (url) {
    const page: GraphResponse = await graphClient.api(url).get()
    users.push(...page.value)
    url = page['@odata.nextLink']
      ? page['@odata.nextLink'].replace('https://graph.microsoft.com/v1.0', '')
      : undefined
  }

  return users
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID } = process.env

  const { AZURE_CLIENT_SECRET } = process.env

  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    console.error('Missing AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET in .env')
    process.exit(1)
  }

  const credential = new ClientSecretCredential(AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  })
  const graphClient = Client.initWithMiddleware({ authProvider })

  console.log('Fetching users from Azure AD …')
  const azureUsers = await fetchAllAzureUsers(graphClient)
  console.log(`  Found ${azureUsers.length} total Azure AD users`)

  let synced = 0
  let skipped = 0

  for (const azUser of azureUsers) {
    const role = mapTitleToRole(azUser.jobTitle)

    if (!role) {
      // Not a role we manage — skip silently unless job title is set
      if (azUser.jobTitle) {
        console.warn(`  SKIP  "${azUser.displayName}" — unrecognised title: "${azUser.jobTitle}"`)
      }
      skipped++
      continue
    }

    // Prefer mail, fall back to userPrincipalName (guest accounts sometimes lack mail)
    const email = azUser.mail ?? azUser.userPrincipalName
    const name  = azUser.displayName

    if (!email || !name) {
      console.warn(`  SKIP  Azure ID ${azUser.id} — missing email or name`)
      skipped++
      continue
    }

    await prisma.user.upsert({
      where:  { email },
      update: {
        name,
        role,
        kindeId:  azUser.id,   // store Azure OID in kindeId for now
        isActive: true,
      },
      create: {
        email,
        name,
        role,
        kindeId:  azUser.id,
        isActive: true,
      },
    })

    console.log(`  SYNC  ${role.padEnd(8)}  ${name} <${email}>`)
    synced++
  }

  console.log(`\nDone. Synced: ${synced}  Skipped: ${skipped}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
