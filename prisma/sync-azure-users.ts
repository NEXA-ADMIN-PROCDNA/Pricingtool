/**
 * Pulls users from Microsoft Azure AD (via Graph API) and upserts them
 * into the Supabase `users` table with the correct UserRole.
 *
 * Only users whose Azure AD jobTitle maps to SEL, DIRECTOR, ED, or PARTNER
 * are synced. Everyone else is skipped with a warning.
 *
 * Usage:
 *   npx tsx prisma/sync-azure-users.ts
 *Everybody is SE NOW
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
// User.ReadBasic.All fields: id, displayName, givenName, surname, mail, userPrincipalName
// jobTitle is NOT in ReadBasic — we request it anyway; some tenants return it, others return null.
async function fetchAllAzureUsers(graphClient: Client): Promise<GraphUser[]> {
  const users: GraphUser[] = []
  let url: string | undefined =
    '/users?$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle&$top=999'

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
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env

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
  console.log(`  Found ${azureUsers.length} total Azure AD users\n`)

  // Track results for the role-assignment report
  const synced:      { name: string; email: string; role: string; source: string }[] = []
  const needsRole:   { name: string; email: string; jobTitle: string | null }[]       = []
  let skipped = 0

  for (const azUser of azureUsers) {
    const email = azUser.mail ?? azUser.userPrincipalName
    const name  = azUser.displayName

    if (!email || !name) {
      skipped++
      continue
    }

    // Only sync ProcDNA staff
    if (!email.toLowerCase().endsWith('@procdna.com')) {
      skipped++
      continue
    }

    // Skip service accounts / guests
    if (email.includes('#EXT#') || !name.trim()) {
      skipped++
      continue
    }

    const role = mapTitleToRole(azUser.jobTitle)

    if (role) {
      // jobTitle was readable and mapped — upsert with correct role
      await prisma.user.upsert({
        where:  { email },
        update: { name, role, kindeId: azUser.id, isActive: true },
        create: { email, name, role, kindeId: azUser.id, isActive: true },
      })
      synced.push({ name, email, role, source: `jobTitle: "${azUser.jobTitle}"` })
    } else {
      // jobTitle missing or unrecognised — upsert as SEL (most restrictive default)
      // and flag for manual role assignment
      await prisma.user.upsert({
        where:  { email },
        update: { name, kindeId: azUser.id, isActive: true },
        create: { email, name, role: 'SEL', kindeId: azUser.id, isActive: true },
      })
      needsRole.push({ name, email, jobTitle: azUser.jobTitle })
    }
  }

  // ── Summary report ────────────────────────────────────────────────
  console.log('─'.repeat(70))
  console.log(`✅  SYNCED WITH ROLE (${synced.length})`)
  console.log('─'.repeat(70))
  for (const u of synced) {
    console.log(`  ${u.role.padEnd(10)} ${u.name.padEnd(30)} ${u.email}`)
    console.log(`             └─ ${u.source}`)
  }

  if (needsRole.length > 0) {
    console.log('\n' + '─'.repeat(70))
    console.log(`⚠️   SYNCED AS SEL — NEEDS MANUAL ROLE ASSIGNMENT (${needsRole.length})`)
    console.log('─'.repeat(70))
    console.log('  jobTitle was null or unrecognised (User.ReadBasic.All likely blocked it).')
    console.log('  Run the SQL below in Supabase SQL Editor to fix roles:\n')
    for (const u of needsRole) {
      console.log(`  -- ${u.name} (jobTitle: ${u.jobTitle ?? 'null'})`)
      console.log(`  UPDATE procdna_database.users SET role = 'DIRECTOR' WHERE email = '${u.email}';\n`)
    }
  }

  if (skipped > 0) {
    console.log(`\nSkipped ${skipped} service accounts / guests.`)
  }

  console.log(`\nDone. Synced: ${synced.length + needsRole.length}  Skipped: ${skipped}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
