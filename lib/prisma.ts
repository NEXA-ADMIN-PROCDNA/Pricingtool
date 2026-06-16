// ─────────────────────────────────────────────────────────────────────────────
// prisma.ts — the database client singleton (THE only DB handle in the app).
//
// Big picture: every server file imports `{ prisma }` from here. It wraps a
// node-postgres Pool with Prisma's pg adapter, pinned to the `procdna_database`
// schema (the app deliberately uses a non-default Postgres schema; multi-schema
// is enabled). A single instance is reused via globalThis so dev hot-reload
// doesn't open a new pool on every save and warm instances reuse the connection.
//
// RISK (AWS): `max = 1` in production is correct for Vercel serverless (one short
// connection per function; the Supabase pgBouncer fans out). On a single
// long-lived EC2 process this means the ENTIRE app serialises through ONE DB
// connection — feels fine in testing, falls over the instant two users hit it at
// once. Raise the pool size on EC2. (See audit A1.)
// ─────────────────────────────────────────────────────────────────────────────
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const g = globalThis as unknown as { _prisma?: PrismaClient }

function makePrisma(): PrismaClient {
  // In production (Vercel serverless) keep max=1 — each function instance needs
  // at most one connection. Transaction-mode pooler (port 6543) handles concurrency.
  const max = process.env.NODE_ENV === 'production' ? 1 : 3
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max })
  const adapter = new PrismaPg(pool, { schema: 'procdna_database' })
  return new PrismaClient({ adapter })
}

// Singleton in dev so hot-reload doesn't open a new pool every save.
// In production each module evaluation reuses the same warm-lambda instance.
export const prisma: PrismaClient = g._prisma ?? makePrisma()

if (process.env.NODE_ENV !== 'production') g._prisma = prisma
