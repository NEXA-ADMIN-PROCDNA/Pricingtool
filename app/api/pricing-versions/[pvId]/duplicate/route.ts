import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ pvId: string }> }
) {
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
    if (!source) return NextResponse.json({ error: 'Version not found' }, { status: 404 })

    // Next version number for this opportunity
    const agg = await prisma.pricingVersion.aggregate({
      where: { opportunityId: source.opportunityId },
      _max: { versionNumber: true },
    })
    const nextNum = (agg._max.versionNumber ?? 0) + 1

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

      // Copy staffing resources + their week entries
      for (const sr of source.staffingResources) {
        const newSr = await tx.staffingResource.create({
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
          },
        })
        for (const wh of sr.weeklyHours) {
          await tx.staffingWeekEntry.create({
            data: {
              staffingResourceId: newSr.id,
              weekStartDate:      wh.weekStartDate,
              hours:              wh.hours,
            },
          })
        }
      }

      // Copy schedule of payments
      for (const sop of source.scheduleOfPayments) {
        await tx.scheduleOfPayment.create({
          data: {
            pricingVersionId:     pv.id,
            month:                sop.month,
            recommendedBillings:  sop.recommendedBillings ?? null,
            recommendedOtherCost: sop.recommendedOtherCost ?? null,
            proposedBillings:     sop.proposedBillings ?? null,
            proposedOtherCost:    sop.proposedOtherCost ?? null,
            proposedIsManual:     sop.proposedIsManual,
            discountPct:          sop.discountPct ?? null,
            premiumPct:           sop.premiumPct ?? null,
          },
        })
      }

      // Copy financial snapshots
      for (const fs of source.financialSnapshots) {
        await tx.financialSnapshot.create({
          data: {
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
          },
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
    })

    return NextResponse.json(newVersion, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to duplicate pricing version' }, { status: 500 })
  }
}
