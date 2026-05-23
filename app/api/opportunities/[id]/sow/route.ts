import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { getSupabase, getSignedUrl, SOW_BUCKET } from '@/lib/supabase'

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
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: opportunityId } = await params
  const supabase = getSupabase()

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

// POST — upload a new SOW document
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: opportunityId } = await params
  const supabase = getSupabase()

  const opp = await prisma.opportunity.findUnique({
    where:  { opportunityId },
    select: { id: true, clientId: true, stage: true },
  })
  if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 415 })
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'File exceeds 20MB limit' }, { status: 413 })
  }

  const existing = await prisma.sOWDocument.count({ where: { opportunityId: opp.id } })
  const version  = existing + 1
  const ext      = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${opportunityId}/v${version}_${Date.now()}.${ext}`
  const buffer   = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from(SOW_BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('Supabase upload error:', uploadError)
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const doc = await prisma.sOWDocument.create({
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

  return NextResponse.json({ ...doc, signedUrl: await getSignedUrl(SOW_BUCKET, storagePath) }, { status: 201 })
}

// DELETE — soft-delete a SOW document
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: opportunityId } = await params
  const { docId } = await req.json() as { docId: string }

  const doc = await prisma.sOWDocument.findFirst({
    where: { id: docId, opportunity: { opportunityId } },
    select: { id: true, opportunityId: true },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
