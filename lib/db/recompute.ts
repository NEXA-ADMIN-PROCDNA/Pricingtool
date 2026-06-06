import type { Prisma } from '@prisma/client'

// When an opportunity's start/end dates change, the existing pricing no longer
// maps to the new window — so rather than trying to trim/re-bucket individual
// weeks, we RESET the pricing: clear all staffing hours, zero each version's
// summary metrics, and drop the derived Schedule-of-Payment / Financial-Snapshot
// rows. The owner then re-enters efforts for the new window and sends the
// pricing for approval again from the beginning.
export async function resetOpportunityPricing(
  tx: Prisma.TransactionClient,
  opportunityId: string,
): Promise<void> {
  // Clear all weekly hours across every version of this opportunity.
  await tx.staffingWeekEntry.deleteMany({
    where: { staffingResource: { pricingVersion: { opportunityId } } },
  })

  // Drop the derived monthly rows (regenerated live by the SoP / Financial tabs).
  await tx.scheduleOfPayment.deleteMany({ where: { pricingVersion: { opportunityId } } })
  await tx.financialSnapshot.deleteMany({ where: { pricingVersion: { opportunityId } } })

  // Zero the denormalised summary metrics so stale figures don't linger.
  await tx.pricingVersion.updateMany({
    where: { opportunityId },
    data: {
      totalHours: null, totalCost: null, proposedBillings: null,
      grossMarginPct: null, offshorePct: null, effectiveRatePerHour: null,
      discountPremiumPct: null,
    },
  })
}
