// ─────────────────────────────────────────────────────────────────────────────
// db/clients.ts — client (customer org) read helpers.
//
// Big picture: clients are the companies opportunities belong to. These power the
// /clients master list, the client detail page (with its opportunities + POCs),
// and the client dropdowns on the new-opportunity form. Note getClientDetail keys
// on the internal cuid `id`, NOT the human CL-NNN clientId (which is admin-assigned
// and nullable).
// ─────────────────────────────────────────────────────────────────────────────
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

// Looked up by internal record id (cuid) — the client detail route keys on `id`
// now that the business clientId is nullable/admin-assigned.
export async function getClientDetail(id: string) {
  return prisma.client.findUnique({
    where: { id },
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
