import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((token.role as string) !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 })

  const opps = await prisma.opportunity.findMany({
    include: {
      client: { include: { pocs: { take: 1 } } },
      owner:  true,
      pricingVersions: {
        where:   { isFinal: true },
        take:    1,
      },
      approvalRequests: {
        where:   { status: 'APPROVED', approvalType: 'PRICING' },
        include: { approver: { select: { name: true } } },
        orderBy: { decidedAt: 'desc' },
        take:    1,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const headers = [
    'Project Code',
    'Project Name',
    'Project Description',
    'Client Organization',
    'Is Client New?',
    'Project Start Date',
    'Project End Date',
    'Account Manager',
    'Account Manager Email',
    'Client Stakeholder Name',
    'Client Stakeholder Email',
    'Signed Project Budget ($)',
    'Estimated Total Hours',
    'Discount %',
    'Approving Partner',
    'Line of Business',
    'Status',
    'Stage',
    'Gross Margin %',
    'Offshore %',
  ]

  const fmt = (d: Date | string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

  const rows = opps.map(opp => {
    const pv  = opp.pricingVersions[0]  ?? null
    const ar  = opp.approvalRequests[0] ?? null
    const poc = opp.client.pocs[0]      ?? null

    return [
      opp.opportunityId,
      opp.opportunityName,
      opp.notes ?? '',
      opp.client.name,
      opp.opportunityType === 'NEW' ? 'Yes' : 'No',
      fmt(opp.startDate),
      fmt(opp.endDate),
      opp.owner.name,
      opp.owner.email,
      poc?.name  ?? '',
      poc?.email ?? '',
      pv ? Number(pv.proposedBillings ?? 0) : '',
      pv ? Number(pv.totalHours       ?? 0) : '',
      pv ? Number(pv.discountPremiumPct ?? 0) : '',
      ar?.approver.name ?? '',
      opp.primaryLob  ?? '',
      opp.status,
      opp.stage,
      pv ? Number(pv.grossMarginPct ?? 0) : '',
      pv ? Number(pv.offshorePct    ?? 0) : '',
    ]
  })

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // Column widths
  ws['!cols'] = [
    { wch: 14 }, { wch: 30 }, { wch: 40 }, { wch: 25 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 28 }, { wch: 22 },
    { wch: 28 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 22 },
    { wch: 18 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 12 },
  ]

  const wb  = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Opportunities')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="nexa-opportunities-${date}.xlsx"`,
    },
  })
}
