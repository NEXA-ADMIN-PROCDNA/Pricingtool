import type { Prisma } from '@prisma/client'

// ───────────────────────────────────────────────────────────────
// Server-side recompute engine for an opportunity's date-window change.
//
// Mirrors the client-side math in app/opportunities/[id]/pricing/{utils,
// TabSoP, TabFinancial}.tsx EXACTLY, so the persisted PricingVersion metrics,
// ScheduleOfPayment rows, and FinancialSnapshot rows match what those tabs
// render live. All money/hours use UTC date math for determinism on Vercel.
// ───────────────────────────────────────────────────────────────

const num = (v: unknown): number =>
  v == null ? 0 : typeof v === 'number' ? v : Number(v as never)

const pad2 = (n: number) => String(n).padStart(2, '0')

// Monday of (or before) a date — matches getWeekColumns().
function mondayOf(d: Date): Date {
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = s.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  s.setUTCDate(s.getUTCDate() + diff)
  return s
}

// Inclusive list of 'YYYY-MM' month keys spanning [start, end] — matches getProjectMonths().
function projectMonths(start: Date, end: Date): string[] {
  const cur  = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
  const last = new Date(Date.UTC(end.getUTCFullYear(),   end.getUTCMonth(),   1))
  const out: string[] = []
  while (cur <= last) {
    out.push(`${cur.getUTCFullYear()}-${pad2(cur.getUTCMonth() + 1)}`)
    cur.setUTCMonth(cur.getUTCMonth() + 1)
  }
  return out
}

// Spread a week's value across the Mon–Fri months it touches — matches distributeWeekToMonths().
function distributeWeekToMonths(weekStart: Date, value: number): [string, number][] {
  const perDay = value / 5
  const acc = new Map<string, number>()
  const y = weekStart.getUTCFullYear(), mo = weekStart.getUTCMonth(), d = weekStart.getUTCDate()
  for (let i = 0; i < 5; i++) {
    const day = new Date(Date.UTC(y, mo, d + i))
    const key = `${day.getUTCFullYear()}-${pad2(day.getUTCMonth() + 1)}`
    acc.set(key, (acc.get(key) ?? 0) + perDay)
  }
  return [...acc.entries()]
}

// First-of-month UTC Date from a 'YYYY-MM' key, for the DateTime `month` columns.
function monthKeyToDate(key: string): Date {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1))
}

const LOB_ALIASES: Record<string, string> = {
  ANALYTICS: 'ANALYTICS', TECH: 'TECH', TECHNOLOGY: 'TECH',
  MS: 'MS', 'MANAGED SERVICES': 'MS', DS: 'DS', 'DATA SCIENCE': 'DS',
  DESIGN: 'DESIGN', AUXO: 'AUXO',
}
function normalizeLob(raw: string | null | undefined): string | null {
  if (!raw) return null
  return LOB_ALIASES[raw.trim().toUpperCase()] ?? null
}

type StaffRow = {
  isActive: boolean
  isBillable: boolean
  location: string
  domain: string | null
  costRatePerHour: unknown
  effectiveBillRate: unknown
  systemBillRatePerHour: unknown
  weeklyHours: { weekStartDate: Date; hours: unknown }[]
}
type CostRow = { amount: unknown; markupPct: unknown; isBillable: boolean }

// Headline metrics — mirrors computeFromRows().
function computeMetrics(rows: StaffRow[]) {
  let billedHours = 0, unbilledHours = 0, totalCost = 0
  let proposedBillings = 0, recommendedBillings = 0, indiaHours = 0
  for (const row of rows.filter(r => r.isActive)) {
    const cost = num(row.costRatePerHour)
    const eff  = num(row.effectiveBillRate) || num(row.systemBillRatePerHour)
    const sys  = num(row.systemBillRatePerHour)
    for (const wh of row.weeklyHours) {
      const h = num(wh.hours)
      totalCost += h * cost
      if (row.isBillable) {
        billedHours += h
        proposedBillings += h * eff
        recommendedBillings += h * sys
        if (row.location === 'INDIA') indiaHours += h
      } else {
        unbilledHours += h
      }
    }
  }
  const totalHours = billedHours + unbilledHours
  const grossMargin = proposedBillings - totalCost
  return {
    totalHours,
    totalCost,
    proposedBillings,
    grossMarginPct:       proposedBillings > 0 ? (grossMargin / proposedBillings) * 100 : 0,
    offshorePct:          billedHours > 0 ? (indiaHours / billedHours) * 100 : 0,
    effectiveRatePerHour: billedHours > 0 ? proposedBillings / billedHours : 0,
    discountPremiumPct:   recommendedBillings > 0 ? ((proposedBillings / recommendedBillings) - 1) * 100 : 0,
  }
}

// Schedule of Payments rows — mirrors TabSoP. NB: SoP uses ALL other costs
// (not filtered by isBillable), distributed by billable-hours weight per month.
function buildScheduleOfPayments(rows: StaffRow[], costs: CostRow[], months: string[]) {
  const numMonths = months.length || 1
  const recEff = new Map<string, number>(), propEff = new Map<string, number>(), billH = new Map<string, number>()
  for (const m of months) { recEff.set(m, 0); propEff.set(m, 0); billH.set(m, 0) }

  for (const row of rows.filter(r => r.isActive && r.isBillable)) {
    const sys = num(row.systemBillRatePerHour)
    const eff = num(row.effectiveBillRate) || sys
    for (const wh of row.weeklyHours) {
      const h = num(wh.hours)
      if (!h) continue
      for (const [m, hrs] of distributeWeekToMonths(wh.weekStartDate, h)) {
        if (!recEff.has(m)) continue
        recEff.set(m, recEff.get(m)! + hrs * sys)
        propEff.set(m, propEff.get(m)! + hrs * eff)
        billH.set(m, billH.get(m)! + hrs)
      }
    }
  }
  const totalBillH    = [...billH.values()].reduce((s, h) => s + h, 0)
  const totalRecOther = costs.reduce((s, c) => s + num(c.amount), 0)
  const totalPropOther = costs.reduce((s, c) => s + num(c.amount) * (1 + num(c.markupPct) / 100), 0)

  return months.map(m => {
    const weight = totalBillH > 0 ? billH.get(m)! / totalBillH : 1 / numMonths
    const re = recEff.get(m)!, pe = propEff.get(m)!
    const ro = totalRecOther * weight, po = totalPropOther * weight
    const dp = re > 0 ? (pe / re - 1) * 100 : 0
    return {
      month:                monthKeyToDate(m),
      recommendedBillings:  re,
      recommendedOtherCost: ro,
      proposedBillings:     pe,
      proposedOtherCost:    po,
      proposedIsManual:     false,
      discountPct:          dp < 0 ? dp : null,
      premiumPct:           dp > 0 ? dp : null,
    }
  })
}

// Financial Snapshot rows A–K — mirrors TabFinancial. Emits one row per month
// PLUS a project-total row with month=null. NB: A2/C split other costs evenly
// per month (A2 = billable only; C = raw all).
function buildFinancialSnapshots(rows: StaffRow[], costs: CostRow[], months: string[]) {
  const numMonths = months.length || 1
  type M = { a1: number; a2: number; b: number; c: number; f1: number; f2: number
             indiaRev: number; indiaHrs: number; usRev: number; usHrs: number; recRev: number }
  const zero = (): M => ({ a1:0,a2:0,b:0,c:0,f1:0,f2:0,indiaRev:0,indiaHrs:0,usRev:0,usHrs:0,recRev:0 })
  const byMonth = new Map<string, M>()
  for (const m of months) byMonth.set(m, zero())

  for (const row of rows.filter(r => r.isActive)) {
    const cost = num(row.costRatePerHour)
    const eff  = num(row.effectiveBillRate) || num(row.systemBillRatePerHour)
    const sys  = num(row.systemBillRatePerHour)
    for (const wh of row.weeklyHours) {
      const h = num(wh.hours)
      if (!h) continue
      for (const [m, hrs] of distributeWeekToMonths(wh.weekStartDate, h)) {
        const r = byMonth.get(m); if (!r) continue
        r.b += hrs * cost
        if (row.isBillable) {
          const rev = hrs * eff, recRev = hrs * sys
          r.a1 += rev; r.recRev += recRev; r.f1 += hrs
          if (row.location === 'INDIA') { r.indiaRev += rev; r.indiaHrs += hrs }
          else                          { r.usRev += rev;    r.usHrs += hrs }
        } else {
          r.f2 += hrs
        }
      }
    }
  }
  const totalRaw    = costs.reduce((s, c) => s + num(c.amount), 0)
  const totalBilled = costs.filter(c => c.isBillable).reduce((s, c) => s + num(c.amount) * (1 + num(c.markupPct) / 100), 0)
  for (const m of months) {
    const r = byMonth.get(m)!
    r.c  += totalRaw / numMonths
    r.a2 += totalBilled / numMonths
  }

  const derive = (r: M, month: Date | null) => {
    const a = r.a1 + r.a2
    const d = a - r.b - r.c
    const f = r.f1 + r.f2
    return {
      month,
      revenueFromBilling:   r.a1,
      revenueFromOtherCost: r.a2,
      totalRevenue:         a,
      employeeCost:         r.b,
      otherCost:            r.c,
      grossMargin:          d,
      grossMarginPct:       a > 0 ? (d / a) * 100 : 0,
      discountPremiumPct:   r.recRev > 0 ? (r.a1 / r.recRev - 1) * 100 : 0,
      totalHours:           f,
      offshoreRatio:        f > 0 ? (r.indiaHrs / f) * 100 : 0,
      billedRatePerHour:    f > 0 ? r.a1 / f : 0,
      effectiveRatePerHour: r.f1 > 0 ? r.a1 / r.f1 : 0,
      indiaRate:            r.indiaHrs > 0 ? r.indiaRev / r.indiaHrs : 0,
      usRate:               r.usHrs > 0 ? r.usRev / r.usHrs : 0,
    }
  }

  const perMonth = months.map(m => derive(byMonth.get(m)!, monthKeyToDate(m)))

  const tot = zero()
  for (const r of byMonth.values()) {
    tot.a1 += r.a1; tot.a2 += r.a2; tot.b += r.b; tot.c += r.c
    tot.f1 += r.f1; tot.f2 += r.f2; tot.recRev += r.recRev
    tot.indiaRev += r.indiaRev; tot.indiaHrs += r.indiaHrs
    tot.usRev += r.usRev; tot.usHrs += r.usHrs
  }
  return [...perMonth, derive(tot, null)]
}

function majorityLob(rows: StaffRow[]): string | null {
  const tally: Record<string, number> = {}
  for (const r of rows) {
    const lob = normalizeLob(r.domain)
    if (!lob) continue
    const totalHrs = r.weeklyHours.reduce((s, w) => s + num(w.hours), 0)
    if (totalHrs <= 0) continue
    const eff = num(r.effectiveBillRate)
    tally[lob] = (tally[lob] ?? 0) + (eff > 0 ? eff * totalHrs : totalHrs)
  }
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
  return top ? top[0] : null
}

// Trim out-of-window week entries across ALL versions, then recompute & persist
// each version's metrics + Schedule of Payments + Financial Snapshots, and the
// opportunity's primaryLob from its final version. Run inside a transaction.
export async function recomputeOpportunityWindow(
  tx: Prisma.TransactionClient,
  opportunityId: string,
  start: Date,
  end: Date,
): Promise<{ primaryLob: string | null }> {
  const startMonday = mondayOf(start)

  // 1. Drop week entries outside the new window (the "lost weeks").
  await tx.staffingWeekEntry.deleteMany({
    where: {
      staffingResource: { pricingVersion: { opportunityId } },
      OR: [{ weekStartDate: { lt: startMonday } }, { weekStartDate: { gt: end } }],
    },
  })

  const months = projectMonths(start, end)
  const otherCostsRaw = await tx.otherCost.findMany({
    where: { opportunityId },
    select: { amount: true, markupPct: true, isBillable: true },
  })
  const costs: CostRow[] = otherCostsRaw

  const versions = await tx.pricingVersion.findMany({
    where: { opportunityId },
    select: { id: true, isFinal: true },
  })

  let primaryLob: string | null = null

  for (const v of versions) {
    const staffing = await tx.staffingResource.findMany({
      where: { pricingVersionId: v.id },
      select: {
        isActive: true, isBillable: true, location: true, domain: true,
        costRatePerHour: true, effectiveBillRate: true, systemBillRatePerHour: true,
        weeklyHours: { select: { weekStartDate: true, hours: true } },
      },
    })
    const rows = staffing as unknown as StaffRow[]

    const m = computeMetrics(rows)
    await tx.pricingVersion.update({
      where: { id: v.id },
      data: {
        totalHours:           m.totalHours,
        totalCost:            m.totalCost,
        proposedBillings:     m.proposedBillings,
        grossMarginPct:       m.grossMarginPct,
        offshorePct:          m.offshorePct,
        effectiveRatePerHour: m.effectiveRatePerHour,
        discountPremiumPct:   m.discountPremiumPct,
      },
    })

    // Regenerate SoP + snapshots from scratch for the new window.
    await tx.scheduleOfPayment.deleteMany({ where: { pricingVersionId: v.id } })
    const sop = buildScheduleOfPayments(rows, costs, months)
    if (sop.length) {
      await tx.scheduleOfPayment.createMany({ data: sop.map(r => ({ pricingVersionId: v.id, ...r })) })
    }

    await tx.financialSnapshot.deleteMany({ where: { pricingVersionId: v.id } })
    const snaps = buildFinancialSnapshots(rows, costs, months)
    if (snaps.length) {
      await tx.financialSnapshot.createMany({ data: snaps.map(r => ({ pricingVersionId: v.id, ...r })) })
    }

    if (v.isFinal) primaryLob = majorityLob(rows)
  }

  return { primaryLob }
}
