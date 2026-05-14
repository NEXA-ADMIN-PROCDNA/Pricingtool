import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const pool    = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool, { schema: 'procdna_database' })
const prisma  = new PrismaClient({ adapter })

async function main() {
  const user = await prisma.user.create({
    data: {
      email:    'piyusha.sahni@procdna.com',
      name:     'Piyusha Sahni',
      role:     'ADMIN',
      location: 'INDIA',
      isActive: true,
    },
  })
  console.log('Created:', user.id, user.email, user.role)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
  //  added admin .
  // npx tsx prisma/add-admin.ts 
  // duplicates not entered