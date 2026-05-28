'use client'
import type { Dispatch, SetStateAction } from 'react'
import type { StaffRow, RateCardItem, ComputedMetrics } from './types'
import { fmt, fmtRole, weekKey } from './utils'

interface Props {
  staffRows: StaffRow[]
  versionMetrics: ComputedMetrics
  weeks: Date[]
  allRateCards: RateCardItem[]
  showAddRow: boolean
  editCell: { srId: string; wk: string } | null
  editVal: string
  editRateCell: { srId: string; field: 'eff' | 'dp' } | null
  editRateVal: string
  setShowAddRow: (v: boolean) => void
  setEditCell: (v: { srId: string; wk: string } | null) => void
  setEditVal: (v: string) => void
  setEditRateCell: (v: { srId: string; field: 'eff' | 'dp' } | null) => void
  setEditRateVal: (v: string) => void
  setStaffRows: Dispatch<SetStateAction<StaffRow[]>>
  addRow: (rc: RateCardItem) => void
  removeRow: (srId: string) => void
  commitHours: (srId: string, wk: string, val: string) => void
  commitEffectiveRate: (srId: string, val: string) => void
  commitDP: (srId: string, val: string) => void
  toggleRow: (srId: string, isActive: boolean) => void
  toggleStaffBillable: (srId: string, isBillable: boolean) => void
  applyUtilization: (srId: string, util: number | null) => void
  readOnly?: boolean
}

export function TabEfforts({
  staffRows, versionMetrics, weeks, allRateCards,
  showAddRow, editCell, editVal, editRateCell, editRateVal,
  setShowAddRow, setEditCell, setEditVal, setEditRateCell, setEditRateVal, setStaffRows,
  addRow, removeRow, commitHours, commitEffectiveRate, commitDP,
  toggleRow, toggleStaffBillable, applyUtilization,
  readOnly = false,
}: Props) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        Tick rows to include in calculations. Click Eff. Rate or D/P to edit — they auto-fill each other.
      </p>

      {/* Live metrics banner — active rows only */}
      {staffRows.some(r => r.isActive) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Billed Hours',    value: `${versionMetrics.billedHours.toLocaleString()} h`,   color: 'bg-indigo-50 border-indigo-100 text-indigo-700' },
            { label: 'Unbilled Hours',  value: `${versionMetrics.unbilledHours.toLocaleString()} h`, color: 'bg-slate-50 border-slate-200 text-slate-500' },
            { label: 'Employee Cost',   value: fmt(versionMetrics.totalCost),                        color: 'bg-slate-50 border-slate-200 text-slate-800' },
            { label: 'Implied Revenue', value: fmt(versionMetrics.proposedBillings),                 color: 'bg-slate-50 border-slate-200 text-slate-800' },
            { label: 'Gross Margin',    value: versionMetrics.proposedBillings > 0 ? `${versionMetrics.grossMarginPct.toFixed(1)}%` : '—', color: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl border px-4 py-3 ${color}`}>
              <p className="text-[9px] font-semibold uppercase tracking-widest opacity-60 mb-0.5">{label}</p>
              <p className="text-base font-bold">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Staffing table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-2 py-3 sticky left-0 bg-slate-50 z-20 w-10 border-r border-slate-200 text-[10px] font-semibold text-slate-400 text-center">Active</th>
                <th className="px-2 py-3 sticky left-10 bg-slate-50 z-20 w-10 border-r border-slate-200 text-[10px] font-semibold text-slate-400 text-center">Bill</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sticky left-20 bg-slate-50 z-20 min-w-[170px] whitespace-nowrap border-r border-slate-200">
                  Role
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sticky left-[250px] bg-slate-50 z-20 min-w-[70px] whitespace-nowrap border-r border-slate-200">
                  Location
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap min-w-[90px]">Domain</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap min-w-[88px]">Cost Rate</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap min-w-[88px]">Bill Rate</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-indigo-400 whitespace-nowrap min-w-[96px]">Eff. Rate</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-indigo-400 whitespace-nowrap min-w-[80px]">D/P %</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap min-w-[72px]">Util %</th>
                {weeks.map((_, i) => (
                  <th key={i} className="px-2 py-3 text-center text-xs font-semibold text-indigo-500 whitespace-nowrap min-w-[48px]">
                    W{i + 1}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap min-w-[120px]">Total Employee Cost</th>
                <th className="px-2 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffRows.map(sr => {
                const hoursMap: Record<string, number> = {}
                sr.weeklyHours.forEach(w => { hoursMap[w.weekStartDate] = w.hours })
                const totalHrs = weeks.reduce((s, w) => s + (hoursMap[weekKey(w)] ?? 0), 0)
                const rowCost  = sr.isActive ? totalHrs * (sr.costRatePerHour ?? 0) : 0
                const sysRate  = sr.systemBillRatePerHour
                const effRate  = sr.effectiveBillRate
                const dp       = (effRate != null && sysRate != null && sysRate > 0)
                  ? ((effRate - sysRate) / sysRate) * 100
                  : null
                const isEditingEff  = editRateCell?.srId === sr.id && editRateCell?.field === 'eff'
                const isEditingDP   = editRateCell?.srId === sr.id && editRateCell?.field === 'dp'
                const inactive      = !sr.isActive
                const nonBillable   = sr.isActive && !sr.isBillable

                return (
                  <tr key={sr.id} className={`group transition-colors ${inactive ? 'opacity-40' : 'hover:bg-slate-50/50'}`}>
                    {/* Active checkbox */}
                    <td className="px-2 py-2.5 text-center sticky left-0 bg-white z-10 border-r border-slate-200 group-hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={sr.isActive}
                        disabled={readOnly}
                        onChange={e => !readOnly && toggleRow(sr.id, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </td>
                    {/* Billable checkbox */}
                    <td className="px-2 py-2.5 text-center sticky left-10 bg-white z-10 border-r border-slate-200 group-hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={sr.isBillable}
                        disabled={!sr.isActive || readOnly}
                        onChange={e => !readOnly && toggleStaffBillable(sr.id, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </td>
                    {/* Role */}
                    <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap sticky left-20 bg-white z-10 border-r border-slate-200 group-hover:bg-slate-50">
                      {fmtRole(sr.resourceDesignation)}
                    </td>
                    {/* Location */}
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap sticky left-[250px] bg-white z-10 border-r border-slate-200 group-hover:bg-slate-50">
                      {sr.location === 'INDIA' ? 'India' : 'US'}
                    </td>
                    {/* Domain */}
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap text-xs">
                      {sr.domain ?? <span className="text-slate-300">—</span>}
                    </td>
                    {/* Cost Rate */}
                    <td className="px-3 py-2.5 text-right text-slate-700 whitespace-nowrap">
                      {sr.costRatePerHour != null ? `$${sr.costRatePerHour}` : '—'}
                    </td>
                    {/* Bill Rate (system, read-only) */}
                    <td className={`px-3 py-2.5 text-right whitespace-nowrap ${nonBillable ? 'text-slate-300 line-through' : 'text-slate-500'}`}>
                      {sysRate != null ? `$${sysRate}` : '—'}
                    </td>
                    {/* Eff. Rate — editable when not readOnly */}
                    <td className={`px-2 py-2 text-right whitespace-nowrap ${nonBillable ? 'pointer-events-none opacity-30' : ''}`}>
                      {isEditingEff && !readOnly ? (
                        <input
                          autoFocus
                          type="number" min={0} step={0.01}
                          value={editRateVal}
                          onChange={e => setEditRateVal(e.target.value)}
                          onBlur={() => commitEffectiveRate(sr.id, editRateVal)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                            if (e.key === 'Escape') setEditRateCell(null)
                          }}
                          className="w-20 text-right text-xs rounded-lg border border-indigo-400 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                      ) : (
                        <span
                          onClick={() => { if (readOnly) return; setEditRateCell({ srId: sr.id, field: 'eff' }); setEditRateVal(String(effRate ?? sysRate ?? '')) }}
                          className={`rounded px-2 py-1 text-xs font-semibold text-indigo-700 ${readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-indigo-50'}`}
                        >
                          {effRate != null ? `$${effRate.toFixed(2)}` : <span className="font-normal text-slate-300">{readOnly ? '—' : 'click'}</span>}
                        </span>
                      )}
                    </td>
                    {/* D/P % — editable when not readOnly */}
                    <td className={`px-2 py-2 text-right whitespace-nowrap ${nonBillable ? 'pointer-events-none opacity-30' : ''}`}>
                      {isEditingDP && !readOnly ? (
                        <input
                          autoFocus
                          type="number" step={0.1}
                          value={editRateVal}
                          onChange={e => setEditRateVal(e.target.value)}
                          onBlur={() => commitDP(sr.id, editRateVal)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                            if (e.key === 'Escape') setEditRateCell(null)
                          }}
                          className="w-16 text-right text-xs rounded-lg border border-indigo-400 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                      ) : (
                        <span
                          onClick={() => { if (readOnly) return; setEditRateCell({ srId: sr.id, field: 'dp' }); setEditRateVal(dp != null ? dp.toFixed(1) : '-') }}
                          className={`rounded px-2 py-1 text-xs font-semibold ${readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50'} ${
                            dp == null ? 'text-slate-300' : dp < 0 ? 'text-amber-600' : dp > 0 ? 'text-emerald-600' : 'text-slate-500'
                          }`}
                        >
                          {dp != null ? `${dp.toFixed(1)}%` : '—'}
                        </span>
                      )}
                    </td>
                    {/* Util % */}
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      {readOnly ? (
                        <span className="text-xs text-slate-500 px-2">
                          {sr.utilization != null ? `${sr.utilization}%` : <span className="text-slate-300">—</span>}
                        </span>
                      ) : (
                        <input
                          type="number" min={0} max={100} step={5}
                          placeholder="—"
                          value={sr.utilization ?? ''}
                          onChange={e => {
                            const val = e.target.value === '' ? null : Number(e.target.value)
                            setStaffRows(prev => prev.map(r => r.id === sr.id ? { ...r, utilization: val } : r))
                          }}
                          onBlur={e => {
                            const val = e.target.value === '' ? null : Number(e.target.value)
                            applyUtilization(sr.id, val)
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          className="w-14 text-right text-xs rounded-lg border border-slate-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 bg-transparent placeholder-slate-300"
                        />
                      )}
                    </td>
                    {/* Week cells */}
                    {weeks.map((w, i) => {
                      const wk = weekKey(w)
                      const h = hoursMap[wk] ?? 0
                      const isEditing = !readOnly && editCell?.srId === sr.id && editCell?.wk === wk
                      return (
                        <td key={i} className="px-1 py-2 text-center">
                          {isEditing ? (
                            <input
                              autoFocus type="number" min={0} step={1}
                              value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              onBlur={() => commitHours(sr.id, wk, editVal)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                if (e.key === 'Escape') setEditCell(null)
                              }}
                              className="w-12 text-center text-xs rounded-lg border border-indigo-400 px-1 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                          ) : (
                            <span
                              className={readOnly ? 'cursor-default' : 'cursor-pointer'}
                              onClick={() => { if (readOnly) return; setEditCell({ srId: sr.id, wk }); setEditVal(String(h || '')) }}
                            >
                              {h > 0 ? (
                                <span className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                                  inactive ? 'bg-slate-100 text-slate-400' : readOnly ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                }`}>{h}</span>
                              ) : (
                                <span className="text-slate-300 text-xs">·</span>
                              )}
                            </span>
                          )}
                        </td>
                      )
                    })}
                    {/* Total Cost */}
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {sr.isActive && rowCost > 0 ? fmt(rowCost) : <span className="text-slate-300 font-normal">—</span>}
                    </td>
                    {/* Delete */}
                    <td className="px-2 py-2.5">
                      {!readOnly && (
                        <button
                          onClick={() => removeRow(sr.id)}
                          title="Remove row"
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}

              {/* Total row — active rows only */}
              {staffRows.length > 0 && (
                <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                  <td className="sticky left-0 bg-slate-50 z-10 border-r border-slate-200 w-10" />
                  <td className="sticky left-10 bg-slate-50 z-10 border-r border-slate-200 w-10" />
                  <td className="px-4 py-3 text-slate-800 sticky left-20 bg-slate-50 z-10 border-r border-slate-200">Total</td>
                  <td className="sticky left-[250px] bg-slate-50 z-10 border-r border-slate-200" />
                  <td /><td /><td /><td /><td /><td />
                  {weeks.map((w, i) => {
                    const wt = staffRows.filter(r => r.isActive).reduce((s, sr) => {
                      const hm: Record<string, number> = {}
                      sr.weeklyHours.forEach(wh => { hm[wh.weekStartDate] = wh.hours })
                      return s + (hm[weekKey(w)] ?? 0)
                    }, 0)
                    return (
                      <td key={i} className="px-1 py-3 text-center font-bold text-slate-700">
                        {wt > 0 ? wt : <span className="font-normal text-slate-300 text-xs">·</span>}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-right font-bold text-indigo-700">{fmt(versionMetrics.totalCost)}</td>
                  <td />
                </tr>
              )}

              {/* Add resource row */}
              {!readOnly && <tr className="border-t border-dashed border-slate-200 bg-white">
                {showAddRow ? (
                  <>
                    <td colSpan={4} className="px-4 py-2.5 sticky left-0 bg-white z-10">
                      <select
                        autoFocus
                        className="w-full text-xs rounded-lg border border-indigo-300 px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        defaultValue=""
                        onChange={e => {
                          const rc = allRateCards.find(r => r.id === e.target.value)
                          if (rc) { addRow(rc); setShowAddRow(false) }
                        }}
                      >
                        <option value="" disabled>Select a role…</option>
                        {allRateCards.map(rc => (
                          <option key={rc.id} value={rc.id}>
                            {fmtRole(rc.jobRole)} — {rc.location === 'INDIA' ? 'India' : 'US'}{rc.domain ? ` · ${rc.domain}` : ''} · $${rc.costRatePerHour}/hr
                          </option>
                        ))}
                      </select>
                    </td>
                    <td colSpan={5 + weeks.length + 2} className="px-4 py-2.5">
                      <button onClick={() => setShowAddRow(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                    </td>
                  </>
                ) : (
                  <td colSpan={9 + weeks.length + 2} className="px-4 py-2.5">
                    <button
                      onClick={() => setShowAddRow(true)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-indigo-300 text-indigo-400 text-sm font-bold leading-none">+</span>
                      Add Resource
                    </button>
                  </td>
                )}
              </tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
