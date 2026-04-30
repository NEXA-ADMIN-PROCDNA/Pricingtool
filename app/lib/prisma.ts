import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const g = globalThis as unknown as { _prisma?: PrismaClient }

function makePrisma(): PrismaClient {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool, { schema: 'procdna_database' })
  return new PrismaClient({ adapter })
}

export const prisma: PrismaClient = g._prisma ?? makePrisma()

if (process.env.NODE_ENV !== 'production') g._prisma = prisma
