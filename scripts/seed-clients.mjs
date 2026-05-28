import 'dotenv/config'
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import path from 'path'

const require = createRequire(import.meta.url)
const XLSX    = require('xlsx')

function makePrisma() {
  const pool    = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  const adapter = new PrismaPg(pool, { schema: 'procdna_database' })
  return new PrismaClient({ adapter })
}

const prisma = makePrisma()

async function main() {
  // ── 1. Find the creator user ───────────────────────────────────
  const creator = await prisma.user.findFirst({
    where:  { email: 'shreeraj.deshmukh@procdna.com' },
    select: { id: true, name: true },
  })
  if (!creator) {
    console.error('User shreeraj.deshmukh@procdna.com not found in DB. Aborting.')
    process.exit(1)
  }
  console.log(`Using creator: ${creator.name} (${creator.id})`)

  // ── 2. Read Excel — column A = client names ────────────────────
  const wb   = XLSX.readFile(path.join(process.cwd(), 'client_list.xlsx'))
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  const names = rows
    .map(r => String(r[0] ?? '').trim())
    .filter(n => n.length > 0)

  console.log(`Found ${names.length} client names in Excel`)

  // ── 3. Find last existing CL-NNN to continue sequence ─────────
  const last = await prisma.client.findFirst({
    orderBy: { clientId: 'desc' },
    select:  { clientId: true },
  })
  let counter = last
    ? parseInt(last.clientId.replace('CL-', ''), 10) + 1
    : 1
  console.log(`Starting clientId from CL-${String(counter).padStart(3, '0')}`)

  // ── 4. Skip names that already exist (case-insensitive) ───────
  const existing     = await prisma.client.findMany({ select: { name: true } })
  const existingNames = new Set(existing.map(c => c.name.trim().toLowerCase()))

  let created = 0
  let skipped = 0

  for (const name of names) {
    if (existingNames.has(name.toLowerCase())) {
      console.log(`  SKIP (exists): ${name}`)
      skipped++
      continue
    }

    const clientId = `CL-${String(counter).padStart(3, '0')}`
    await prisma.client.create({
      data: {
        clientId,
        name,
        businessUnit: null,
        industry:     null,
        region:       null,
        isActive:     true,
        createdById:  creator.id,
      },
    })
    console.log(`  CREATED ${clientId}: ${name}`)
    counter++
    created++
  }

  console.log(`\nDone. Created: ${created}  |  Skipped (duplicates): ${skipped}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
