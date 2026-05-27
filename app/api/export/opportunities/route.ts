import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { ClientSecretCredential } from '@azure/identity'
import { apiError } from '@/lib/errors'

const ONEDRIVE_USER = 'shreeraj.deshmukh@procdna.com'
const FILE_PATH     = 'opportunities.xlsx'

async function getGraphToken(): Promise<string> {
  const credential = new ClientSecretCredential(
    process.env.AZURE_AD_TENANT_ID!,
    process.env.AZURE_AD_CLIENT_ID!,
    process.env.AZURE_AD_CLIENT_SECRET!,
  )
  const { token } = await credential.getToken('https://graph.microsoft.com/.default')
  return token
}

async function buildBuffer(): Promise<{ buf: Uint8Array; count: number }> {
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
    'Project Code', 'Project Name', 'Project Description', 'Client Organization',
    'Is Client New?', 'Project Start Date', 'Project End Date',
    'Account Manager', 'Account Manager Email',
    'Client Stakeholder Name', 'Client Stakeholder Email',
    'Signed Project Budget ($)', 'Estimated Total Hours', 'Discount / Premium %',
    'Approving Partner', 'Line of Business', 'Status', 'Stage',
    'Gross Margin %', 'Offshore %',
  ]

  const fmt = (d: Date | string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

  const rows = opps.map(opp => {
    const pv  = opp.pricingVersions[0]  ?? null
    const ar  = opp.approvalRequests[0] ?? null
    const poc = opp.client.pocs[0]      ?? null
    return [
      opp.opportunityId, opp.opportunityName, opp.notes ?? '', opp.client.name,
      opp.opportunityType === 'NEW' ? 'Yes' : 'No',
      fmt(opp.startDate), fmt(opp.endDate),
      opp.owner.name, opp.owner.email,
      poc?.name ?? '', poc?.email ?? '',
      pv?.proposedBillings   != null ? Number(pv.proposedBillings)   : '',
      pv?.totalHours         != null ? Number(pv.totalHours)         : '',
      pv?.discountPremiumPct != null ? Number(pv.discountPremiumPct) : '',
      ar?.approver.name ?? '', opp.primaryLob ?? '', opp.status, opp.stage,
      pv?.grossMarginPct != null ? Number(pv.grossMarginPct) : '',
      pv?.offshorePct    != null ? Number(pv.offshorePct)    : '',
    ]
  })

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [
    { wch: 14 }, { wch: 30 }, { wch: 40 }, { wch: 25 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 28 }, { wch: 22 },
    { wch: 28 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 22 },
    { wch: 18 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 12 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Opportunities')
  const buf = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
  return { buf, count: opps.length }
}

// GET — download xlsx directly to browser
export async function GET(req: NextRequest) {
  const token = await getToken({ req })
  if (!token) return apiError('UNAUTHORIZED')
  if ((token.role as string) !== 'ADMIN') return apiError('ADMIN_ONLY')

  try {
    const { buf } = await buildBuffer()
    return new Response(buf.buffer as ArrayBuffer, {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="opportunities.xlsx"',
      },
    })
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('[export] download error:', detail)
    return apiError('EXPORT_FAILED', detail)
  }
}

// POST — upload to OneDrive
export async function POST(req: NextRequest) {
  const token = await getToken({ req })
  if (!token) return apiError('UNAUTHORIZED')
  if ((token.role as string) !== 'ADMIN') return apiError('ADMIN_ONLY')

  try {
    const { buf, count } = await buildBuffer()

    const graphToken = await getGraphToken()
    const uploadUrl  = `https://graph.microsoft.com/v1.0/users/${ONEDRIVE_USER}/drive/root:/${FILE_PATH}:/content`

    const res = await fetch(uploadUrl, {
      method:  'PUT',
      headers: {
        Authorization:  `Bearer ${graphToken}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      body: buf.buffer as ArrayBuffer,
    })

    if (!res.ok) {
      const raw = await res.text()
      console.error('[export] OneDrive upload failed:', raw)
      try {
        const parsed = JSON.parse(raw)
        const code   = parsed?.error?.innerError?.code ?? parsed?.error?.code
        if (code === 'resourceLocked') return apiError('EXPORT_LOCKED')
        if (code === 'Authorization_RequestDenied') return apiError('EXPORT_PERMISSION')
      } catch { /* leave as generic */ }
      return apiError('ONEDRIVE_UPLOAD_FAILED', raw)
    }

    const file = await res.json()
    return NextResponse.json({
      message: `Uploaded successfully — ${count} opportunities`,
      webUrl:  file.webUrl,
    })
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('[export] unhandled error:', detail)
    return apiError('EXPORT_FAILED', detail)
  }
}
