'use client'
import { useState, useEffect } from 'react'
import type { OpportunityDetail } from '@/lib/db/opportunities'

type Version = OpportunityDetail['pricingVersions'][number]

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
                  {t === 'Efforts' && version.staffingResources.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5">
                      {version.staffingResources.length}
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

                {/* Pricing metrics */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Pricing Metrics</p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      { label: 'Revenue Share',      value: version.revenueSharePct    != null ? `${Number(version.revenueSharePct).toFixed(2)}%`    : '!' },
                      { label: 'Proposed Billings',  value: fmt(version.proposedBillings != null ? Number(version.proposedBillings) : null), hi: true },
                      { label: 'Total Cost',         value: fmt(version.totalCost        != null ? Number(version.totalCost)        : null) },
                      { label: 'Gross Margin %',     value: version.grossMarginPct      != null ? `${Number(version.grossMarginPct).toFixed(1)}%`     : '!', hi: true },
                      { label: 'Discount / Premium', value: version.discountPremiumPct  != null ? `${Number(version.discountPremiumPct).toFixed(1)}%` : '!' },
                      { label: 'Eff. Rate / Hour',   value: fmt(version.effectiveRatePerHour != null ? Number(version.effectiveRatePerHour) : null) },
                      { label: 'Total Hours',        value: version.totalHours          != null ? `${Number(version.totalHours).toLocaleString()} h`  : '!' },
                      { label: 'Offshore %',         value: version.offshorePct         != null ? `${Number(version.offshorePct).toFixed(0)}%`        : '!' },
                    ].map(({ label, value, hi }) => (
                      <div key={label} className={`rounded-xl p-3 ${hi ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50'}`}>
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                        <p className={`text-base font-bold ${hi ? 'text-indigo-700' : 'text-slate-800'} ${value === '!' ? 'text-red-400' : ''}`}>
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
                {version.staffingResources.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                    <p className="text-slate-400 text-sm">No staffing resources added.</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sticky left-0 bg-slate-50 z-10 min-w-[200px] whitespace-nowrap">
                              Role
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap min-w-[80px]">
                              Location
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap min-w-[90px]">
                              Cost Rate
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap min-w-[90px]">
                              Bill Rate
                            </th>
                            {weeks.map((_, i) => (
                              <th key={i} className="px-2 py-3 text-center text-xs font-semibold text-indigo-500 whitespace-nowrap min-w-[48px]">
                                W{i + 1}
                              </th>
                            ))}
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                              Total Hrs
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {version.staffingResources.map(sr => {
                            const hoursMap: Record<string, number> = {}
                            sr.weeklyHours.forEach((w: any) => {
                              hoursMap[new Date(w.weekStartDate).toISOString().slice(0, 10)] = Number(w.hours)
                            })
                            const total = weeks.reduce((s, w) => s + (hoursMap[weekKey(w)] ?? 0), 0)

                            return (
                              <tr key={sr.id} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-slate-100">
                                  {sr.resourceDesignation.replace(/_/g, ' ')}
                                </td>
                                <td className="px-3 py-3 text-slate-500 whitespace-nowrap">
                                  {sr.location === 'INDIA' ? 'India' : 'US'}
                                </td>
                                <td className="px-3 py-3 text-slate-700 whitespace-nowrap">
                                  {sr.costRatePerHour != null ? `$${Number(sr.costRatePerHour)}` : '!'}
                                </td>
                                <td className="px-3 py-3 text-slate-700 whitespace-nowrap">
                                  {sr.effectiveBillRate != null
                                    ? `$${Number(sr.effectiveBillRate)}`
                                    : sr.systemBillRatePerHour != null
                                      ? `$${Number(sr.systemBillRatePerHour)}`
                                      : '!'}
                                </td>
                                {weeks.map((w, i) => {
                                  const h = hoursMap[weekKey(w)] ?? 0
                                  return (
                                    <td key={i} className="px-1 py-3 text-center">
                                      {h > 0 ? (
                                        <span className="inline-flex h-7 min-w-[32px] items-center justify-center rounded-full bg-indigo-50 px-2 text-xs font-semibold text-indigo-700">
                                          {h}
                                        </span>
                                      ) : (
                                        <span className="text-slate-300 text-xs">0</span>
                                      )}
                                    </td>
                                  )
                                })}
                                <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                                  {total > 0 ? total : '—'}
                                </td>
                              </tr>
                            )
                          })}

                          {/* Total row */}
                          <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                            <td className="px-4 py-3 text-slate-800 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                              Total
                            </td>
                            <td /><td /><td />
                            {weeks.map((w, i) => {
                              const weekTotal = version.staffingResources.reduce((s, sr) => {
                                const hm: Record<string, number> = {}
                                sr.weeklyHours.forEach((wh: any) => {
                                  hm[new Date(wh.weekStartDate).toISOString().slice(0, 10)] = Number(wh.hours)
                                })
                                return s + (hm[weekKey(w)] ?? 0)
                              }, 0)
                              return (
                                <td key={i} className="px-1 py-3 text-center font-bold text-slate-700">
                                  {weekTotal > 0 ? weekTotal : (
                                    <span className="font-normal text-slate-300 text-xs">0</span>
                                  )}
                                </td>
                              )
                            })}
                            <td className="px-4 py-3 text-right font-bold text-indigo-600">
                              {version.staffingResources.reduce(
                                (s, sr) => s + sr.weeklyHours.reduce((ws: number, w: any) => ws + Number(w.hours), 0),
                                0
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Other Cost ───────────────────────────── */}
            {sub === 'Other Cost' && (() => {
              const otherCosts: any[] = (opp as any).otherCosts ?? []
              return (
              <div className="space-y-4">
                {otherCosts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                    <p className="text-slate-400 text-sm">No other costs recorded.</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50">
                            {['Description', 'Month', 'Amount', 'Billable'].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {otherCosts.map((oc: any) => (
                            <tr key={oc.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-slate-800 font-medium">{oc.description}</td>
                              <td className="px-4 py-3 text-slate-500">{oc.month ? fmtDate(oc.month) : '—'}</td>
                              <td className="px-4 py-3 font-semibold text-slate-800">{fmt(Number(oc.amount))}</td>
                              <td className="px-4 py-3">
                                {oc.isBillable ? (
                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Billable</span>
                                ) : (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Non-billable</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end">
                      <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-2 text-sm">
                        Total:{' '}
                        <span className="font-bold text-slate-800">
                          {fmt(otherCosts.reduce((s: number, oc: any) => s + Number(oc.amount), 0))}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
              )
            })()}

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
