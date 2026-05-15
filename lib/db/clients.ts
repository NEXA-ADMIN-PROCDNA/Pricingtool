import { prisma } from '@/lib/prisma'

export type ClientRow    = Awaited<ReturnType<typeof getClients>>[number]
export type ClientDetail = NonNullable<Awaited<ReturnType<typeof getClientDetail>>>

export async function getClients() {
  return prisma.client.findMany({
    include: {
      pocs: true,
      _count: { select: { opportunities: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getClientDetail(clientId: string) {
  return prisma.client.findUnique({
    where: { clientId },
    include: {
      pocs: true,
      opportunities: {
        include: {
          owner: { select: { name: true } },
          pricingVersions: {
            where:  { isFinal: true },
            select: { proposedBillings: true },
            take: 1,
          },
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

export async function getClientsForSelect() {
  return prisma.client.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      clientId: true,
      businessUnit: true,
      industry: true,
      region: true,
      pocs: { select: { id: true, name: true, email: true, phone: true, jobTitle: true } },
    },
    orderBy: { name: 'asc' },
  })
}
