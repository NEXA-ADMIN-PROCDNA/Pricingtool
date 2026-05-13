'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import type { OpportunityDetail } from '@/lib/db/opportunities'
import type { StaffRow, RateCardItem, OtherCostRow, ComputedMetrics } from './pricing/types'
import { computeFromRows, getWeekColumns, weekKey } from './pricing/utils'
import { TabBasicDetails } from './pricing/TabBasicDetails'
import { TabEfforts }      from './pricing/TabEfforts'
import { TabOtherCost }    from './pricing/TabOtherCost'
import { TabSoP }          from './pricing/TabSoP'
import { TabFinancial }    from './pricing/TabFinancial'

type Version = OpportunityDetail['pricingVersions'][number]

const SUB_TABS = [
  'Basic Details',
  'Efforts',
  'Other Cost',
  'Financial',
  'SoP',
  'Resource Mix',
  'Timeline',
  'Risk Assessment',
] as const
type SubTab = typeof SUB_TABS[number]

const COMING_SOON: Set<SubTab> = new Set(['Resource Mix', 'Timeline', 'Risk Assessment'])

export function PricingDrawer({
  version,
  opp,
  onClose,
}: {
  version: Version
  opp: OpportunityDetail
  onClose: () => void
}) {
  const [sub, setSub] = useState<SubTab>('Basic Details')

  // ── Efforts state ────────────────────────────────────────────────
  const toStaffRow = (sr: any): StaffRow => ({
    id: sr.id,
    rateCardId: sr.rateCardId ?? null,
    resourceDesignation: sr.resourceDesignation,
    location: sr.location,
    domain: sr.domain ?? null,
    utilization: sr.utilization ?? null,
    costRatePerHour: sr.costRatePerHour != null ? Number(sr.costRatePerHour) : null,
    systemBillRatePerHour: sr.systemBillRatePerHour != null ? Number(sr.systemBillRatePerHour) : null,
    effectiveBillRate: sr.effectiveBillRate != null ? Number(sr.effectiveBillRate) : null,
    isActive: sr.isActive ?? true,
    isBillable: sr.isBillable ?? true,
    weeklyHours: (sr.weeklyHours ?? []).map((w: any) => ({
      weekStartDate: new Date(w.weekStartDate).toISOString().slice(0, 10),
      hours: Number(w.hours),
    })),
  })

  const [staffRows, setStaffRows]           = useState<StaffRow[]>(() => version.staffingResources.map(toStaffRow))
  const [versionMetrics, setVersionMetrics] = useState<ComputedMetrics>(() => computeFromRows(version.staffingResources.map(toStaffRow)))
  const [allRateCards, setAllRateCards]     = useState<RateCardItem[]>([])
  const [showAddRow, setShowAddRow]         = useState(false)
  const [editCell, setEditCell]             = useState<{ srId: string; wk: string } | null>(null)
  const [editVal, setEditVal]               = useState('')
  const [editRateCell, setEditRateCell]     = useState<{ srId: string; field: 'eff' | 'dp' } | null>(null)
  const [editRateVal, setEditRateVal]       = useState('')

  // ── Other Costs state ────────────────────────────────────────────
  const [otherCosts, setOtherCosts]     = useState<OtherCostRow[]>(() =>
    ((opp as any).otherCosts ?? []).map((oc: any) => ({
      id: oc.id,
      description: oc.description,
      amount: Number(oc.amount),
      markupPct: oc.markupPct != null ? Number(oc.markupPct) : null,
      isBillable: oc.isBillable ?? true,
    }))
  )
  const [showAddCost, setShowAddCost]   = useState(false)
  const [newDesc, setNewDesc]           = useState('')
  const [newAmount, setNewAmount]       = useState('')
  const [editCostCell, setEditCostCell] = useState<{ id: string; field: 'markup' | 'billed' } | null>(null)
  const [editCostVal, setEditCostVal]   = useState('')

  // ── Patch PricingVersion with computed metrics ───────────────────
  const patchVersion = useCallback(async (rows: StaffRow[]) => {
    const m = computeFromRows(rows)
    setVersionMetrics(m)

    await fetch(`/api/pricing-versions/${version.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalHours:           m.totalHours,
        totalCost:            m.totalCost,
        proposedBillings:     m.proposedBillings,
        grossMarginPct:       m.grossMarginPct,
        offshorePct:          m.offshorePct,
        effectiveRatePerHour: m.effectiveRatePerHour,
        discountPremiumPct:   m.discountPremiumPct,
      }),
    })
  }, [version.id])

  useEffect(() => {
    if (sub === 'Efforts' && allRateCards.length === 0) {
      fetch('/api/rate-cards').then(r => r.json()).then(setAllRateCards).catch(() => {})
    }
  }, [sub, allRateCards.length])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const weeks = useMemo(
    () => getWeekColumns(opp.startDate, opp.endDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [String(opp.startDate), String(opp.endDate)]
  )

  // ── Staffing callbacks ───────────────────────────────────────────
  const addRow = useCallback(async (rc: RateCardItem) => {
    const res = await fetch(`/api/pricing-versions/${version.id}/staffing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rateCardId: rc.id }),
    })
    if (!res.ok) return
    const sr = await res.json()
    const newRow: StaffRow = {
      id: sr.id,
      rateCardId: rc.id,
      resourceDesignation: rc.jobRole,
      location: rc.location,
      costRatePerHour: rc.costRatePerHour,
      systemBillRatePerHour: rc.billRatePerHour,
      domain: rc.domain ?? null,
      utilization: null,
      effectiveBillRate: null,
      isActive: true,
      isBillable: true,
      weeklyHours: [],
    }
    const newRows = [...staffRows, newRow]
    setStaffRows(newRows)
    await patchVersion(newRows)
  }, [version.id, staffRows, patchVersion])

  const removeRow = useCallback(async (srId: string) => {
    await fetch(`/api/pricing-versions/${version.id}/staffing/${srId}`, { method: 'DELETE' })
    const newRows = staffRows.filter(r => r.id !== srId)
    setStaffRows(newRows)
    await patchVersion(newRows)
  }, [version.id, staffRows, patchVersion])

  const commitHours = useCallback(async (srId: string, wk: string, val: string) => {
    const hours = Math.max(0, parseFloat(val) || 0)
    await fetch(`/api/pricing-versions/${version.id}/staffing/${srId}/hours`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStartDate: wk, hours }),
    })
    const newRows = staffRows.map(r => {
      if (r.id !== srId) return r
      const existing = r.weeklyHours.find(w => w.weekStartDate === wk)
      return {
        ...r,
        weeklyHours: existing
          ? r.weeklyHours.map(w => w.weekStartDate === wk ? { ...w, hours } : w)
          : [...r.weeklyHours, { weekStartDate: wk, hours }],
      }
    })
    setStaffRows(newRows)
    setEditCell(null)
    await patchVersion(newRows)
  }, [version.id, staffRows, patchVersion])

  const commitEffectiveRate = useCallback(async (srId: string, val: string) => {
    const eff = parseFloat(val)
    setEditRateCell(null)
    if (isNaN(eff) || eff < 0) return
    await fetch(`/api/pricing-versions/${version.id}/staffing/${srId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ effectiveBillRate: eff }),
    })
    const newRows = staffRows.map(r => r.id !== srId ? r : { ...r, effectiveBillRate: eff })
    setStaffRows(newRows)
    await patchVersion(newRows)
  }, [version.id, staffRows, patchVersion])

  const commitDP = useCallback(async (srId: string, val: string) => {
    const dp = parseFloat(val)
    setEditRateCell(null)
    if (isNaN(dp)) return
    const row = staffRows.find(r => r.id === srId)
    if (!row) return
    const sysRate = row.systemBillRatePerHour ?? 0
    const eff = sysRate * (1 + dp / 100)
    await fetch(`/api/pricing-versions/${version.id}/staffing/${srId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ effectiveBillRate: eff }),
    })
    const newRows = staffRows.map(r => r.id !== srId ? r : { ...r, effectiveBillRate: eff })
    setStaffRows(newRows)
    await patchVersion(newRows)
  }, [version.id, staffRows, patchVersion])

  const toggleRow = useCallback(async (srId: string, isActive: boolean) => {
    await fetch(`/api/pricing-versions/${version.id}/staffing/${srId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    })
    const newRows = staffRows.map(r => r.id !== srId ? r : { ...r, isActive })
    setStaffRows(newRows)
    await patchVersion(newRows)
  }, [version.id, staffRows, patchVersion])

  const toggleStaffBillable = useCallback(async (srId: string, isBillable: boolean) => {
    await fetch(`/api/pricing-versions/${version.id}/staffing/${srId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isBillable }),
    })
    const newRows = staffRows.map(r => r.id !== srId ? r : { ...r, isBillable })
    setStaffRows(newRows)
    await patchVersion(newRows)
  }, [version.id, staffRows, patchVersion])

  const applyUtilization = useCallback(async (srId: string, util: number | null) => {
    const hoursPerWeek = util != null ? Math.round((util / 100) * 40) : 0
    const weekEntries = util != null
      ? weeks.map(w => ({ weekStartDate: weekKey(w), hours: hoursPerWeek }))
      : []

    await fetch(`/api/pricing-versions/${version.id}/staffing/${srId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utilization: util, weekEntries }),
    })

    const newRows = staffRows.map(r => {
      if (r.id !== srId) return r
      return {
        ...r,
        utilization: util,
        weeklyHours: util != null
          ? weeks.map(w => ({ weekStartDate: weekKey(w), hours: hoursPerWeek }))
          : r.weeklyHours,
      }
    })
    setStaffRows(newRows)
    await patchVersion(newRows)
  }, [version.id, staffRows, weeks, patchVersion])

  // ── Other Cost callbacks ─────────────────────────────────────────
  const addOtherCost = useCallback(async () => {
    const amt = parseFloat(newAmount)
    if (!newDesc.trim() || isNaN(amt)) return
    const res = await fetch(`/api/opportunities/${opp.opportunityId}/other-costs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: newDesc.trim(), amount: amt }),
    })
    if (!res.ok) return
    const created = await res.json()
    setOtherCosts(prev => [...prev, { id: created.id, description: created.description, amount: Number(created.amount), markupPct: null, isBillable: true }])
    setNewDesc('')
    setNewAmount('')
    setShowAddCost(false)
  }, [newDesc, newAmount, opp.opportunityId])

  const toggleBillable = useCallback(async (costId: string, billable: boolean) => {
    setOtherCosts(prev => prev.map(oc => oc.id === costId ? { ...oc, isBillable: billable } : oc))
    await fetch(`/api/opportunities/${opp.opportunityId}/other-costs/${costId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isBillable: billable }),
    })
  }, [opp.opportunityId])

  const commitMarkup = useCallback(async (costId: string, val: string) => {
    setEditCostCell(null)
    const pct = val === '' ? null : parseFloat(val)
    if (pct !== null && isNaN(pct)) return
    setOtherCosts(prev => prev.map(oc => oc.id === costId ? { ...oc, markupPct: pct } : oc))
    await fetch(`/api/opportunities/${opp.opportunityId}/other-costs/${costId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markupPct: pct }),
    })
  }, [opp.opportunityId])

  const commitBilled = useCallback(async (costId: string, val: string) => {
    setEditCostCell(null)
    const billed = parseFloat(val)
    if (isNaN(billed)) return
    const oc = otherCosts.find(r => r.id === costId)
    if (!oc || oc.amount === 0) return
    const pct = ((billed / oc.amount) - 1) * 100
    setOtherCosts(prev => prev.map(r => r.id === costId ? { ...r, markupPct: pct } : r))
    await fetch(`/api/opportunities/${opp.opportunityId}/other-costs/${costId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markupPct: pct }),
    })
  }, [opp.opportunityId, otherCosts])

  const removeOtherCost = useCallback(async (costId: string) => {
    await fetch(`/api/opportunities/${opp.opportunityId}/other-costs/${costId}`, { method: 'DELETE' })
    setOtherCosts(prev => prev.filter(oc => oc.id !== costId))
  }, [opp.opportunityId])

  // ── Render ───────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Centered modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-6xl max-h-[88vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Modal header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                version.isFinal ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                P{version.versionNumber}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Pricing Version {version.versionNumber}
                  {version.isFinal && (
                    <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      Final
                    </span>
                  )}
                </h2>
                {version.label && <p className="text-xs text-slate-400 italic">{version.label}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => { await patchVersion(staffRows); onClose() }}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Save &amp; Close
              </button>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Sub-tab bar */}
          <div className="flex border-b border-slate-200 px-6 shrink-0 overflow-x-auto">
            {SUB_TABS.map(t => {
              const soon = COMING_SOON.has(t)
              return (
                <button
                  key={t}
                  onClick={() => !soon && setSub(t)}
                  className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
                    sub === t && !soon
                      ? 'border-indigo-600 text-indigo-700 font-semibold'
                      : soon
                        ? 'border-transparent text-slate-300 cursor-not-allowed'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t}
                  {soon && <span className="ml-1 text-[9px] text-slate-300">(Coming Soon)</span>}
                  {t === 'Efforts' && staffRows.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5">
                      {staffRows.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {sub === 'Basic Details' && (
              <TabBasicDetails
                version={version}
                opp={opp}
                versionMetrics={versionMetrics}
                otherCosts={otherCosts}
              />
            )}

            {sub === 'Efforts' && (
              <TabEfforts
                staffRows={staffRows}
                versionMetrics={versionMetrics}
                weeks={weeks}
                allRateCards={allRateCards}
                showAddRow={showAddRow}
                editCell={editCell}
                editVal={editVal}
                editRateCell={editRateCell}
                editRateVal={editRateVal}
                setShowAddRow={setShowAddRow}
                setEditCell={setEditCell}
                setEditVal={setEditVal}
                setEditRateCell={setEditRateCell}
                setEditRateVal={setEditRateVal}
                setStaffRows={setStaffRows}
                addRow={addRow}
                removeRow={removeRow}
                commitHours={commitHours}
                commitEffectiveRate={commitEffectiveRate}
                commitDP={commitDP}
                toggleRow={toggleRow}
                toggleStaffBillable={toggleStaffBillable}
                applyUtilization={applyUtilization}
              />
            )}

            {sub === 'Other Cost' && (
              <TabOtherCost
                otherCosts={otherCosts}
                showAddCost={showAddCost}
                newDesc={newDesc}
                newAmount={newAmount}
                editCostCell={editCostCell}
                editCostVal={editCostVal}
                setShowAddCost={setShowAddCost}
                setNewDesc={setNewDesc}
                setNewAmount={setNewAmount}
                setEditCostCell={setEditCostCell}
                setEditCostVal={setEditCostVal}
                addOtherCost={addOtherCost}
                removeOtherCost={removeOtherCost}
                toggleBillable={toggleBillable}
                commitMarkup={commitMarkup}
                commitBilled={commitBilled}
              />
            )}

            {sub === 'Financial' && (
              <TabFinancial
                staffRows={staffRows}
                otherCosts={otherCosts}
                opp={opp}
                version={version}
              />
            )}

            {sub === 'SoP' && (
              <TabSoP
                staffRows={staffRows}
                otherCosts={otherCosts}
                opp={opp}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
