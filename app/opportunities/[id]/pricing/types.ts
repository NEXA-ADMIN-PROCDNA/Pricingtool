import type { OpportunityDetail } from '@/lib/db/opportunities'

export type Version = OpportunityDetail['pricingVersions'][number]

export type RateCardItem = {
  id: string
  jobRole: string
  location: string
  domain: string | null
  costRatePerHour: number
  billRatePerHour: number
}

export type StaffRow = {
  id: string
  rateCardId: string | null
  resourceDesignation: string
  location: string
  domain: string | null
  utilization: number | null
  costRatePerHour: number | null
  systemBillRatePerHour: number | null
  effectiveBillRate: number | null
  isActive: boolean
  isBillable: boolean
  weeklyHours: { weekStartDate: string; hours: number }[]
}

export type OtherCostRow = {
  id: string
  description: string
  amount: number
  markupPct: number | null
  isBillable: boolean
}

export type ComputedMetrics = {
  totalHours: number
  billedHours: number
  unbilledHours: number
  totalCost: number
  proposedBillings: number
  recommendedBillings: number
  grossMargin: number
  grossMarginPct: number
  offshorePct: number
  effectiveRatePerHour: number
  discountPremiumPct: number
}
