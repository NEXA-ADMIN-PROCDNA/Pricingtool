'use client'
// ─────────────────────────────────────────────────────────────────────────────
// TabEfforts — Pricing drawer ▸ "Efforts" sub-tab (the staffing grid).
// Big picture: the spreadsheet-like core of pricing — one row per staffing resource ×
// one column per project week, where you key in hours (or set utilisation % and let it
// auto-fill prorated hours via pricing/utils). Edits flow up to PricingDrawer state,
// which recomputes all downstream metrics live. The heaviest interactive surface.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { toast } from 'sonner'
import type { StaffRow, RateCardItem, ComputedMetrics } from './types'
import { fmtMoneyExact, fmtRole, weekKey } from './utils'

// LoB display labels — match the LineOfBusiness enum used in rate-card domains
const LOB_LABELS: Record<string, string> = {
  ANALYTICS: 'Analytics',
  TECH:      'Technology',
  DS:        'Data Science',
  MS:        'Managed Services',
  DESIGN:    'Design',
  AUXO:      'Auxo',
}

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
  // Cascading add-row state: LoB → Location → Role
  const [addLob, setAddLob]           = useState('')
  const [addLocation, setAddLocation] = useState('')
  const [addRole, setAddRole]         = useState('')

  // Distinct LoBs that actually have at least one active rate card
  const lobOptions = useMemo(() =>
    Array.from(new Set(allRateCards.map(rc => rc.domain).filter(Boolean) as string[])).sort()
  , [allRateCards])

  // Locations available for the chosen LoB
  const locationOptions = useMemo(() =>
    addLob
      ? Array.from(new Set(allRateCards.filter(rc => rc.domain === addLob).map(rc => rc.location))).sort()
      : []
  , [allRateCards, addLob])

  // Roles available for the chosen LoB + Location
  const roleOptions = useMemo(() =>
    (addLob && addLocation)
      ? Array.from(new Set(
          allRateCards
            .filter(rc => rc.domain === addLob && rc.location === addLocation)
            .map(rc => rc.jobRole)
        )).sort()
      : []
  , [allRateCards, addLob, addLocation])

  function resetAddForm() {
    setAddLob(''); setAddLocation(''); setAddRole(''); setShowAddRow(false)
  }

  function handleAdd() {
    const rc = allRateCards.find(r =>
      r.domain   === addLob       &&
      r.location === addLocation  &&
      r.jobRole  === addRole
    )
    if (!rc) {
      toast.error('No rate card matches this combination.')
      return
    }
    addRow(rc)
    resetAddForm()
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        Tick rows to include in calculations. Click Eff. Rate or Discount/Premium to edit — they auto-fill each other.
      </p>

      {/* Live metrics banner — active rows only */}
      {staffRows.some(r => r.isActive) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Implied Revenue', value: fmtMoneyExact(versionMetrics.proposedBillings),       color: 'bg-slate-50 border-slate-200 text-slate-800' },
            { label: 'Employee Cost',   value: fmtMoneyExact(versionMetrics.totalCost),              color: 'bg-slate-50 border-slate-200 text-slate-800' },
            { label: 'Gross Margin',    value: versionMetrics.proposedBillings > 0 ? `${versionMetrics.grossMarginPct.toFixed(1)}%` : '0.0%', color: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
            { label: 'Billed Hours',    value: `${versionMetrics.billedHours.toLocaleString()} h`,   color: 'bg-indigo-50 border-indigo-100 text-indigo-700' },
            { label: 'Unbilled Hours',  value: `${versionMetrics.unbilledHours.toLocaleString()} h`, color: 'bg-slate-50 border-slate-200 text-slate-500' },
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
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap min-w-[140px]">Potential Team Member</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sticky left-[250px] bg-slate-50 z-20 min-w-[70px] whitespace-nowrap border-r border-slate-200">
                  Location
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap min-w-[90px]">BU</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap min-w-[88px]">Cost Rate</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap min-w-[88px]">Bill Rate</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-indigo-400 whitespace-nowrap min-w-[96px]">Eff. Rate</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-indigo-400 whitespace-nowrap min-w-[80px]">Discount/Premium %</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap min-w-[72px]">Util %</th>
                {weeks.map((_, i) => (
                  <th key={i} className="px-2 py-3 text-center text-xs font-semibold text-indigo-500 whitespace-nowrap min-w-[48px]">
                    W{i + 1}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap min-w-[100px]">Total Hours</th>
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
                    {/* Potential Team Member */}
                    <td className="px-2 py-2 min-w-[140px]">
                      {readOnly ? (
                        <span className="text-xs text-slate-700">{sr.potMem || <span className="text-slate-300">—</span>}</span>
                      ) : (
                        <input
                          type="text"
                          placeholder="Name…"
                          value={sr.potMem ?? ''}
                          onChange={e => setStaffRows(prev => prev.map(r => r.id === sr.id ? { ...r, potMem: e.target.value || null } : r))}
                          className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 bg-transparent placeholder-slate-300"
                        />
                      )}
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
                      {sr.costRatePerHour != null ? `$${sr.costRatePerHour}` : '$0'}
                    </td>
                    {/* Bill Rate (system, read-only) */}
                    <td className={`px-3 py-2.5 text-right whitespace-nowrap ${nonBillable ? 'text-slate-300 line-through' : 'text-slate-500'}`}>
                      {sysRate != null ? `$${sysRate}` : '$0'}
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
                          {effRate != null ? `$${effRate.toFixed(2)}` : (readOnly ? '$0.00' : <span className="font-normal text-slate-300">click</span>)}
                        </span>
                      )}
                    </td>
                    {/* Discount/Premium % — editable when not readOnly */}
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
                          onClick={() => { if (readOnly) return; setEditRateCell({ srId: sr.id, field: 'dp' }); setEditRateVal(dp != null ? dp.toFixed(1) : '0') }}
                          className={`rounded px-2 py-1 text-xs font-semibold ${readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50'} ${
                            dp == null ? 'text-slate-300' : dp < 0 ? 'text-amber-600' : dp > 0 ? 'text-emerald-600' : 'text-slate-500'
                          }`}
                        >
                          {dp != null ? `${dp.toFixed(1)}%` : '0.0%'}
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
                          type="number" min={0} max={100} step="any"
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
                          className="w-16 text-right text-xs rounded-lg border border-slate-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 bg-transparent placeholder-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                              autoFocus type="number" min={0} step="any"
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
                                // Empty cell: a shaded, dashed "ghost" cell signals it's clickable to add hours.
                                <span className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded-full px-1.5 text-xs transition-colors ${
                                  readOnly
                                    ? 'text-slate-300'
                                    : 'bg-slate-50 text-slate-300 border border-dashed border-slate-200 hover:bg-indigo-50 hover:text-indigo-500 hover:border-indigo-300'
                                }`}>{readOnly ? '·' : '+'}</span>
                              )}
                            </span>
                          )}
                        </td>
                      )
                    })}
                    {/* Total Hours */}
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {totalHrs > 0 ? totalHrs.toLocaleString() : <span className="text-slate-300 font-normal">0</span>}
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
                  <td /><td /><td /><td /><td /><td /><td />
                  {weeks.map((w, i) => {
                    const wt = staffRows.filter(r => r.isActive).reduce((s, sr) => {
                      const hm: Record<string, number> = {}
                      sr.weeklyHours.forEach(wh => { hm[wh.weekStartDate] = wh.hours })
                      return s + (hm[weekKey(w)] ?? 0)
                    }, 0)
                    return (
                      <td key={i} className="px-1 py-3 text-center font-bold text-slate-700">
                        {wt > 0 ? Math.round(wt * 100) / 100 : <span className="font-normal text-slate-300 text-xs">·</span>}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-right font-bold text-slate-700">
                    {staffRows.filter(r => r.isActive).reduce((s, sr) => {
                      const hm: Record<string, number> = {}
                      sr.weeklyHours.forEach(wh => { hm[wh.weekStartDate] = wh.hours })
                      return s + weeks.reduce((ws, w) => ws + (hm[weekKey(w)] ?? 0), 0)
                    }, 0).toLocaleString()}
                  </td>
                  <td />
                </tr>
              )}

              {/* Add resource row */}
              {!readOnly && <tr className="border-t border-dashed border-slate-200 bg-white">
                {showAddRow ? (
                  <td colSpan={10 + weeks.length + 2} className="px-4 py-3 sticky left-0 bg-white z-10">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* LoB */}
                      <select
                        autoFocus
                        value={addLob}
                        onChange={e => { setAddLob(e.target.value); setAddLocation(''); setAddRole('') }}
                        className="text-xs rounded-lg border border-indigo-300 px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 min-w-[140px]"
                      >
                        <option value="">BU…</option>
                        {lobOptions.map(lob => (
                          <option key={lob} value={lob}>{LOB_LABELS[lob] ?? lob}</option>
                        ))}
                      </select>

                      {/* Location */}
                      <select
                        value={addLocation}
                        disabled={!addLob}
                        onChange={e => { setAddLocation(e.target.value); setAddRole('') }}
                        className="text-xs rounded-lg border border-indigo-300 px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 min-w-[120px] disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <option value="">{addLob ? 'Location…' : 'Pick LoB first'}</option>
                        {locationOptions.map(loc => (
                          <option key={loc} value={loc}>{loc === 'INDIA' ? 'India' : 'US'}</option>
                        ))}
                      </select>

                      {/* Role */}
                      <select
                        value={addRole}
                        disabled={!addLocation}
                        onChange={e => setAddRole(e.target.value)}
                        className="text-xs rounded-lg border border-indigo-300 px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 min-w-[180px] disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <option value="">{addLocation ? 'Role…' : 'Pick Location first'}</option>
                        {roleOptions.map(role => (
                          <option key={role} value={role}>{fmtRole(role)}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={handleAdd}
                        disabled={!addLob || !addLocation || !addRole}
                        className="text-xs font-semibold rounded-lg bg-indigo-600 px-3 py-1.5 text-white disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={resetAddForm}
                        className="text-xs text-slate-400 hover:text-slate-600 px-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                ) : (
                  <td colSpan={10 + weeks.length + 2} className="px-4 py-2.5">
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
