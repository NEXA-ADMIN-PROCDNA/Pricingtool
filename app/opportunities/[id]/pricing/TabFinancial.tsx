'use client'
import type { ReactNode } from 'react'
import type { OpportunityDetail } from '@/lib/db/opportunities'
import type { StaffRow, OtherCostRow, Version } from './types'
import { fmtMoneyExact, getProjectMonths, workingDaysByMonth, monthLabel } from './utils'

interface Props {
  staffRows: StaffRow[]
  otherCosts: OtherCostRow[]
  opp: OpportunityDetail
  version: Version
}

type MRow = {
  a1: number; a2: number; a: number
  b: number; c: number; d: number; dPct: number; ePct: number
  f1: number; f2: number; f: number
  g: number; h: number; i: number; j: number; k: number
  indiaRev: number; indiaHrs: number; indiaHrsAll: number; usRev: number; usHrs: number; usHrsAll: number; recRev: number
}

const zero = (): MRow => ({
  a1: 0, a2: 0, a: 0, b: 0, c: 0, d: 0, dPct: 0, ePct: 0,
  f1: 0, f2: 0, f: 0, g: 0, h: 0, i: 0, j: 0, k: 0,
  indiaRev: 0, indiaHrs: 0, indiaHrsAll: 0, usRev: 0, usHrs: 0, usHrsAll: 0, recRev: 0,
})

type RowDef = { id: string; label: string; get: (r: MRow) => ReactNode; bold?: boolean; indent?: boolean }

export function TabFinancial({ staffRows, otherCosts, opp, version }: Props) {
  const projectMonths = getProjectMonths(opp.startDate, opp.endDate)
  const numMonths = projectMonths.length || 1

  const byMonth = new Map<string, MRow>()
  for (const m of projectMonths) byMonth.set(m, zero())

  // Split each resource's TOTAL hours across months by the number of working days
  // (Mon–Fri) each month has within the project window — i.e. monthly hours =
  // (working days in month) × (hours per working day). This avoids the old
  // per-week spread, which leaked partial-week hours into the wrong (or even
  // out-of-window) month and skewed A1, B and F.
  const wdByMonth = workingDaysByMonth(opp.startDate, opp.endDate)
  const totalWorkingDays = [...wdByMonth.values()].reduce((sum, d) => sum + d, 0)

  for (const row of staffRows.filter(r => r.isActive)) {
    const rowHours = row.weeklyHours.reduce((s, wh) => s + (wh.hours || 0), 0)
    if (rowHours <= 0 || totalWorkingDays <= 0) continue
    const cost = row.costRatePerHour ?? 0
    const eff  = row.effectiveBillRate ?? row.systemBillRatePerHour ?? 0
    const sys  = row.systemBillRatePerHour ?? 0
    for (const m of projectMonths) {
      const wd = wdByMonth.get(m) ?? 0
      if (wd === 0) continue
      const hours = rowHours * (wd / totalWorkingDays)
      const r = byMonth.get(m)
      if (!r) continue
      r.b += hours * cost
      // Total hours by location across ALL active rows (billed + unbilled) — used by rows J & K.
      if (row.location === 'INDIA') r.indiaHrsAll += hours
      else                          r.usHrsAll += hours
      if (row.isBillable) {
        const rev    = hours * eff
        const recRev = hours * sys
        r.a1     += rev
        r.recRev += recRev
        r.f1     += hours
        if (row.location === 'INDIA') { r.indiaRev += rev; r.indiaHrs += hours }
        else                          { r.usRev    += rev; r.usHrs    += hours }
      } else {
        r.f2 += hours
      }
    }
  }

  const totalOtherCostRaw    = otherCosts.reduce((s, oc) => s + oc.amount, 0)
  const totalOtherCostBilled = otherCosts
    .filter(oc => oc.isBillable)
    .reduce((s, oc) => s + oc.amount * (1 + (oc.markupPct ?? 0) / 100), 0)
  for (const m of projectMonths) {
    const r = byMonth.get(m)!
    // Other costs split by the same working-days share as staffing (not evenly).
    const wdShare = totalWorkingDays > 0 ? (wdByMonth.get(m) ?? 0) / totalWorkingDays : 1 / numMonths
    r.c  += totalOtherCostRaw    * wdShare
    r.a2 += totalOtherCostBilled * wdShare
  }

  for (const r of byMonth.values()) {
    r.a    = r.a1 + r.a2
    r.d    = r.a - r.b - r.c
    r.dPct = r.a      > 0 ? (r.d  / r.a)      * 100 : 0
    r.ePct = r.recRev > 0 ? (r.a1 / r.recRev - 1) * 100 : 0
    r.f    = r.f1 + r.f2
    r.g    = r.f       > 0 ? (r.indiaHrs / r.f)       * 100 : 0
    r.h    = r.f       > 0 ? r.a1 / r.f               : 0
    r.i    = r.f1      > 0 ? r.a1 / r.f1              : 0
    r.j    = r.indiaHrsAll > 0 ? r.indiaRev / r.indiaHrsAll : 0
    r.k    = r.usHrsAll > 0 ? r.usRev / r.usHrsAll : 0
  }

  const tot = zero()
  for (const r of byMonth.values()) {
    tot.a1 += r.a1; tot.a2 += r.a2; tot.b += r.b; tot.c += r.c
    tot.f1 += r.f1; tot.f2 += r.f2; tot.recRev += r.recRev
    tot.indiaRev += r.indiaRev; tot.indiaHrs += r.indiaHrs; tot.indiaHrsAll += r.indiaHrsAll
    tot.usRev    += r.usRev;    tot.usHrs    += r.usHrs;    tot.usHrsAll += r.usHrsAll
  }
  tot.a    = tot.a1 + tot.a2
  tot.d    = tot.a - tot.b - tot.c
  tot.dPct = tot.a      > 0 ? (tot.d  / tot.a)         * 100 : 0
  tot.ePct = tot.recRev > 0 ? (tot.a1 / tot.recRev - 1) * 100 : 0
  tot.f    = tot.f1 + tot.f2
  tot.g    = tot.f       > 0 ? (tot.indiaHrs / tot.f)       * 100 : 0
  tot.h    = tot.f       > 0 ? tot.a1 / tot.f               : 0
  tot.i    = tot.f1      > 0 ? tot.a1 / tot.f1              : 0
  tot.j    = tot.indiaHrsAll > 0 ? tot.indiaRev / tot.indiaHrsAll : 0
  tot.k    = tot.usHrsAll > 0 ? tot.usRev / tot.usHrsAll : 0

  function fmtM(n: number): ReactNode { return n !== 0 ? fmtMoneyExact(n) : <span className="text-slate-300">—</span> }
  function fmtRate(n: number): ReactNode { return n > 0 ? `$${n.toFixed(2)}/hr` : <span className="text-slate-300">—</span> }
  function fmtHrs(n: number): ReactNode { return n > 0 ? `${n.toFixed(1)} h` : <span className="text-slate-300">—</span> }
  function fmtPct(n: number, colored?: boolean): ReactNode {
    const s = `${n.toFixed(1)}%`
    if (!colored) return s
    return <span className={n < 0 ? 'text-amber-600' : n > 0 ? 'text-emerald-600' : 'text-slate-500'}>{s}</span>
  }

  const ROWS: RowDef[] = [
    { id: 'a',    label: 'A   — Total Revenue (A1 + A2)',                      get: r => fmtM(r.a),              bold: true },
    { id: 'a1',   label: 'A1  — Staffing Revenue (eff. rate × billed hrs)',    get: r => fmtM(r.a1),             indent: true },
    { id: 'a2',   label: 'A2  — Other Cost Revenue (billed amount / month)',   get: r => fmtM(r.a2),             indent: true },
    { id: 'b',    label: 'B   — Employee Cost (hrs × cost/hr rate)',           get: r => fmtM(r.b),              bold: true },
    { id: 'c',    label: 'C   — Other Cost (raw amount, split per month)',     get: r => fmtM(r.c) },
    { id: 'd',    label: 'D   — Gross Margin (A − B − C)',                    get: r => fmtM(r.d),              bold: true },
    { id: 'dPct', label: 'D%  — Gross Margin %',                              get: r => fmtPct(r.dPct),         bold: true },
    { id: 'ePct', label: 'E   — Discount / Premium % (actual vs recommended)',get: r => fmtPct(r.ePct, true) },
    { id: 'f',    label: 'F   — Total Hours (F1 + F2)',                       get: r => fmtHrs(r.f) },
    { id: 'f1',   label: 'F1  — Billed Hours (active + billable rows)',       get: r => fmtHrs(r.f1),           indent: true },
    { id: 'f2',   label: 'F2  — Unbilled Hours (active + non-billable rows)', get: r => fmtHrs(r.f2),           indent: true },
    { id: 'g',    label: 'G   — Offshore Ratio (India hrs / total hrs)',      get: r => fmtPct(r.g) },
    { id: 'h',    label: 'H   — Blended Rate / Hr  (A1 / total hrs)',         get: r => fmtRate(r.h) },
    { id: 'i',    label: 'I   — Effective Rate / Hr  (A1 / billed hrs)',      get: r => fmtRate(r.i) },
    { id: 'j',    label: 'J   — India Rate  (India revenue / total India hrs)', get: r => fmtRate(r.j) },
    { id: 'k',    label: 'K   — US Rate  (US revenue / total US hrs)',         get: r => fmtRate(r.k) },
  ]

  const hasData = staffRows.some(r => r.isActive && r.weeklyHours.some(wh => wh.hours > 0))
  const hasOtherCosts = otherCosts.length > 0

  return (
    <div className="space-y-4">
      {/* L — Business Justification */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
          L — Business Justification
          <span className="ml-2 text-slate-300 normal-case font-normal">(used in approval email)</span>
        </p>
        {version.businessJustification ? (
          <p className="text-sm text-slate-700 leading-relaxed">{version.businessJustification}</p>
        ) : (
          <p className="text-sm text-slate-400 italic">Not provided.</p>
        )}
      </div>

      {/* Methodology note */}
      <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-xs text-indigo-700 flex gap-2 items-start">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0 mt-0.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <span>
          <strong>Month distribution:</strong> Each week&apos;s hours and costs are split across months by working-day ratio
          (Mon–Fri = 5 days). A week straddling two months distributes proportionally — e.g. Mon–Tue in Jan + Wed–Fri in Feb
          → 40 % to Jan, 60 % to Feb. Other costs are split equally across all{' '}
          <strong>{numMonths} month{numMonths !== 1 ? 's' : ''}</strong>.
          Values update live as you edit Efforts and Other Cost tabs.
          {!hasOtherCosts && ' No other costs added yet (A2 = 0).'}
        </span>
      </div>

      {!hasData ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-400 text-sm">No staffing hours entered yet.</p>
          <p className="text-xs text-slate-300 mt-1">Add resources and enter weekly hours in the Efforts tab to see financial projections.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Monthly Breakdown + Full Project Total
            </p>
            <span className="text-[10px] text-slate-400">
              {projectMonths.length} month{projectMonths.length !== 1 ? 's' : ''} ·{' '}
              {new Date(opp.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} –{' '}
              {new Date(opp.endDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-500 sticky left-0 bg-slate-50 z-10 min-w-[300px] whitespace-nowrap border-r border-slate-100">
                    Metric
                  </th>
                  <th className="px-3 py-2.5 text-center font-bold text-indigo-700 whitespace-nowrap bg-indigo-50/80 min-w-[110px] border-r border-indigo-100">
                    Total
                  </th>
                  {projectMonths.map(m => (
                    <th key={m} className="px-3 py-2.5 text-center font-semibold text-slate-500 whitespace-nowrap min-w-[90px]">
                      {monthLabel(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ROWS.map(({ id, label, get, bold, indent }) => (
                  <tr key={id} className={`hover:bg-slate-50/60 ${bold ? 'bg-slate-50/30' : ''}`}>
                    <td className={`px-4 py-2 whitespace-nowrap sticky left-0 z-10 border-r border-slate-100 font-mono tracking-tight ${
                      bold ? 'font-semibold text-slate-800 bg-slate-50' : 'text-slate-600 bg-white'
                    } ${indent ? 'pl-10 text-slate-400 font-normal text-[11px]' : ''}`}>
                      {label}
                    </td>
                    <td className={`px-3 py-2 text-center border-r border-indigo-50 bg-indigo-50/40 ${bold ? 'font-bold text-indigo-700' : 'font-medium text-slate-700'}`}>
                      {get(tot)}
                    </td>
                    {projectMonths.map(m => (
                      <td key={m} className={`px-3 py-2 text-center ${bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                        {get(byMonth.get(m)!)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
