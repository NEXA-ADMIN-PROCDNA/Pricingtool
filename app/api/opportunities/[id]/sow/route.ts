import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { getSupabase, getSignedUrl, SOW_BUCKET } from '@/lib/supabase'
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

// GET — list SOW docs for this opportunity with fresh signed URLs
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req })
  if (!token) return apiError('UNAUTHORIZED')

  const { id: opportunityId } = await params

  const docs = await prisma.sOWDocument.findMany({
    where: { opportunity: { opportunityId }, isActive: true },
    orderBy: { uploadedAt: 'desc' },
  })

  const withUrls = await Promise.all(
    docs.map(async doc => {
      if (!doc.storagePath) return { ...doc, signedUrl: doc.fileUrl }
      return { ...doc, signedUrl: await getSignedUrl(SOW_BUCKET, doc.storagePath) }
    })
  )

  return NextResponse.json(withUrls)
}

// POST — issue a presigned upload URL for direct browser-to-Supabase upload
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req })
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

  const existing = await prisma.sOWDocument.count({ where: { opportunityId: opp.id } })
  const version  = existing + 1
  const ext      = fileName.split('.').pop() ?? 'bin'
  const storagePath = `${opportunityId}/v${version}_${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from(SOW_BUCKET)
    .createSignedUploadUrl(storagePath)

  if (error || !data?.signedUrl) {
    return apiError('DOC_UPLOAD_FAILED', error?.message)
  }

  return NextResponse.json({ uploadUrl: data.signedUrl, storagePath })
}

// DELETE — soft-delete a SOW document
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req })
  if (!token) return apiError('UNAUTHORIZED')

  const { id: opportunityId } = await params
  const { docId } = await req.json() as { docId: string }

  const doc = await prisma.sOWDocument.findFirst({
    where: { id: docId, opportunity: { opportunityId } },
    select: { id: true, opportunityId: true },
  })
  if (!doc) return apiError('DOC_NOT_FOUND')

  await prisma.sOWDocument.update({ where: { id: docId }, data: { isActive: false } })

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
