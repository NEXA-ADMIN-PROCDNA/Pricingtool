'use client'
import { useState, useEffect } from 'react'
import type { OpportunityDetail } from '@/lib/db/opportunities'

type Version = OpportunityDetail['pricingVersions'][number]

const SUB_TABS = ['Basic Details', 'Other Costs', 'Efforts'] as const
type SubTab = typeof SUB_TABS[number]

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

// ── Generate Monday-aligned weeks between two dates ───────────────
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

// ── Main Drawer ───────────────────────────────────────────────────
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

  // Close on Escape
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
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col bg-white shadow-2xl">
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
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
        <div className="flex border-b border-slate-200 px-6 gap-1 shrink-0">
          {SUB_TABS.map(t => (
            <button
              key={t}
              onClick={() => setSub(t)}
              className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px ${
                sub === t
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t}
              {t === 'Efforts' && version.staffingResources.length > 0 && (
                <span className="ml-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5">
                  {version.staffingResources.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sub-tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Basic Details ──────────────────────────── */}
          {sub === 'Basic Details' && (
            <div className="space-y-5">
              {/* Autofilled from opportunity — greyed section */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
                <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  From Opportunity (auto-filled)
                </p>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 opacity-75">
                  <ReadField label="Client Name"       value={opp.client.name} />
                  <ReadField label="Opportunity Type"  value={opp.opportunityType === 'NEW' ? 'New Business' : 'Existing Client'} />
                  <ReadField label="Opportunity Name"  value={opp.opportunityName} />
                  <ReadField label="Start Date"        value={new Date(opp.startDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })} />
                  <ReadField label="End Date"          value={new Date(opp.endDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })} />
                  <ReadField label="Primary LOB"       value={opp.primaryLob} />
                </dl>
              </div>

              {/* Pricing metrics */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Pricing Metrics</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: 'Revenue Share',     value: version.revenueSharePct    != null ? `${Number(version.revenueSharePct).toFixed(2)}%`   : '!' },
                    { label: 'Proposed Billings', value: fmt(version.proposedBillings != null ? Number(version.proposedBillings) : null), hi: true },
                    { label: 'Total Cost',        value: fmt(version.totalCost        != null ? Number(version.totalCost)        : null) },
                    { label: 'Gross Margin %',    value: version.grossMarginPct      != null ? `${Number(version.grossMarginPct).toFixed(1)}%`    : '!', hi: true },
                    { label: 'Discount / Premium',value: version.discountPremiumPct  != null ? `${Number(version.discountPremiumPct).toFixed(1)}%`: '!' },
                    { label: 'Eff. Rate / Hour',  value: fmt(version.effectiveRatePerHour != null ? Number(version.effectiveRatePerHour) : null) },
                    { label: 'Total Hours',       value: version.totalHours          != null ? `${Number(version.totalHours).toLocaleString()} h` : '!' },
                    { label: 'Offshore %',        value: version.offshorePct         != null ? `${Number(version.offshorePct).toFixed(0)}%`       : '!' },
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

              {/* Business justification */}
              {version.businessJustification && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-600 mb-2">Business Justification</p>
                  <p className="text-sm text-indigo-800">{version.businessJustification}</p>
                </div>
              )}

              {/* Schedule of Payments */}
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
                            <td className="px-3 py-2 text-slate-600">{fmt(sop.recommendedBillings != null ? Number(sop.recommendedBillings) : null)}</td>
                            <td className="px-3 py-2 text-slate-600">{fmt(sop.recommendedOtherCost != null ? Number(sop.recommendedOtherCost) : null)}</td>
                            <td className="px-3 py-2 font-semibold text-slate-800">{fmt(sop.proposedBillings != null ? Number(sop.proposedBillings) : null)}</td>
                            <td className="px-3 py-2 text-slate-600">{fmt(sop.proposedOtherCost != null ? Number(sop.proposedOtherCost) : null)}</td>
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

          {/* ── Other Costs ────────────────────────────── */}
          {sub === 'Other Costs' && (
            <div className="space-y-4">
              {opp.otherCosts.length === 0 ? (
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
                        {opp.otherCosts.map((oc: any) => (
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
                        {fmt(opp.otherCosts.reduce((s: number, oc: any) => s + Number(oc.amount), 0))}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Efforts (Staffing) ─────────────────────── */}
          {sub === 'Efforts' && (
            <div className="space-y-4">
              {version.staffingResources.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                  <p className="text-slate-400 text-sm">No staffing resources added.</p>
                </div>
              ) : (
                <>
                  {/* Resource summary table */}
                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Resources</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/50">
                            {[
                              'Resource Designation',
                              'Billable',
                              'Location',
                              'Bill Rate/hr (System)',
                              'Discount / Premium %',
                              'Bill Rate/hr (Effective)',
                              'Cost Rate/hr',
                              'Total Hours',
                            ].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {version.staffingResources.map(sr => {
                            const totalHrs = sr.weeklyHours.reduce((s: number, w: any) => s + Number(w.hours), 0)
                            return (
                              <tr key={sr.id} className="hover:bg-slate-50">
                                <td className="px-3 py-3 font-semibold text-slate-800 whitespace-nowrap">
                                  {sr.resourceDesignation.replace(/_/g, ' ')}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={sr.isBillable}
                                    readOnly
                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 cursor-default"
                                  />
                                </td>
                                <td className="px-3 py-3">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    sr.location === 'INDIA'
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-blue-50 text-blue-700'
                                  }`}>
                                    {sr.location}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-slate-700">
                                  {sr.systemBillRatePerHour != null ? `$${Number(sr.systemBillRatePerHour)}` : '!'}
                                </td>
                                <td className="px-3 py-3 text-slate-700">
                                  {sr.discountPremiumPct != null ? `${Number(sr.discountPremiumPct).toFixed(1)}%` : '—'}
                                </td>
                                <td className="px-3 py-3 font-semibold text-indigo-700">
                                  {sr.effectiveBillRate != null ? `$${Number(sr.effectiveBillRate)}` : '!'}
                                </td>
                                <td className="px-3 py-3 text-slate-700">
                                  {sr.costRatePerHour != null ? `$${Number(sr.costRatePerHour)}` : '!'}
                                </td>
                                <td className="px-3 py-3 font-semibold text-slate-800">
                                  {totalHrs > 0 ? `${totalHrs} h` : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Weekly staffing grid */}
                  {weeks.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                          Weekly Hours Grid ({weeks.length} weeks)
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                              <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap sticky left-0 bg-slate-50 z-10">
                                Resource
                              </th>
                              {weeks.map(w => (
                                <th key={weekKey(w)} className="px-2 py-2.5 text-center font-semibold text-slate-400 whitespace-nowrap min-w-[52px]">
                                  {w.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                </th>
                              ))}
                              <th className="px-3 py-2.5 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {version.staffingResources.map(sr => {
                              const hoursMap: Record<string, number> = {}
                              sr.weeklyHours.forEach((w: any) => {
                                hoursMap[new Date(w.weekStartDate).toISOString().slice(0, 10)] = Number(w.hours)
                              })
                              const total = Object.values(hoursMap).reduce((s, h) => s + h, 0)
                              return (
                                <tr key={sr.id} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap sticky left-0 bg-white">
                                    {sr.resourceDesignation.replace(/_/g, ' ')}
                                    <span className={`ml-1 text-[9px] ${sr.location === 'INDIA' ? 'text-amber-600' : 'text-blue-600'}`}>
                                      {sr.location}
                                    </span>
                                  </td>
                                  {weeks.map(w => {
                                    const h = hoursMap[weekKey(w)]
                                    return (
                                      <td key={weekKey(w)} className="px-2 py-2 text-center">
                                        {h > 0 ? (
                                          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-indigo-50 text-[10px] font-bold text-indigo-700 mx-auto">
                                            {h}
                                          </span>
                                        ) : (
                                          <span className="text-slate-200">—</span>
                                        )}
                                      </td>
                                    )
                                  })}
                                  <td className="px-3 py-2 text-right font-bold text-slate-800">
                                    {total > 0 ? `${total} h` : '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
