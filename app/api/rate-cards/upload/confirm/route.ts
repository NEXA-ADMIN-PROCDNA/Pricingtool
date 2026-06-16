// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rate-cards/upload/confirm — commit reviewed rate-card rows (ADMIN, step 2).
// Big picture: takes the {rows} the /upload route parsed and UPSERTS them — matching
// on jobRole::location::domain it UPDATES rates on existing cards and CREATES new ones,
// all in one $transaction. This is how staffing bill/cost rates get refreshed in bulk.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'
import type { ParsedRateCardRow } from '../route'

export async function POST(req: NextRequest) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')
  if ((token.role as string) !== 'ADMIN') return apiError('ADMIN_ONLY')

  const body = await req.json() as { rows: ParsedRateCardRow[] }
  const rows = body?.rows
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 })

  const now    = new Date()
  const userId = token.id as string

  // Load all currently active rate cards once
  const existing = await prisma.rateCard.findMany({
    where:  { isActive: true },
    select: { id: true, jobRole: true, location: true, domain: true },
  })

  type ExistingRow = typeof existing[number]

  // Build lookup: "jobRole::location::domain" → record
  const existingMap = new Map<string, ExistingRow>(
    existing.map((rc: ExistingRow) => [`${rc.jobRole}::${rc.location}::${rc.domain ?? ''}`, rc])
  )

  const toUpdate: { id: string; bill: number; cost: number }[] = []
  const toCreate: ParsedRateCardRow[] = []

  for (const row of rows) {
    const key   = `${row.jobRole}::${row.location}::${row.domain ?? ''}`
    const match = existingMap.get(key)
    if (match) {
      toUpdate.push({ id: match.id, bill: row.billRatePerHour, cost: row.costRatePerHour })
    } else {
      toCreate.push(row)
    }
  }

  // Run updates + inserts in one transaction
  await prisma.$transaction([
    ...toUpdate.map(u =>
      prisma.rateCard.update({
        where: { id: u.id },
        data:  { billRatePerHour: u.bill, costRatePerHour: u.cost },
      })
    ),
    ...(toCreate.length > 0
      ? [prisma.rateCard.createMany({
          data: toCreate.map(row => ({
            jobRole:         row.jobRole,
            location:        row.location as 'INDIA' | 'US',
            domain:          row.domain ?? undefined,
            billRatePerHour: row.billRatePerHour,
            costRatePerHour: row.costRatePerHour,
            effectiveFrom:   now,
            ingestedById:    userId,
          })),
          skipDuplicates: true,
        })]
      : []),
  ])

  return NextResponse.json({ updated: toUpdate.length, created: toCreate.length })
}
