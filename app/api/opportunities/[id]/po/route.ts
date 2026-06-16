// ─────────────────────────────────────────────────────────────────────────────
// /api/opportunities/[id]/po — PO document list / upload-URL / soft-delete.
// Identical shape to the /sow route (browser → Supabase via signed URL, /po/confirm
// records the row), just for Purchase Order docs in the PO_busket bucket.
//
// RISK: same as SOW — auth-only (IDOR by opp id, S5) and client-claimed type/size
// (S11). Deleting the last SOW+PO with no pre-contract rolls SOW_SUBMITTED → SOW_PENDING.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { getSupabase, getSignedUrl, PO_BUCKET } from '@/lib/supabase'
import { apiError } from '@/lib/errors'

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
])

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const { id: opportunityId } = await params

  const docs = await prisma.pODocument.findMany({
    where: { opportunity: { opportunityId }, isActive: true },
    orderBy: { uploadedAt: 'desc' },
  })

  const withUrls = await Promise.all(
    docs.map(async doc => {
      if (!doc.storagePath) return { ...doc, signedUrl: doc.fileUrl }
      return { ...doc, signedUrl: await getSignedUrl(PO_BUCKET, doc.storagePath) }
    })
  )

  return NextResponse.json(withUrls)
}

// POST — issue a presigned upload URL for direct browser-to-Supabase upload
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const { id: opportunityId } = await params
  const supabase = getSupabase()

  const opp = await prisma.opportunity.findUnique({
    where:  { opportunityId },
    select: { id: true },
  })
  if (!opp) return apiError('OPP_NOT_FOUND')

  const { fileName, fileSize, mimeType } = await req.json() as {
    fileName: string
    fileSize: number
    mimeType: string
  }

  if (!ALLOWED_MIME.has(mimeType)) return apiError('DOC_WRONG_TYPE')
  if (fileSize > 49 * 1024 * 1024) return apiError('DOC_TOO_LARGE')

  const existing = await prisma.pODocument.count({ where: { opportunityId: opp.id } })
  const version  = existing + 1
  const ext      = fileName.split('.').pop() ?? 'bin'
  const storagePath = `${opportunityId}/v${version}_${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from(PO_BUCKET)
    .createSignedUploadUrl(storagePath)

  if (error || !data?.signedUrl) {
    return apiError('DOC_UPLOAD_FAILED', error?.message)
  }

  return NextResponse.json({ uploadUrl: data.signedUrl, storagePath })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const { id: opportunityId } = await params
  const { docId } = await req.json() as { docId: string }

  const doc = await prisma.pODocument.findFirst({
    where:  { id: docId, opportunity: { opportunityId } },
    select: { id: true, opportunityId: true },
  })
  if (!doc) return apiError('DOC_NOT_FOUND')

  await prisma.pODocument.update({ where: { id: docId }, data: { isActive: false } })

  const opp = await prisma.opportunity.findUnique({
    where:  { opportunityId },
    select: { id: true, stage: true, preContractAgreed: true },
  })
  if (opp?.stage === 'SOW_SUBMITTED') {
    const [sowCount, poCount] = await Promise.all([
      prisma.sOWDocument.count({ where: { opportunityId: opp.id, isActive: true } }),
      prisma.pODocument.count({ where: { opportunityId: opp.id, isActive: true } }),
    ])
    if (sowCount === 0 && poCount === 0 && !opp.preContractAgreed) {
      await prisma.opportunity.update({ where: { id: opp.id }, data: { stage: 'SOW_PENDING' } })
    }
  }

  return NextResponse.json({ ok: true })
}
