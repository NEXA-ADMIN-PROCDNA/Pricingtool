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
