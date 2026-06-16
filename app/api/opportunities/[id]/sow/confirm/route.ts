// ─────────────────────────────────────────────────────────────────────────────
// POST /api/opportunities/[id]/sow/confirm — record the DB row AFTER the browser has
// finished uploading the file to Supabase (step 2 of the 2-step upload).
//
// Big picture: the /sow route issued a signed URL + storagePath; the browser PUT the
// bytes; this writes the SOWDocument row pointing at that storagePath and, if the opp
// was SOW_PENDING, advances it to SOW_SUBMITTED. Returns a fresh signed URL.
//
// RISK: no ownership check, and it trusts the client-supplied storagePath/mimeType
// verbatim — a caller could attach an arbitrary path/type to any opp. (See S5/S11.)
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { getSignedUrl, SOW_BUCKET } from '@/lib/supabase'
import { apiError } from '@/lib/errors'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const { id: opportunityId } = await params

  const opp = await prisma.opportunity.findUnique({
    where:  { opportunityId },
    select: { id: true, clientId: true, stage: true },
  })
  if (!opp) return apiError('OPP_NOT_FOUND')

  const { storagePath, fileName, fileSize, mimeType } = await req.json() as {
    storagePath: string
    fileName:    string
    fileSize:    number
    mimeType:    string
  }

  const existing = await prisma.sOWDocument.count({ where: { opportunityId: opp.id } })

  const doc = await prisma.sOWDocument.create({
    data: {
      opportunityId: opp.id,
      clientId:      opp.clientId,
      fileName,
      storagePath,
      fileSizeBytes: fileSize,
      mimeType,
      version:       existing + 1,
    },
  })

  if (opp.stage === 'SOW_PENDING') {
    await prisma.opportunity.update({ where: { id: opp.id }, data: { stage: 'SOW_SUBMITTED' } })
  }

  return NextResponse.json(
    { ...doc, signedUrl: await getSignedUrl(SOW_BUCKET, storagePath) },
    { status: 201 }
  )
}
