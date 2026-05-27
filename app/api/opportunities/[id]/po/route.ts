import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
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
  const token = await getToken({ req })
  if (!token) return apiError('UNAUTHORIZED')

  const { id: opportunityId } = await params
  const supabase = getSupabase()

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
    select: { id: true, clientId: true, stage: true },
  })
  if (!opp) return apiError('OPP_NOT_FOUND')

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!ALLOWED_MIME.has(file.type)) return apiError('DOC_WRONG_TYPE')

  if (file.size > 49 * 1024 * 1024) return apiError('DOC_TOO_LARGE')

  const existing = await prisma.pODocument.count({ where: { opportunityId: opp.id } })
  const version  = existing + 1
  const ext      = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${opportunityId}/v${version}_${Date.now()}.${ext}`
  const buffer   = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from(PO_BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('Supabase PO upload error:', uploadError)
    return apiError('DOC_UPLOAD_FAILED', uploadError.message)
  }

  const doc = await prisma.pODocument.create({
    data: {
      opportunityId: opp.id,
      clientId:      opp.clientId,
      fileName:      file.name,
      storagePath,
      fileSizeBytes: file.size,
      mimeType:      file.type,
      version,
    },
  })

  if (opp.stage === 'SOW_PENDING') {
    await prisma.opportunity.update({ where: { id: opp.id }, data: { stage: 'SOW_SUBMITTED' } })
  }

  return NextResponse.json({ ...doc, signedUrl: await getSignedUrl(PO_BUCKET, storagePath) }, { status: 201 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req })
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
