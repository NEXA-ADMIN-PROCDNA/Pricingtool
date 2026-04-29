import { prisma } from '@/lib/prisma'

export type ClientRow = Awaited<ReturnType<typeof getClients>>[number]

export async function getClients() {
  return prisma.client.findMany({
    include: {
      pocs: true,
      _count: { select: { opportunities: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getClientsForSelect() {
  return prisma.client.findMany({
    where: { isActive: true },
    select: { id: true, name: true, clientId: true },
    orderBy: { name: 'asc' },
  })
}
