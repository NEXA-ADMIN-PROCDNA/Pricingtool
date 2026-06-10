import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { ClientSecretCredential } from '@azure/identity'
import { apiError } from '@/lib/errors'

// The single SharePoint document the sync targets. We deliberately store the
// `doc.aspx` URL the user shared rather than the resolved drive-item ID so any
// future move of the file (rename, re-pathing) keeps working as long as the
// sharing URL is updated here. The Graph `/shares/{token}/driveItem` endpoint
// resolves the URL on every call.
const SHAREPOINT_SYNC_URL =
  'https://procdna.sharepoint.com/sites/1001VL0001/_layouts/15/doc.aspx?sourcedoc={df87351c-b242-4391-941c-5f8ce47df5e3}&action=edit'

// Encode any URL into the Graph API "share token" format:
//   "u!" + base64url(url) (with `=` padding stripped, `+`→`-`, `/`→`_`)
function toShareToken(url: string): string {
  const b64 = Buffer.from(url, 'utf8').toString('base64')
  return 'u!' + b64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-')
}

async function getGraphToken(): Promise<string> {
  const credential = new ClientSecretCredential(
    process.env.AZURE_AD_TENANT_ID!,
    process.env.AZURE_AD_CLIENT_ID!,
    process.env.AZURE_AD_CLIENT_SECRET!,
  )
  const { token } = await credential.getToken('https://graph.microsoft.com/.default')
  return token
}

// Cap the export to the most recent N opportunities (createdAt desc) so the
// generated workbook and the serverless build stay bounded regardless of how
// large the pipeline grows.
const MAX_EXPORT_ROWS = 5000

async function buildBuffer(): Promise<{ buf: Uint8Array; count: number }> {
  const opps = await prisma.opportunity.findMany({
    take: MAX_EXPORT_ROWS,
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
    'Opportunity Code', 'Opportunity Name', 'Client Organization',
    'Start Date', 'End Date',
    'Account Manager', 'Account Manager Email',
    'Client Stakeholder Name', 'Client Stakeholder Email',
    'Signed Project Budget ($)', 'Estimated Total Hours', 'Discount / Premium %',
    'Approving Partner', 'BU', 'Star Connect', 'Status', 'Stage',
    'Gross Margin %', 'Offshore %',
  ]

  const fmt = (d: Date | string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

  const rows = opps.map(opp => {
    const pv  = opp.pricingVersions[0]  ?? null
    const ar  = opp.approvalRequests[0] ?? null
    const poc = opp.client.pocs[0]      ?? null
    return [
      opp.opportunityId, opp.opportunityName, opp.client.name,
      fmt(opp.startDate), fmt(opp.endDate),
      opp.owner.name, opp.owner.email,
      poc?.name ?? '', poc?.email ?? '',
      pv?.proposedBillings   != null ? Number(pv.proposedBillings)   : '',
      pv?.totalHours         != null ? Number(pv.totalHours)         : '',
      pv?.discountPremiumPct != null ? Number(pv.discountPremiumPct) : '',
      ar?.approver.name ?? '', opp.primaryLob ?? '', opp.starConnect ? 'Yes' : 'No', opp.status, opp.stage,
      pv?.grossMarginPct != null ? Number(pv.grossMarginPct) : '',
      pv?.offshorePct    != null ? Number(pv.offshorePct)    : '',
    ]
  })

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [
    { wch: 14 }, { wch: 30 }, { wch: 25 },
    { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 28 }, { wch: 22 },
    { wch: 28 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 22 },
    { wch: 18 }, { wch: 13 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 12 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Opportunities')
  const buf = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
  return { buf, count: opps.length }
}

// GET — download xlsx directly to browser
export async function GET(req: NextRequest) {
  const token = await getAuthToken(req)
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

// POST — overwrite the shared SharePoint xlsx in place
export async function POST(req: NextRequest) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')
  if ((token.role as string) !== 'ADMIN') return apiError('ADMIN_ONLY')

  try {
    const { buf, count } = await buildBuffer()
    const graphToken = await getGraphToken()

    // 1. Resolve the sharing URL → driveItem so we can address the file by its
    //    canonical drive + item ID (preserves sharing, history, comments).
    const shareToken = toShareToken(SHAREPOINT_SYNC_URL)
    const itemRes = await fetch(
      `https://graph.microsoft.com/v1.0/shares/${shareToken}/driveItem`,
      { headers: { Authorization: `Bearer ${graphToken}` } },
    )
    if (!itemRes.ok) {
      const raw = await itemRes.text()
      console.error('[export] SharePoint URL resolve failed:', raw)
      return apiError('EXPORT_FAILED', raw)
    }
    const item = await itemRes.json() as {
      id?: string
      parentReference?: { driveId?: string }
      webUrl?: string
    }
    const driveId = item.parentReference?.driveId
    const itemId  = item.id
    if (!driveId || !itemId) {
      console.error('[export] resolved driveItem missing IDs:', item)
      return apiError('EXPORT_FAILED', 'SharePoint drive item could not be resolved')
    }

    // 2. PUT new content. This overwrites the existing file at the same location.
    const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`
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
      console.error('[export] SharePoint upload failed:', raw)
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
      webUrl:  file.webUrl ?? item.webUrl,
    })
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('[export] unhandled error:', detail)
    return apiError('EXPORT_FAILED', detail)
  }
}
