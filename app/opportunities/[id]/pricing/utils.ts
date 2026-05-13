import type { StaffRow, ComputedMetrics } from './types'

export function fmtRole(r: string) {
  return r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function fmt(n: number | null | undefined) {
  if (n == null) return '!'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
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

export function getWeekColumns(start: string | Date, end: string | Date): Date[] {
  const weeks: Date[] = []
  const s = new Date(start)
  const day = s.getDay()
  const diff = day === 0 ? -6 : 1 - day
  s.setDate(s.getDate() + diff)
  s.setHours(0, 0, 0, 0)
  const e = new Date(end)
  let cur = new Date(s)
  while (cur <= e && weeks.length < 52) {
    weeks.push(new Date(cur))
    cur.setDate(cur.getDate() + 7)
  }
  return weeks
}

export function weekKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function getProjectMonths(start: string | Date, end: string | Date): string[] {
  const s = new Date(start)
  const e = new Date(end)
  const cur = new Date(s.getFullYear(), s.getMonth(), 1)
  const last = new Date(e.getFullYear(), e.getMonth(), 1)
  const months: string[] = []
  while (cur <= last) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
    cur.setMonth(cur.getMonth() + 1)
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
    const day = new Date(y, mo - 1, d + i)
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}`
    acc.set(key, (acc.get(key) ?? 0) + perDay)
  }
  return [...acc.entries()]
}

export function monthLabel(key: string) {
  const [y, mo] = key.split('-')
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}
