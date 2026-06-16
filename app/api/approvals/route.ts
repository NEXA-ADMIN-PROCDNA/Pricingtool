// ─────────────────────────────────────────────────────────────────────────────
// GET /api/approvals — the approver's inbox.
// Big picture: lists approval requests where YOU are the approver (ADMIN sees all);
// ?pending=true narrows to still-open ones. For SOW_VERIFICATION rows it attaches
// fresh signed URLs to the linked SOW/PO docs so the approver can preview the actual
// documents before deciding. Powers the /approvals page (ApprovalsInbox).
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { getSignedUrl, SOW_BUCKET, PO_BUCKET } from '@/lib/supabase'
import { apiError } from '@/lib/errors'

export async function GET(req: NextRequest) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const userId  = token.id as string
  const role    = token.role as string | undefined
  const isAdmin = role === 'ADMIN'
  const url = new URL(req.url)
  const onlyPending = url.searchParams.get('pending') === 'true'

  const approvals = await prisma.approvalRequest.findMany({
    where: {
      ...(isAdmin ? {} : { approverId: userId }),
      ...(onlyPending ? { status: 'PENDING' } : {}),
    },
    include: {
      requestedBy: { select: { id: true, name: true, role: true } },
      opportunity: {
        select: {
          id: true,
          opportunityId: true,
          opportunityName: true,
          startDate: true,
          endDate: true,
          preContractAgreed: true,
          client: { select: { name: true } },
          pricingVersions: {
            where: { isFinal: true },
            select: {
              versionNumber: true,
              proposedBillings: true,
              grossMarginPct: true,
              totalHours: true,
              discountPremiumPct: true,
            },
            take: 1,
          },
          sowDocuments: {
            where: { isActive: true },
            select: { id: true, fileName: true, storagePath: true, fileSizeBytes: true, mimeType: true, version: true, uploadedAt: true },
            orderBy: { uploadedAt: 'desc' },
          },
          poDocuments: {
            where: { isActive: true },
            select: { id: true, fileName: true, storagePath: true, fileSizeBytes: true, mimeType: true, version: true, uploadedAt: true },
            orderBy: { uploadedAt: 'desc' },
          },
        },
      },
    },
    orderBy: { requestedAt: 'desc' },
  })

  // Generate signed URLs for SOW_VERIFICATION approvals (cached 55 min)
  const withUrls = await Promise.all(
    approvals.map(async approval => {
      if (approval.approvalType !== 'SOW_VERIFICATION') return approval

      const sowWithUrls = await Promise.all(
        approval.opportunity.sowDocuments.map(async doc => {
          if (!doc.storagePath) return { ...doc, signedUrl: null }
          return { ...doc, signedUrl: await getSignedUrl(SOW_BUCKET, doc.storagePath) }
        })
      )
      const poWithUrls = await Promise.all(
        approval.opportunity.poDocuments.map(async doc => {
          if (!doc.storagePath) return { ...doc, signedUrl: null }
          return { ...doc, signedUrl: await getSignedUrl(PO_BUCKET, doc.storagePath) }
        })
      )

      return {
        ...approval,
        opportunity: {
          ...approval.opportunity,
          sowDocuments: sowWithUrls,
          poDocuments:  poWithUrls,
        },
      }
    })
  )

  return NextResponse.json(withUrls)
}
