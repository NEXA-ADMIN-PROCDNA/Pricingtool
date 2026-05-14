'use client'
import type { ReactNode } from 'react'
import type { OpportunityDetail } from '@/lib/db/opportunities'
import type { StaffRow, OtherCostRow } from './types'
import { getProjectMonths, distributeWeekToMonths, monthLabel } from './utils'

interface Props {
  staffRows: StaffRow[]
  otherCosts: OtherCostRow[]
  opp: OpportunityDetail
}

function fmtV(n: number): ReactNode {
  return n > 0.5
    ? <span className="tabular-nums">{Math.round(n).toLocaleString()}</span>
    : <span className="text-slate-300">—</span>
}

function fmtDP(n: number): ReactNode {
  if (Math.abs(n) < 0.05) return <span className="text-slate-400">0%</span>
  const s = `${n >= 0 ? '+' : ''}${n.toFixed(0)}%`
  return <span className={n < 0 ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'}>{s}</span>
}

export function TabSoP({ staffRows, otherCosts, opp }: Props) {
  const projectMonths = getProjectMonths(opp.startDate, opp.endDate)
  const numMonths = projectMonths.length || 1

  const recEffortsMap  = new Map<string, number>()
  const propEffortsMap = new Map<string, number>()
  const billHoursMap   = new Map<string, number>()
  for (const m of projectMonths) {
    recEffortsMap.set(m, 0)
    propEffortsMap.set(m, 0)
    billHoursMap.set(m, 0)
  }

  for (const row of staffRows.filter(r => r.isActive && r.isBillable)) {
    const sysRate = row.systemBillRatePerHour ?? 0
    const effRate = row.effectiveBillRate ?? sysRate
    for (const wh of row.weeklyHours) {
      if (!wh.hours) continue
      for (const [month, hours] of distributeWeekToMonths(wh.weekStartDate, wh.hours)) {
        if (!recEffortsMap.has(month)) continue
        recEffortsMap.set(month,  recEffortsMap.get(month)!  + hours * sysRate)
        propEffortsMap.set(month, propEffortsMap.get(month)! + hours * effRate)
        billHoursMap.set(month,   billHoursMap.get(month)!   + hours)
      }
    }
  }

  const totalBillableHours = [...billHoursMap.values()].reduce((s, h) => s + h, 0)

  const totalRecOther  = otherCosts.reduce((s, oc) => s + oc.amount, 0)
  const totalPropOther = otherCosts.reduce((s, oc) => s + oc.amount * (1 + (oc.markupPct ?? 0) / 100), 0)

  const recOtherMap  = new Map<string, number>()
  const propOtherMap = new Map<string, number>()
  for (const m of projectMonths) {
    const weight = totalBillableHours > 0
      ? (billHoursMap.get(m)! / totalBillableHours)
      : (1 / numMonths)
    recOtherMap.set(m,  totalRecOther  * weight)
    propOtherMap.set(m, totalPropOther * weight)
  }

  const totRecEfforts  = [...recEffortsMap.values()].reduce((s, v) => s + v, 0)
  const totPropEfforts = [...propEffortsMap.values()].reduce((s, v) => s + v, 0)
  const totRecTotal    = totRecEfforts  + totalRecOther
  const totPropTotal   = totPropEfforts + totalPropOther

  const dpEfforts = totRecEfforts  > 0 ? ((totPropEfforts  - totRecEfforts)  / totRecEfforts)  * 100 : 0
  const dpOther   = totalRecOther  > 0 ? ((totalPropOther  - totalRecOther)  / totalRecOther)  * 100 : 0
  const dpTotal   = totRecTotal    > 0 ? ((totPropTotal    - totRecTotal)    / totRecTotal)    * 100 : 0

  const hasData = staffRows.some(r => r.isActive && r.isBillable && r.weeklyHours.some(wh => wh.hours > 0))

  return (
    <div className="space-y-4">
      {/* Info note */}
      <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-xs text-indigo-700 flex gap-2 items-start">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0 mt-0.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <span>
          <strong>Recommended</strong> = system bill rate × billable hrs/month.{' '}
          <strong>Proposed</strong> = effective rate (incl. D/P) × billable hrs/month.{' '}
          Other costs distributed proportionally to billable hours per month.{' '}
          <strong>D/P</strong> = (Proposed − Recommended) ÷ Recommended.
        </span>
      </div>

      {!hasData ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-400 text-sm">No billable staffing hours entered yet.</p>
          <p className="text-xs text-slate-300 mt-1">Add billable resources with hours in the Efforts tab.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          {/* Purple title bar */}
          <div className="px-4 py-2.5 bg-purple-700">
            <p className="text-xs font-bold text-white uppercase tracking-widest">Schedule of Payment</p>
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr>
                  <th rowSpan={2} className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 min-w-[190px] align-bottom">
                    <div className="font-semibold text-slate-700">Months</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">(auto reflect from start and end date)</div>
                  </th>
                  <th colSpan={3} className="px-4 py-2 text-center font-bold text-white bg-cyan-500 border border-cyan-400">
                    Recommended
                  </th>
                  <th colSpan={3} className="px-4 py-2 text-center font-bold text-slate-700 bg-blue-200 border border-blue-300">
                    Proposed
                  </th>
                </tr>
                <tr>
                  {['Efforts', 'Other', 'Total'].map(h => (
                    <th key={`rec-${h}`} className="px-4 py-2 text-right font-semibold text-slate-600 bg-slate-50 border border-slate-200">{h}</th>
                  ))}
                  <th className="px-4 py-2 text-right font-semibold text-slate-600 bg-orange-50 border border-orange-200">Efforts</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-600 bg-orange-50 border border-orange-200">Other</th>
                  <th className="px-4 py-2 text-right font-bold   text-amber-800  bg-amber-100 border border-amber-300">Total</th>
                </tr>
              </thead>
              <tbody>
                {projectMonths.map(m => {
                  const re = recEffortsMap.get(m)!
                  const ro = recOtherMap.get(m)!
                  const pe = propEffortsMap.get(m)!
                  const po = propOtherMap.get(m)!
                  return (
                    <tr key={m} className="hover:bg-slate-50/50 border-b border-slate-100">
                      <td className="px-4 py-2.5 font-medium text-slate-700 bg-white border-r border-slate-200">{monthLabel(m)}</td>
                      <td className="px-4 py-2.5 text-right bg-white border-r border-slate-100">{fmtV(re)}</td>
                      <td className="px-4 py-2.5 text-right bg-white border-r border-slate-100">{fmtV(ro)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-700 bg-white border-r border-slate-200">{fmtV(re + ro)}</td>
                      <td className="px-4 py-2.5 text-right bg-orange-50/40 border-r border-orange-100">{fmtV(pe)}</td>
                      <td className="px-4 py-2.5 text-right bg-orange-50/40 border-r border-orange-100">{fmtV(po)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-amber-800 bg-amber-50">{fmtV(pe + po)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                  <td className="px-4 py-2.5 text-slate-800 border-r border-slate-200">Total</td>
                  <td className="px-4 py-2.5 text-right text-slate-800 border-r border-slate-100">{Math.round(totRecEfforts).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-slate-800 border-r border-slate-100">{Math.round(totalRecOther).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-slate-800 border-r border-slate-200">{Math.round(totRecTotal).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-slate-800 bg-orange-50/40 border-r border-orange-100">{Math.round(totPropEfforts).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-slate-800 bg-orange-50/40 border-r border-orange-100">{Math.round(totalPropOther).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-amber-900 bg-amber-100">{Math.round(totPropTotal).toLocaleString()}</td>
                </tr>
                <tr className="bg-white">
                  <td className="px-4 py-2.5 font-semibold text-slate-500 border-r border-slate-200 text-[11px]">Total D/P</td>
                  <td className="px-4 py-2.5 border-r border-slate-100 bg-slate-50/50" />
                  <td className="px-4 py-2.5 border-r border-slate-100 bg-slate-50/50" />
                  <td className="px-4 py-2.5 border-r border-slate-200 bg-slate-50/50" />
                  <td className="px-4 py-2.5 text-right bg-orange-50/40 border-r border-orange-100">{fmtDP(dpEfforts)}</td>
                  <td className="px-4 py-2.5 text-right bg-orange-50/40 border-r border-orange-100">{fmtDP(dpOther)}</td>
                  <td className="px-4 py-2.5 text-right bg-amber-50">{fmtDP(dpTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
