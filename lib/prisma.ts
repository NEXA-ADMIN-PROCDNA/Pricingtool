// ─────────────────────────────────────────────────────────────────────────────
// prisma.ts — the database client singleton (THE only DB handle in the app).
//
// Big picture: every server file imports `{ prisma }` from here. It wraps a
// node-postgres Pool with Prisma's pg adapter. The Postgres schema and pool size
// come from the DATABASE_URL query string (`?schema=...&connection_limit=...`),
// so the same build runs against Supabase (`procdna_database`, pooled, max 1)
// and AWS RDS (`nexa_dev`, long-lived container, bigger pool) with no code or
// task-definition change. Defaults preserve the old Vercel/Supabase behaviour.
// A single instance is reused via globalThis so dev hot-reload doesn't open a
// new pool on every save and warm instances reuse the connection.
// ─────────────────────────────────────────────────────────────────────────────
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const g = globalThis as unknown as { _prisma?: PrismaClient }

function makePrisma(): PrismaClient {
  const url = process.env.DATABASE_URL ?? ''

  // Defaults match the legacy Vercel/Supabase setup: procdna_database schema,
  // max=1 in production (serverless — pgBouncer handles concurrency).
  let schema = 'procdna_database'
  let max = process.env.NODE_ENV === 'production' ? 1 : 3
  try {
    const params = new URL(url).searchParams
    schema = params.get('schema') ?? schema
    const limit = Number(params.get('connection_limit'))
    if (Number.isFinite(limit) && limit > 0) max = limit
  } catch {
    // Unparseable URL — let pg surface the real connection error.
  }

  const pool = new Pool({ connectionString: url, max })
  const adapter = new PrismaPg(pool, { schema })
  return new PrismaClient({ adapter })
}

// Singleton in dev so hot-reload doesn't open a new pool every save.
// In production each module evaluation reuses the same warm-lambda instance.
export const prisma: PrismaClient = g._prisma ?? makePrisma()

if (process.env.NODE_ENV !== 'production') g._prisma = prisma
