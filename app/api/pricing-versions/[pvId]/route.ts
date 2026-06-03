import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'
import { LineOfBusiness } from '@prisma/client'

// Maps free-text staffing.domain values to the LineOfBusiness enum.
// Excel uploads occasionally store friendly labels ("Analytics", "Technology",
// "Data Science") instead of canonical enum strings; we accept both forms
// case-insensitively so the autofill works regardless of upload format.
function normalizeLob(raw: string | null | undefined): LineOfBusiness | null {
  if (!raw) return null
  const key = raw.trim().toUpperCase()
  switch (key) {
    case 'ANALYTICS':        return 'ANALYTICS'
    case 'TECH':
    case 'TECHNOLOGY':       return 'TECH'
    case 'MS':
    case 'MANAGED SERVICES': return 'MS'
    case 'DS':
    case 'DATA SCIENCE':     return 'DS'
    case 'DESIGN':           return 'DESIGN'
    case 'AUXO':             return 'AUXO'
    default:                 return null
  }
}

// Revenue-weighted majority domain across staffing (effectiveBillRate × totalHours),
// falling back to hours if rate is 0 so zero-rate rows still count. Matches the UI
// "LoB Revenue Mix" badge in TabBasicDetails. Domain strings are normalized to the
// LineOfBusiness enum before tallying so friendly-label upload formats still resolve.
async function computeMajorityLob(pvId: string): Promise<LineOfBusiness | null> {
  const staffing = await prisma.staffingResource.findMany({
    where:   { pricingVersionId: pvId },
    select:  {
      domain: true,
      effectiveBillRate: true,
      weeklyHours: { select: { hours: true } },
    },
  })
  const tally: Partial<Record<LineOfBusiness, number>> = {}
  for (const r of staffing) {
    const lob = normalizeLob(r.domain)
    if (!lob) continue
    const totalHrs = r.weeklyHours.reduce((s, w) => s + Number(w.hours ?? 0), 0)
    if (totalHrs <= 0) continue
    const effRate = Number(r.effectiveBillRate ?? 0)
    const weight  = effRate > 0 ? effRate * totalHrs : totalHrs
    tally[lob] = (tally[lob] ?? 0) + weight
  }
  const top = Object.entries(tally).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]
  return top ? (top[0] as LineOfBusiness) : null
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pvId: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  try {
    const { pvId } = await params
    await prisma.pricingVersion.delete({ where: { id: pvId } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return apiError('PV_DELETE_FAILED')
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pvId: string }> },
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  const { pvId } = await params
  const version = await prisma.pricingVersion.findUnique({
    where: { id: pvId },
    include: {
      staffingResources: {
        include: {
          weeklyHours: { orderBy: { weekStartDate: 'asc' } },
          rateCard: true,
        },
      },
      scheduleOfPayments: { orderBy: { month: 'asc' } },
      financialSnapshots: { orderBy: { month: 'asc' } },
      // Include the parent opportunity's primaryLob + stage so the FE can reflect
      // the recomputed majority LoB and the (possibly rolled-back) stage after
      // closing the drawer — marking a different version final can move the
      // opportunity back to PRICE_LINKED.
      opportunity:        { select: { primaryLob: true, stage: true } },
    },
  })
  if (!version) return apiError('PV_NOT_FOUND')
  return NextResponse.json(version)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pvId: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  try {
    const { pvId } = await params
    const body = await req.json()

    if (body.isFinal === true) {
      const current = await prisma.pricingVersion.findUnique({
        where:  { id: pvId },
        select: { opportunityId: true, isFinal: true },
      })
      if (current) {
        // Unset isFinal on all sibling versions
        await prisma.pricingVersion.updateMany({
          where: { opportunityId: current.opportunityId, isFinal: true },
          data:  { isFinal: false },
        })

        const opp = await prisma.opportunity.findUnique({
          where:  { id: current.opportunityId },
          select: { stage: true },
        })

        // Recompute Primary LoB from this version's staffing; only overwrite when we get
        // a valid result, so an empty/un-domained pricing keeps the previous value.
        const majorityLob = await computeMajorityLob(pvId)

        const stageData = ['LEAD', 'PRICE_LINKING_PENDING', 'SOW_PENDING', 'SOW_SUBMITTED'].includes(opp?.stage ?? '')
          ? { stage: 'PRICE_LINKED' as const }
          : {}

        if (majorityLob || stageData.stage) {
          await prisma.opportunity.update({
            where: { id: current.opportunityId },
            data:  {
              ...stageData,
              ...(majorityLob ? { primaryLob: majorityLob } : {}),
            },
          })
        }
        // PRICE_LINKED: re-marking another version as final — stage stays PRICE_LINKED
        // SOW_REVIEW_PENDING: blocked in UI — approver must decide before final version can change
      }
    }

    const updated = await prisma.pricingVersion.update({
      where: { id: pvId },
      data: {
        ...(body.isFinal             !== undefined && { isFinal:             body.isFinal             }),
        ...(body.totalHours          != null && { totalHours:          body.totalHours          }),
        ...(body.totalCost           != null && { totalCost:           body.totalCost           }),
        ...(body.proposedBillings    != null && { proposedBillings:    body.proposedBillings    }),
        ...(body.grossMarginPct      != null && { grossMarginPct:      body.grossMarginPct      }),
        ...(body.offshorePct         != null && { offshorePct:         body.offshorePct         }),
        ...(body.effectiveRatePerHour!= null && { effectiveRatePerHour:body.effectiveRatePerHour}),
        ...(body.discountPremiumPct  != null && { discountPremiumPct:  body.discountPremiumPct  }),
        ...(body.revenueSharePct    != null && { revenueSharePct:     body.revenueSharePct     }),
      },
    })
    // Surface the current opp.primaryLob so the FE can stop relying on the
    // stale page-load value when isFinal flips and the LoB is recomputed.
    const opp = await prisma.opportunity.findUnique({
      where:  { id: updated.opportunityId },
      select: { primaryLob: true },
    })
    return NextResponse.json({ ...updated, opportunityPrimaryLob: opp?.primaryLob ?? null })
  } catch (err) {
    console.error(err)
    return apiError('OPP_UPDATE_FAILED')
  }
}
