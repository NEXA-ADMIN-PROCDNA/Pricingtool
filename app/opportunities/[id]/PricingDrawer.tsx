'use client'
import { useState, useEffect, useCallback } from 'react'
import type { OpportunityDetail } from '@/lib/db/opportunities'

type Version = OpportunityDetail['pricingVersions'][number]

type RateCardItem = { id: string; jobRole: string; location: string; costRatePerHour: number; billRatePerHour: number }
type StaffRow = {
  id: string
  rateCardId: string | null
  resourceDesignation: string
  location: string
  costRatePerHour: number | null
  systemBillRatePerHour: number | null
  effectiveBillRate: number | null
  weeklyHours: { weekStartDate: string; hours: number }[]
}

type OtherCostRow = { id: string; description: string; amount: number }

type ComputedMetrics = {
  totalHours: number
  totalCost: number
  proposedBillings: number
  grossMargin: number
  grossMarginPct: number
  offshorePct: number
  effectiveRatePerHour: number
}

function fmtRole(r: string) {
  return r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function computeFromRows(rows: StaffRow[]): ComputedMetrics {
  let totalHours = 0, totalCost = 0, proposedBillings = 0, indiaHours = 0
  for (const row of rows) {
    for (const wh of row.weeklyHours) {
      const h = wh.hours
      const bill = row.effectiveBillRate ?? row.systemBillRatePerHour ?? 0
      totalHours     += h
      totalCost      += h * (row.costRatePerHour ?? 0)
      proposedBillings += h * bill
      if (row.location === 'INDIA') indiaHours += h
    }
  }
  const grossMargin    = proposedBillings - totalCost
  const grossMarginPct = proposedBillings > 0 ? (grossMargin / proposedBillings) * 100 : 0
  const offshorePct    = totalHours > 0 ? (indiaHours / totalHours) * 100 : 0
  const effectiveRatePerHour = totalHours > 0 ? proposedBillings / totalHours : 0
  return { totalHours, totalCost, proposedBillings, grossMargin, grossMarginPct, offshorePct, effectiveRatePerHour }
}

const SUB_TABS = [
  'Basic Details',
  'Efforts',
  'Other Cost',
  'Financial',
  'Resource Mix',
  'Timeline',
  'Risk Assessment',
] as const
type SubTab = typeof SUB_TABS[number]

const COMING_SOON: Set<SubTab> = new Set(['Resource Mix', 'Timeline', 'Risk Assessment'])

// ── Formatters ────────────────────────────────────────────────────
function fmt(n: number | null | undefined) {
  if (n == null) return '!'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

function ReadField({
  label, value, highlight,
}: { label: string; value: string | null | undefined; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium ${highlight ? 'text-indigo-700' : 'text-slate-800'}`}>
        {value ?? '—'}
      </dd>
    </div>
  )
}

// ── Week helpers ──────────────────────────────────────────────────
function getWeekColumns(start: string | Date, end: string | Date): Date[] {
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

function weekKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

// ── Main Modal ────────────────────────────────────────────────────
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

  // ── Efforts state ─────────────────────────────────────────────
  const toStaffRow = (sr: any): StaffRow => ({
    id: sr.id,
    rateCardId: sr.rateCardId ?? null,
    resourceDesignation: sr.resourceDesignation,
    location: sr.location,
    costRatePerHour: sr.costRatePerHour != null ? Number(sr.costRatePerHour) : null,
    systemBillRatePerHour: sr.systemBillRatePerHour != null ? Number(sr.systemBillRatePerHour) : null,
    effectiveBillRate: sr.effectiveBillRate != null ? Number(sr.effectiveBillRate) : null,
    weeklyHours: (sr.weeklyHours ?? []).map((w: any) => ({
      weekStartDate: new Date(w.weekStartDate).toISOString().slice(0, 10),
      hours: Number(w.hours),
    })),
  })

  const [staffRows, setStaffRows] = useState<StaffRow[]>(() =>
    version.staffingResources.map(toStaffRow)
  )
  const [versionMetrics, setVersionMetrics] = useState<ComputedMetrics>(() =>
    computeFromRows(version.staffingResources.map(toStaffRow))
  )
  const [allRateCards, setAllRateCards] = useState<RateCardItem[]>([])
  const [showAddRow, setShowAddRow] = useState(false)
  const [editCell, setEditCell] = useState<{ srId: string; wk: string } | null>(null)
  const [editVal, setEditVal] = useState('')

  // ── Other Costs state ─────────────────────────────────────────
  const [otherCosts, setOtherCosts] = useState<OtherCostRow[]>(() =>
    ((opp as any).otherCosts ?? []).map((oc: any) => ({
      id: oc.id,
      description: oc.description,
      amount: Number(oc.amount),
    }))
  )
  const [showAddCost, setShowAddCost] = useState(false)
  const [newDesc, setNewDesc] = useState('')
  const [newAmount, setNewAmount] = useState('')

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
    setOtherCosts(prev => [...prev, { id: created.id, description: created.description, amount: Number(created.amount) }])
    setNewDesc('')
    setNewAmount('')
    setShowAddCost(false)
  }, [newDesc, newAmount, opp.opportunityId])

  const removeOtherCost = useCallback(async (costId: string) => {
    await fetch(`/api/opportunities/${opp.opportunityId}/other-costs/${costId}`, { method: 'DELETE' })
    setOtherCosts(prev => prev.filter(oc => oc.id !== costId))
  }, [opp.opportunityId])

  // ── Patch PricingVersion with computed metrics ────────────────
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
      }),
    })
  }, [version.id])

  useEffect(() => {
    if (sub === 'Efforts' && allRateCards.length === 0) {
      fetch('/api/rate-cards').then(r => r.json()).then(setAllRateCards).catch(() => {})
    }
  }, [sub, allRateCards.length])

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
      effectiveBillRate: null,
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const weeks = getWeekColumns(opp.startDate, opp.endDate)

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
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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

            {/* ── Basic Details ────────────────────────── */}
            {sub === 'Basic Details' && (
              <div className="space-y-5">
                {/* Auto-filled from opportunity */}
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
                  <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    From Opportunity (auto-filled)
                  </p>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 opacity-75">
                    <ReadField label="Client Name"      value={opp.client.name} />
                    <ReadField label="Opportunity Type" value={opp.opportunityType === 'NEW' ? 'New Business' : 'Existing Client'} />
                    <ReadField label="Opportunity Name" value={opp.opportunityName} />
                    <ReadField label="Start Date"       value={new Date(opp.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} />
                    <ReadField label="End Date"         value={new Date(opp.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} />
                    <ReadField label="Primary LOB"      value={opp.primaryLob} />
                  </dl>
                </div>

                {/* Pricing metrics — live-updated from Efforts */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Pricing Metrics</p>
                    {versionMetrics.totalHours > 0 && (
                      <span className="rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[9px] font-semibold text-indigo-600">
                        Auto-computed from Efforts
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      { label: 'Revenue Share',      value: version.revenueSharePct != null ? `${Number(version.revenueSharePct).toFixed(2)}%` : '—' },
                      { label: 'Proposed Billings',  value: fmt(versionMetrics.totalHours > 0 ? versionMetrics.proposedBillings : (version.proposedBillings != null ? Number(version.proposedBillings) : null)), hi: true },
                      { label: 'Total Cost',         value: fmt(versionMetrics.totalHours > 0 ? versionMetrics.totalCost        : (version.totalCost        != null ? Number(version.totalCost)        : null)) },
                      { label: 'Gross Margin %',     value: versionMetrics.totalHours > 0 ? `${versionMetrics.grossMarginPct.toFixed(1)}%` : (version.grossMarginPct != null ? `${Number(version.grossMarginPct).toFixed(1)}%` : '—'), hi: true },
                      { label: 'Discount / Premium', value: version.discountPremiumPct != null ? `${Number(version.discountPremiumPct).toFixed(1)}%` : '—' },
                      { label: 'Eff. Rate / Hour',   value: fmt(versionMetrics.totalHours > 0 ? versionMetrics.effectiveRatePerHour : (version.effectiveRatePerHour != null ? Number(version.effectiveRatePerHour) : null)) },
                      { label: 'Total Hours',        value: versionMetrics.totalHours > 0 ? `${versionMetrics.totalHours.toLocaleString()} h` : (version.totalHours != null ? `${Number(version.totalHours).toLocaleString()} h` : '—') },
                      { label: 'Offshore %',         value: versionMetrics.totalHours > 0 ? `${versionMetrics.offshorePct.toFixed(0)}%` : (version.offshorePct != null ? `${Number(version.offshorePct).toFixed(0)}%` : '—') },
                    ].map(({ label, value, hi }) => (
                      <div key={label} className={`rounded-xl p-3 ${hi ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50'}`}>
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                        <p className={`text-base font-bold ${hi ? 'text-indigo-700' : 'text-slate-800'}`}>
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {version.businessJustification && (
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-600 mb-2">Business Justification (L)</p>
                    <p className="text-sm text-indigo-800">{version.businessJustification}</p>
                  </div>
                )}

                {version.scheduleOfPayments.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Schedule of Payments</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50">
                            {['Month', 'Rec. Billings', 'Rec. Other Cost', 'Proposed Billings', 'Proposed Other', 'Discount %', 'Premium %'].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {version.scheduleOfPayments.map((sop: any) => (
                            <tr key={sop.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-medium text-slate-700">{fmtDate(sop.month)}</td>
                              <td className="px-3 py-2 text-slate-600">{fmt(sop.recommendedBillings  != null ? Number(sop.recommendedBillings)  : null)}</td>
                              <td className="px-3 py-2 text-slate-600">{fmt(sop.recommendedOtherCost != null ? Number(sop.recommendedOtherCost) : null)}</td>
                              <td className="px-3 py-2 font-semibold text-slate-800">{fmt(sop.proposedBillings != null ? Number(sop.proposedBillings) : null)}</td>
                              <td className="px-3 py-2 text-slate-600">{fmt(sop.proposedOtherCost    != null ? Number(sop.proposedOtherCost)    : null)}</td>
                              <td className="px-3 py-2 text-slate-600">{sop.discountPct != null ? `${Number(sop.discountPct).toFixed(1)}%` : '—'}</td>
                              <td className="px-3 py-2 text-slate-600">{sop.premiumPct  != null ? `${Number(sop.premiumPct).toFixed(1)}%`  : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Efforts ──────────────────────────────── */}
            {sub === 'Efforts' && (
              <div className="space-y-4">

                {/* Hint */}
                <p className="text-xs text-slate-400">
                  Click any hour cell to edit. Use the + row at the bottom to add a resource.
                </p>

                {/* Live metrics banner */}
                {staffRows.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: 'Total Hours',     value: `${versionMetrics.totalHours.toLocaleString()} h`, color: 'bg-indigo-50 border-indigo-100 text-indigo-700' },
                      { label: 'Employee Cost',   value: fmt(versionMetrics.totalCost),                     color: 'bg-slate-50 border-slate-200 text-slate-800' },
                      { label: 'Implied Revenue', value: fmt(versionMetrics.proposedBillings),              color: 'bg-slate-50 border-slate-200 text-slate-800' },
                      { label: 'Gross Margin',    value: versionMetrics.proposedBillings > 0 ? `${versionMetrics.grossMarginPct.toFixed(1)}%` : '—', color: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className={`rounded-xl border px-4 py-3 ${color}`}>
                        <p className="text-[9px] font-semibold uppercase tracking-widest opacity-60 mb-0.5">{label}</p>
                        <p className="text-base font-bold">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Staffing table — always shown */}
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sticky left-0 bg-slate-50 z-20 min-w-[190px] whitespace-nowrap border-r border-slate-200">
                            Role
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sticky left-[190px] bg-slate-50 z-20 min-w-[70px] whitespace-nowrap border-r border-slate-200">
                            Location
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sticky left-[260px] bg-slate-50 z-20 min-w-[88px] whitespace-nowrap border-r border-slate-200">
                            Cost Rate
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap min-w-[90px]">
                            Bill Rate
                          </th>
                          {weeks.map((_, i) => (
                            <th key={i} className="px-2 py-3 text-center text-xs font-semibold text-indigo-500 whitespace-nowrap min-w-[52px]">
                              W{i + 1}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap min-w-[100px]">
                            Total Cost
                          </th>
                          <th className="px-2 py-3 w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {staffRows.map(sr => {
                          const hoursMap: Record<string, number> = {}
                          sr.weeklyHours.forEach(w => { hoursMap[w.weekStartDate] = w.hours })
                          const totalHrs = weeks.reduce((s, w) => s + (hoursMap[weekKey(w)] ?? 0), 0)
                          const rowCost  = totalHrs * (sr.costRatePerHour ?? 0)
                          const billRate = sr.effectiveBillRate ?? sr.systemBillRatePerHour

                          return (
                            <tr key={sr.id} className="hover:bg-slate-50/50 group">
                              <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-slate-200 group-hover:bg-slate-50">
                                {fmtRole(sr.resourceDesignation)}
                              </td>
                              <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap sticky left-[190px] bg-white z-10 border-r border-slate-200 group-hover:bg-slate-50">
                                {sr.location === 'INDIA' ? 'India' : 'US'}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap sticky left-[260px] bg-white z-10 border-r border-slate-200 group-hover:bg-slate-50">
                                {sr.costRatePerHour != null ? `$${sr.costRatePerHour}` : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                                {billRate != null ? `$${billRate}` : '—'}
                              </td>
                              {weeks.map((w, i) => {
                                const wk = weekKey(w)
                                const h = hoursMap[wk] ?? 0
                                const isEditing = editCell?.srId === sr.id && editCell?.wk === wk
                                return (
                                  <td key={i} className="px-1 py-2 text-center">
                                    {isEditing ? (
                                      <input
                                        autoFocus
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={editVal}
                                        onChange={e => setEditVal(e.target.value)}
                                        onBlur={() => commitHours(sr.id, wk, editVal)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                          if (e.key === 'Escape') setEditCell(null)
                                        }}
                                        className="w-14 text-center text-xs rounded-lg border border-indigo-400 px-1 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                      />
                                    ) : (
                                      <span
                                        className="cursor-pointer"
                                        onClick={() => { setEditCell({ srId: sr.id, wk }); setEditVal(String(h || '')) }}
                                      >
                                        {h > 0 ? (
                                          <span className="inline-flex h-7 min-w-[32px] items-center justify-center rounded-full bg-indigo-50 px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                                            {h}
                                          </span>
                                        ) : (
                                          <span className="text-slate-300 text-xs hover:text-slate-400">·</span>
                                        )}
                                      </span>
                                    )}
                                  </td>
                                )
                              })}
                              <td className="px-4 py-2.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                                {rowCost > 0 ? fmt(rowCost) : <span className="text-slate-300 font-normal">—</span>}
                              </td>
                              <td className="px-2 py-2.5">
                                <button
                                  onClick={() => removeRow(sr.id)}
                                  title="Remove row"
                                  className="flex h-6 w-6 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          )
                        })}

                        {/* Total row — only when there are rows */}
                        {staffRows.length > 0 && (
                          <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                            <td className="px-4 py-3 text-slate-800 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Total</td>
                            <td className="sticky left-[190px] bg-slate-50 z-10 border-r border-slate-200" />
                            <td className="sticky left-[260px] bg-slate-50 z-10 border-r border-slate-200" />
                            <td />
                            {weeks.map((w, i) => {
                              const wt = staffRows.reduce((s, sr) => {
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
                            <td className="px-4 py-3 text-right font-bold text-indigo-700">
                              {fmt(versionMetrics.totalCost)}
                            </td>
                            <td />
                          </tr>
                        )}

                        {/* Add resource row */}
                        <tr className="border-t border-dashed border-slate-200 bg-white">
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
                                  {allRateCards
                                    .filter(rc => !staffRows.some(r => r.rateCardId === rc.id))
                                    .map(rc => (
                                      <option key={rc.id} value={rc.id}>
                                        {fmtRole(rc.jobRole)} — {rc.location === 'INDIA' ? 'India' : 'US'} · ${rc.costRatePerHour}/hr
                                      </option>
                                    ))
                                  }
                                </select>
                              </td>
                              <td colSpan={weeks.length + 2} className="px-4 py-2.5">
                                <button
                                  onClick={() => setShowAddRow(false)}
                                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                  Cancel
                                </button>
                              </td>
                            </>
                          ) : (
                            <td colSpan={4 + weeks.length + 2} className="px-4 py-2.5">
                              <button
                                onClick={() => setShowAddRow(true)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                              >
                                <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-indigo-300 text-indigo-400 text-sm font-bold leading-none">
                                  +
                                </span>
                                Add Resource
                              </button>
                            </td>
                          )}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── Other Cost ───────────────────────────── */}
            {sub === 'Other Cost' && (
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 w-40">Amount</th>
                      <th className="px-2 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {otherCosts.map(oc => (
                      <tr key={oc.id} className="hover:bg-slate-50/50 group">
                        <td className="px-4 py-3 text-slate-800">{oc.description}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(oc.amount)}</td>
                        <td className="px-2 py-3">
                          <button
                            onClick={() => removeOtherCost(oc.id)}
                            title="Remove"
                            className="flex h-6 w-6 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Total row */}
                    {otherCosts.length > 0 && (
                      <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                        <td className="px-4 py-3 text-slate-800">Total</td>
                        <td className="px-4 py-3 text-right text-indigo-700">
                          {fmt(otherCosts.reduce((s, oc) => s + oc.amount, 0))}
                        </td>
                        <td />
                      </tr>
                    )}

                    {/* Add row */}
                    <tr className="border-t border-dashed border-slate-200 bg-white">
                      {showAddCost ? (
                        <>
                          <td className="px-3 py-2.5">
                            <input
                              autoFocus
                              type="text"
                              placeholder="e.g. Travel — client site visits"
                              value={newDesc}
                              onChange={e => setNewDesc(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') addOtherCost(); if (e.key === 'Escape') setShowAddCost(false) }}
                              className="w-full text-xs rounded-lg border border-indigo-300 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              placeholder="0"
                              value={newAmount}
                              onChange={e => setNewAmount(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') addOtherCost(); if (e.key === 'Escape') setShowAddCost(false) }}
                              className="w-full text-xs text-right rounded-lg border border-indigo-300 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex gap-1">
                              <button
                                onClick={addOtherCost}
                                disabled={!newDesc.trim() || !newAmount}
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                                title="Add"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              </button>
                              <button
                                onClick={() => { setShowAddCost(false); setNewDesc(''); setNewAmount('') }}
                                className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:bg-slate-100 transition-colors"
                                title="Cancel"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <td colSpan={3} className="px-4 py-2.5">
                          <button
                            onClick={() => setShowAddCost(true)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                          >
                            <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-indigo-300 text-indigo-400 text-sm font-bold leading-none">+</span>
                            Add Cost
                          </button>
                        </td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Financial ────────────────────────────── */}
            {sub === 'Financial' && (() => {
              const snaps = (version.financialSnapshots ?? []) as any[]
              const monthly = snaps
                .filter(s => s.month != null)
                .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
              const projectTotal = snaps.find(s => s.month == null) ?? null

              type MetricDef = { key: string; label: string; type: 'currency' | 'pct' | 'hours'; bold?: boolean }
              const METRICS: MetricDef[] = [
                { key: 'totalRevenue',         label: 'A  — Total Revenue (A1 + A2)',                       type: 'currency', bold: true },
                { key: 'revenueFromBilling',   label: 'A1 — Revenue from Billing (bill rate × hrs)',        type: 'currency' },
                { key: 'revenueFromOtherCost', label: 'A2 — Revenue from Other Cost (SoP / Other Cost tab)',type: 'currency' },
                { key: 'employeeCost',         label: 'B  — Employee Cost (hrs × cost/hr)',                 type: 'currency' },
                { key: 'otherCost',            label: 'C  — Other Cost (per month basis)',                  type: 'currency' },
                { key: 'grossMargin',          label: 'D  — Gross Margin (A − B − C)',                     type: 'currency', bold: true },
                { key: 'grossMarginPct',       label: 'D% — Gross Margin %',                               type: 'pct',      bold: true },
                { key: 'discountPremiumPct',   label: 'E  — Discount / Premium % (proposed / recommended)', type: 'pct' },
                { key: 'totalHours',           label: 'F  — Total Hours',                                  type: 'hours' },
                { key: 'offshoreRatio',        label: 'G  — Offshore Ratio (India hrs / total hrs)',        type: 'pct' },
                { key: 'billedRatePerHour',    label: 'H  — Billed Rate / Hour (A1 / total hrs)',           type: 'currency' },
                { key: 'effectiveRatePerHour', label: 'I  — Effective Rate / Hour (A1 / billable hrs)',     type: 'currency' },
                { key: 'indiaRate',            label: 'J  — India Rate (India revenue / India hrs)',        type: 'currency' },
                { key: 'usRate',               label: 'K  — US Rate (US revenue / US hrs)',                 type: 'currency' },
              ]

              function fmtVal(snap: any, key: string, type: 'currency' | 'pct' | 'hours') {
                const val = snap?.[key]
                if (val == null) return <span className="text-red-300 font-mono text-xs">!</span>
                const n = Number(val)
                if (type === 'currency') return fmt(n)
                if (type === 'pct')      return `${n.toFixed(1)}%`
                if (type === 'hours')    return `${n.toLocaleString()} h`
              }

              return (
                <div className="space-y-4">
                  {/* L — Business Justification */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
                      L — Business Justification
                      <span className="ml-2 text-slate-300 normal-case">(used in approval email)</span>
                    </p>
                    {version.businessJustification ? (
                      <p className="text-sm text-slate-700 leading-relaxed">{version.businessJustification}</p>
                    ) : (
                      <p className="text-sm text-slate-400 italic">Not provided. Add via the pricing version edit.</p>
                    )}
                  </div>

                  {/* A–K monthly breakdown */}
                  {snaps.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                      <p className="text-slate-400 text-sm">Financial snapshots not yet computed.</p>
                      <p className="text-xs text-slate-300 mt-1">
                        Snapshots are generated after staffing and billing data is saved.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                          Monthly Breakdown + Full Project Total
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="text-xs w-full">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 sticky left-0 bg-slate-50 z-10 min-w-[280px] whitespace-nowrap">
                                Metric
                              </th>
                              {monthly.map((s: any) => (
                                <th key={s.id} className="px-3 py-2.5 text-center font-semibold text-slate-500 whitespace-nowrap min-w-[90px]">
                                  {fmtDate(s.month)}
                                </th>
                              ))}
                              {projectTotal && (
                                <th className="px-3 py-2.5 text-center font-bold text-indigo-700 whitespace-nowrap bg-indigo-50/60 min-w-[100px]">
                                  Full Project
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {METRICS.map(({ key, label, type, bold }) => (
                              <tr key={key} className={`hover:bg-slate-50 ${bold ? 'bg-slate-50/40' : ''}`}>
                                <td className={`px-4 py-2.5 whitespace-nowrap sticky left-0 z-10 border-r border-slate-100 ${
                                  bold ? 'font-semibold text-slate-800 bg-slate-50' : 'text-slate-600 bg-white'
                                }`}>
                                  {label}
                                </td>
                                {monthly.map((s: any) => (
                                  <td key={s.id} className={`px-3 py-2.5 text-center ${bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                                    {fmtVal(s, key, type)}
                                  </td>
                                ))}
                                {projectTotal && (
                                  <td className={`px-3 py-2.5 text-center bg-indigo-50/40 ${
                                    bold ? 'font-bold text-indigo-700' : 'font-medium text-slate-700'
                                  }`}>
                                    {fmtVal(projectTotal, key, type)}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

          </div>
        </div>
      </div>
    </>
  )
}
