import type { StaffRow, ComputedMetrics } from './types'

export function fmtRole(r: string) {
  return r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function fmt(n: number | null | undefined) {
  if (n == null) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

// Exact money — full value with US thousands separators, no K/M rounding.
// e.g. 8787 → "$8,787", 8787.5 → "$8,787.5"
export function fmtMoneyExact(n: number | null | undefined) {
  if (n == null) return '$0'
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

export function fmtDate(d: string | Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

export function computeFromRows(rows: StaffRow[]): ComputedMetrics {
  let billedHours = 0, unbilledHours = 0, totalCost = 0, proposedBillings = 0, recommendedBillings = 0, indiaHours = 0
  for (const row of rows.filter(r => r.isActive)) {
    for (const wh of row.weeklyHours) {
      const h = wh.hours
      totalCost += h * (row.costRatePerHour ?? 0)
      if (row.isBillable) {
        billedHours         += h
        proposedBillings    += h * (row.effectiveBillRate ?? row.systemBillRatePerHour ?? 0)
        recommendedBillings += h * (row.systemBillRatePerHour ?? 0)
        if (row.location === 'INDIA') indiaHours += h
      } else {
        unbilledHours += h
      }
    }
  }
  const totalHours           = billedHours + unbilledHours
  const grossMargin          = proposedBillings - totalCost
  const grossMarginPct       = proposedBillings > 0 ? (grossMargin / proposedBillings) * 100 : 0
  const offshorePct          = billedHours > 0 ? (indiaHours / billedHours) * 100 : 0
  const effectiveRatePerHour = billedHours > 0 ? proposedBillings / billedHours : 0
  const discountPremiumPct   = recommendedBillings > 0 ? ((proposedBillings / recommendedBillings) - 1) * 100 : 0
  return { totalHours, billedHours, unbilledHours, totalCost, proposedBillings, recommendedBillings, grossMargin, grossMarginPct, offshorePct, effectiveRatePerHour, discountPremiumPct }
}

// Full-Time Equivalent — total active hours ÷ the maximum billable hours for the
// project window (8h × Mon–Fri working days, the same working-day basis used for
// utilization). e.g. one full-time person for the whole window ≈ 1.00. Rounded to
// 2 dp; returns 0 when the window has no working days.
export function computeFte(totalHours: number, start: string | Date, end: string | Date): number {
  const standardHours = workingDaysInWindow(start, end) * 8
  if (standardHours <= 0) return 0
  return Math.round((totalHours / standardHours) * 100) / 100
}

// Normalize any date / ISO string to UTC midnight of its calendar day. ALL week
// and working-day math runs in UTC so it's identical on every browser and server,
// independent of local timezone. (Stored dates are already UTC midnight because
// date-only strings like "2026-06-01" parse as UTC.)
function utcDateOnly(d: string | Date): Date {
  const x = new Date(d)
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()))
}

export function getWeekColumns(start: string | Date, end: string | Date): Date[] {
  const weeks: Date[] = []
  const s = utcDateOnly(start)
  const day = s.getUTCDay()              // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day
  s.setUTCDate(s.getUTCDate() + diff)    // back up to Monday (UTC)
  const e = utcDateOnly(end)
  const cur = new Date(s)
  // Cap at 520 weeks (~10 years) as a safety against accidental end-date typos.
  // Real-world projects terminate via the cur <= e check well before this.
  while (cur <= e && weeks.length < 520) {
    weeks.push(new Date(cur))
    cur.setUTCDate(cur.getUTCDate() + 7)
  }
  return weeks
}

export function weekKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

// Fraction (0..1) of a week's 5 working days (Mon–Fri starting at weekStart)
// that fall inside the project window [start, end]. Partial first/last weeks
// return < 1 so auto-filled hours can be prorated by actual in-window days.
export function weekWindowFraction(weekStart: Date, start: string | Date, end: string | Date): number {
  const s = utcDateOnly(start)
  const e = utcDateOnly(end)
  let inWindow = 0
  for (let i = 0; i < 5; i++) {
    const d = utcDateOnly(weekStart)
    d.setUTCDate(d.getUTCDate() + i)       // Monday + 0..4 = Mon..Fri (UTC)
    if (d >= s && d <= e) inWindow++
  }
  return inWindow / 5
}

// Auto-fill hours for one week: full-week hours (e.g. 40 at 100% utilization)
// prorated by the working days that fall within the project window. Kept to 2
// decimals (matches the Decimal(6,2) hours column) so the unitary util→hours
// link is exact: 100% → 40h, 50.5% → 20.2h, and a 2-day edge week → × 2/5
// (e.g. 16h at 100%, 8.08h at 50.5%). 8h/day assumption.
export function proratedWeekHours(
  weekStart: Date, start: string | Date, end: string | Date, fullWeekHours: number,
): number {
  return Math.round(fullWeekHours * weekWindowFraction(weekStart, start, end) * 100) / 100
}

// Total Mon–Fri working days within the project window [start, end] inclusive.
// Used for the reverse link — deriving utilization from manually-entered hours:
//   utilization% = Σ(all week hours) / (workingDays × 8) × 100
// Working days (Mon–Fri) per calendar month within [start, end], keyed 'YYYY-MM'.
// Used to split monthly figures by each month's working-day count (not by week).
export function workingDaysByMonth(start: string | Date, end: string | Date): Map<string, number> {
  const s = utcDateOnly(start)
  const e = utcDateOnly(end)
  const map = new Map<string, number>()
  const cur = new Date(s)
  while (cur <= e) {
    const day = cur.getUTCDay()
    if (day >= 1 && day <= 5) {
      const key = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}`
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return map
}

export function workingDaysInWindow(start: string | Date, end: string | Date): number {
  const s = utcDateOnly(start)
  const e = utcDateOnly(end)
  let count = 0
  const cur = new Date(s)
  while (cur <= e) {
    const day = cur.getUTCDay()
    if (day >= 1 && day <= 5) count++   // Mon(1) … Fri(5), UTC
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return count
}

export function getProjectMonths(start: string | Date, end: string | Date): string[] {
  const s = utcDateOnly(start)
  const e = utcDateOnly(end)
  const cur  = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1))
  const last = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), 1))
  const months: string[] = []
  while (cur <= last) {
    months.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}`)
    cur.setUTCMonth(cur.getUTCMonth() + 1)
  }
  return months
}

// Distribute a week's value proportionally across the months it spans.
// weekStartDate = 'YYYY-MM-DD' (Monday). Week = Mon–Fri (5 working days).
export function distributeWeekToMonths(weekStartDate: string, value: number): [string, number][] {
  const perDay = value / 5
  const acc = new Map<string, number>()
  const [y, mo, d] = weekStartDate.split('-').map(Number)
  for (let i = 0; i < 5; i++) {
    const day = new Date(Date.UTC(y, mo - 1, d + i))
    const key = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, '0')}`
    acc.set(key, (acc.get(key) ?? 0) + perDay)
  }
  return [...acc.entries()]
}

export function monthLabel(key: string) {
  const [y, mo] = key.split('-')
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}
