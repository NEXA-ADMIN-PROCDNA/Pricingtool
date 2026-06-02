'use client'
import type { OpportunityDetail } from '@/lib/db/opportunities'
import type { Version, ComputedMetrics, OtherCostRow } from './types'
import { fmt, fmtDate } from './utils'

const DOMAIN_LABELS: Record<string, string> = {
  ANALYTICS: 'Analytics',
  MS:        'Managed Services',
  DS:        'Data Science',
  DESIGN:    'Design',
  TECH:      'Technology',
  AUXO:      'Auxo',
}

function ReadField({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium ${highlight ? 'text-indigo-700' : 'text-slate-800'}`}>
        {value ?? '—'}
      </dd>
    </div>
  )
}

interface Props {
  version: Version
  opp: OpportunityDetail
  versionMetrics: ComputedMetrics
  otherCosts: OtherCostRow[]
}

export function TabBasicDetails({ version, opp, versionMetrics, otherCosts }: Props) {
  const domainRevMap: Record<string, number> = {}
  for (const r of version.staffingResources) {
    if (!r.domain) continue
    const effRate = Number(r.effectiveBillRate ?? 0)
    const totalHrs = r.weeklyHours.reduce((s: number, w: { hours: number | { toNumber(): number } }) => s + Number(w.hours ?? 0), 0)
    if (totalHrs <= 0) continue
    // revenue when rate exists; fall back to hours so zero-rate resources still appear
    const weight = effRate > 0 ? effRate * totalHrs : totalHrs
    domainRevMap[r.domain] = (domainRevMap[r.domain] ?? 0) + weight
  }
  const grandTotal = Object.values(domainRevMap).reduce((s, v) => s + v, 0)
  const domainPcts = grandTotal > 0
    ? Object.entries(domainRevMap)
        .map(([d, v]) => ({ domain: d, label: DOMAIN_LABELS[d] ?? d, pct: (v / grandTotal) * 100 }))
        .sort((a, b) => b.pct - a.pct)
    : []
  const majorityDomain = domainPcts[0]?.domain
  // Primary LOB = the dominant LoB from the revenue mix (the highlighted chip).
  // Fall back to the opportunity's stored primaryLob when there's no staffing
  // data yet to derive a mix.
  const primaryLobLabel = majorityDomain
    ? (DOMAIN_LABELS[majorityDomain] ?? majorityDomain)
    : (opp.primaryLob ? (DOMAIN_LABELS[opp.primaryLob] ?? opp.primaryLob) : null)

  return (
    <div className="space-y-5">
      {/* Auto-filled from opportunity */}
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          From Opportunity (auto-filled)
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 opacity-75">
          <ReadField label="Client Name"      value={opp.client.name} />
          <ReadField label="Opportunity Name" value={opp.opportunityName} />
          <ReadField label="Start Date"       value={new Date(opp.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} />
          <ReadField label="End Date"         value={new Date(opp.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} />
          <ReadField label="Primary LOB"      value={primaryLobLabel} highlight />
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
          {/* Domain Revenue Mix — spans full row */}
          <div className="col-span-2 sm:col-span-4 rounded-xl bg-slate-50 p-3">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2">LoB Revenue Mix</p>
            {domainPcts.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {domainPcts.map(({ domain, label, pct }) => (
                  <span key={domain} className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    domain === majorityDomain
                      ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {label}&nbsp;·&nbsp;{pct.toFixed(1)}%
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-base font-bold text-slate-800">—</p>
            )}
          </div>
          {[
            { label: 'Proposed Billings',  value: fmt(versionMetrics.totalHours > 0 ? versionMetrics.proposedBillings    : (version.proposedBillings    != null ? Number(version.proposedBillings)    : null)), hi: true },
            { label: 'Total Cost',         value: fmt(versionMetrics.totalHours > 0 ? versionMetrics.totalCost            : (version.totalCost            != null ? Number(version.totalCost)            : null)) },
            { label: 'Gross Margin %',     value: versionMetrics.totalHours > 0 ? `${versionMetrics.grossMarginPct.toFixed(1)}%`      : (version.grossMarginPct      != null ? `${Number(version.grossMarginPct).toFixed(1)}%`      : '0.0%'), hi: true },
            { label: 'Discount / Premium', value: versionMetrics.totalHours > 0 ? `${versionMetrics.discountPremiumPct.toFixed(1)}%`  : (version.discountPremiumPct  != null ? `${Number(version.discountPremiumPct).toFixed(1)}%`  : '0.0%') },
            { label: 'Eff. Rate / Hour',   value: fmt(versionMetrics.totalHours > 0 ? versionMetrics.effectiveRatePerHour             : (version.effectiveRatePerHour != null ? Number(version.effectiveRatePerHour)                   : null)) },
            { label: 'Total Hours',        value: versionMetrics.totalHours > 0 ? `${versionMetrics.totalHours.toLocaleString()} h`   : (version.totalHours          != null ? `${Number(version.totalHours).toLocaleString()} h`      : '0 h') },
            { label: 'Offshore %',         value: versionMetrics.totalHours > 0 ? `${versionMetrics.offshorePct.toFixed(0)}%`         : (version.offshorePct          != null ? `${Number(version.offshorePct).toFixed(0)}%`           : '0%') },
          ].map(({ label, value, hi }) => (
            <div key={label} className={`rounded-xl p-3 ${
              hi ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50'
            }`}>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
              <p className={`text-base font-bold ${hi ? 'text-indigo-700' : 'text-slate-800'}`}>{value}</p>
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
  )
}
