import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { getSignedUrl, PO_BUCKET } from '@/lib/supabase'
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

  const existing = await prisma.pODocument.count({ where: { opportunityId: opp.id } })

  const doc = await prisma.pODocument.create({
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
    { ...doc, signedUrl: await getSignedUrl(PO_BUCKET, storagePath) },
    { status: 201 }
  )
}
