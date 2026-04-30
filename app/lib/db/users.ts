import { prisma } from '@/lib/prisma'

export async function getUsersForSelect() {
  return prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })
}
