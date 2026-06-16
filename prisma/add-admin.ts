// ─────────────────────────────────────────────────────────────────────────────
// prisma/add-admin.ts — one-off utility to hand-create (or, via the commented block,
// edit) a single user — typically to bootstrap the first ADMIN before the Azure sync
// runs. Run with `npx tsx prisma/add-admin.ts`; edit the hardcoded email/name/role
// inline per use. Connects directly via DATABASE_URL. Throwaway script, never imported.
// ─────────────────────────────────────────────────────────────────────────────
import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const pool    = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool, { schema: 'procdna_database' })
const prisma  = new PrismaClient({ adapter })

// async function main() { // editing the existing user
//   const user = await prisma.user.update({
//     where: { email: 'ruchir.tyagi@procdna.com' },
//     data:  { role: 'PARTNER' , 
//       name : 'RUCHIR TYAGI',
//     },
//   })
//   console.log('Updated:', user.id, user.email, user.role)
// }
 //For updating the existing

async function main() {
  const user = await prisma.user.create({
    data: {
      email:    'punya.ahuja@procdna.com',
      name:     'PUNYA AHUJA',
      role:     'ADMIN',
      location: 'INDIA',
      isActive: true,
    },
  })
  console.log('Created:', user.id, user.email, user.role)
}
// //for creation of new

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
  //  added admin .
  // npx tsx prisma/add-admin.ts 
  // duplicates not entered