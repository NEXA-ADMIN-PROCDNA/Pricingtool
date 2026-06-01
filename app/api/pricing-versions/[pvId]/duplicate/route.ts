import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/getAuthToken'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/errors'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pvId: string }> }
) {
  const token = await getAuthToken(req)
  if (!token) return apiError('UNAUTHORIZED')

  try {
    const { pvId } = await params

    const source = await prisma.pricingVersion.findUnique({
      where: { id: pvId },
      include: {
        staffingResources: { include: { weeklyHours: true } },
        scheduleOfPayments: true,
        financialSnapshots: true,
      },
    })
    if (!source) return apiError('PV_NOT_FOUND')

    // Next version number for this opportunity
    const agg = await prisma.pricingVersion.aggregate({
      where: { opportunityId: source.opportunityId },
      _max: { versionNumber: true },
    })
    const nextNum = (agg._max.versionNumber ?? 0) + 1

    // We batch all children with `createMany` + nested writes so the work stays
    // well under the 5 s interactive-tx timeout on the Supabase pooler. The
    // explicit 30 s timeout is a belt-and-braces safety net.
    const newVersion = await prisma.$transaction(async (tx) => {
      const pv = await tx.pricingVersion.create({
        data: {
          opportunityId:        source.opportunityId,
          versionNumber:        nextNum,
          isFinal:              false,
          label:                source.label ?? null,
          revenueSharePct:      source.revenueSharePct ?? null,
          proposedBillings:     source.proposedBillings ?? null,
          totalCost:            source.totalCost ?? null,
          grossMarginPct:       source.grossMarginPct ?? null,
          discountPremiumPct:   source.discountPremiumPct ?? null,
          effectiveRatePerHour: source.effectiveRatePerHour ?? null,
          totalHours:           source.totalHours ?? null,
          offshorePct:          source.offshorePct ?? null,
          businessJustification: source.businessJustification ?? null,
        },
      })

      // Staffing resources — each created with its week entries nested via
      // createMany, so one row + its N week entries land in two round-trips
      // instead of 1 + N.
      for (const sr of source.staffingResources) {
        await tx.staffingResource.create({
          data: {
            pricingVersionId:      pv.id,
            rateCardId:            sr.rateCardId ?? null,
            resourceDesignation:   sr.resourceDesignation,
            location:              sr.location,
            domain:                sr.domain ?? null,
            isBillable:            sr.isBillable,
            isActive:              sr.isActive,
            systemBillRatePerHour: sr.systemBillRatePerHour ?? null,
            manualBillRatePerHour: sr.manualBillRatePerHour ?? null,
            discountPremiumPct:    sr.discountPremiumPct ?? null,
            effectiveBillRate:     sr.effectiveBillRate ?? null,
            costRatePerHour:       sr.costRatePerHour ?? null,
            utilization:           sr.utilization ?? null,
            ...(sr.weeklyHours.length > 0 && {
              weeklyHours: {
                createMany: {
                  data: sr.weeklyHours.map(wh => ({
                    weekStartDate: wh.weekStartDate,
                    hours:         wh.hours,
                  })),
                },
              },
            }),
          },
        })
      }

      // SoP and snapshots have no children — single batched inserts.
      if (source.scheduleOfPayments.length > 0) {
        await tx.scheduleOfPayment.createMany({
          data: source.scheduleOfPayments.map(sop => ({
            pricingVersionId:     pv.id,
            month:                sop.month,
            recommendedBillings:  sop.recommendedBillings ?? null,
            recommendedOtherCost: sop.recommendedOtherCost ?? null,
            proposedBillings:     sop.proposedBillings ?? null,
            proposedOtherCost:    sop.proposedOtherCost ?? null,
            proposedIsManual:     sop.proposedIsManual,
            discountPct:          sop.discountPct ?? null,
            premiumPct:           sop.premiumPct ?? null,
          })),
        })
      }

      if (source.financialSnapshots.length > 0) {
        await tx.financialSnapshot.createMany({
          data: source.financialSnapshots.map(fs => ({
            pricingVersionId:     pv.id,
            month:                fs.month ?? null,
            revenueFromBilling:   fs.revenueFromBilling ?? null,
            revenueFromOtherCost: fs.revenueFromOtherCost ?? null,
            totalRevenue:         fs.totalRevenue ?? null,
            employeeCost:         fs.employeeCost ?? null,
            otherCost:            fs.otherCost ?? null,
            grossMargin:          fs.grossMargin ?? null,
            grossMarginPct:       fs.grossMarginPct ?? null,
            discountPremiumPct:   fs.discountPremiumPct ?? null,
            totalHours:           fs.totalHours ?? null,
            offshoreRatio:        fs.offshoreRatio ?? null,
            billedRatePerHour:    fs.billedRatePerHour ?? null,
            effectiveRatePerHour: fs.effectiveRatePerHour ?? null,
            indiaRate:            fs.indiaRate ?? null,
            usRate:               fs.usRate ?? null,
          })),
        })
      }

      return tx.pricingVersion.findUnique({
        where: { id: pv.id },
        include: {
          staffingResources: { include: { weeklyHours: { orderBy: { weekStartDate: 'asc' } } } },
          scheduleOfPayments: { orderBy: { month: 'asc' } },
          financialSnapshots: { orderBy: { month: 'asc' } },
        },
      })
    }, { timeout: 30_000 })

    return NextResponse.json(newVersion, { status: 201 })
  } catch (err) {
    console.error(err)
    return apiError('PV_DUPLICATE_FAILED')
  }
}
