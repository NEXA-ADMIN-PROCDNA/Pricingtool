import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const pool    = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool, { schema: 'procdna_database' })
const prisma  = new PrismaClient({ adapter })

// async function main() { // editing the
//   const user = await prisma.user.update({
//     where: { email: 'piyusha.sahni@procdna.com' },
//     data:  { role: 'PARTNER' },
//   })
//   console.log('Updated:', user.id, user.email, user.role)
// }
//  For updating the existing

async function main() {
  const user = await prisma.user.create({
    data: {
      email:    'prasanna.welhal@procdna.com',
      name:     'admin',
      role:     'ADMIN',
      location: 'INDIA',
      isActive: true,
    },
  })
  console.log('Created:', user.id, user.email, user.role)
}
//for creation of new

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
  //  added admin .
  // npx tsx prisma/add-admin.ts 
  // duplicates not entered