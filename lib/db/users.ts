// db/users.ts — minimal user lookup for dropdowns (approver / CC pickers, etc).
// Only active users, only the few fields a <select> needs.
import { prisma } from '@/lib/prisma'

export async function getUsersForSelect() {
  return prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })
}
