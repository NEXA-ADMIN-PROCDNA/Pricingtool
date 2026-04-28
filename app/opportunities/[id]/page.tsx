import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MainLayout } from '@/components/layout/MainLayout'
import { getOpportunityDetail } from '@/lib/db/opportunities'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StageBadge } from '@/components/ui/StageBadge'
import { LOBBadge } from '@/components/ui/LOBBadge'
import { StageProgress } from '@/components/ui/StageBadge'
import { ApprovalStatus } from '@prisma/client'

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value ?? '—'}</dd>
    </div>
  )
}

function fmt(n: number | null | undefined) {
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${n}`
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const APPROVAL_COLORS: Record<ApprovalStatus, string> = {
  PENDING:  'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 ring-1 ring-red-200',
}

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const opp = await getOpportunityDetail(id)
  if (!opp) notFound()

  const finalVersion = opp.pricingVersions.find(v => v.isFinal) ?? opp.pricingVersions[0]

  return (
    <MainLayout>
      {/* Breadcrumb + header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
          <Link href="/dashboard" className="hover:text-indigo-600 transition-colors">BD Tracker</Link>
          <span>/</span>
          <span className="font-mono text-indigo-600">{opp.opportunityId}</span>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">{opp.opportunityName}</h1>
              <StatusBadge status={opp.status} />
              {opp.starConnect && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                  ⭐ Star Connect
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">{opp.client.name} · {opp.opportunityId}</p>
          </div>
          <div className="flex items-center gap-2">
            <LOBBadge lob={opp.primaryLob} />
            <StageBadge stage={opp.stage} />
          </div>
        </div>

        {/* Stage progress */}
        <div className="mt-4 max-w-md">
          <StageProgress stage={opp.stage} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* LEFT — details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Overview card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-700 uppercase tracking-wide">Opportunity Details</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Field label="Client"        value={opp.client.name} />
              <Field label="Type"          value={opp.opportunityType} />
              <Field label="Owner"         value={opp.owner.name} />
              <Field label="Co-Owner"      value={opp.coOwner?.name} />
              <Field label="Start Date"    value={fmtDate(opp.startDate)} />
              <Field label="End Date"      value={fmtDate(opp.endDate)} />
              {opp.nextSteps && (
                <div className="col-span-full">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next Steps</dt>
                  <dd className="mt-0.5 text-sm text-slate-700">{opp.nextSteps}</dd>
                </div>
              )}
              {opp.notes && (
                <div className="col-span-full">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</dt>
                  <dd className="mt-0.5 text-sm text-slate-600 whitespace-pre-line">{opp.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Pricing summary card */}
          {finalVersion && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                  Pricing — v{finalVersion.versionNumber}
                  {finalVersion.isFinal && (
                    <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Final
                    </span>
                  )}
                </h2>
                {finalVersion.label && (
                  <p className="text-xs text-slate-400 italic">{finalVersion.label}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: 'Proposed Billings',   value: fmt(Number(finalVersion.proposedBillings)),   color: 'text-indigo-600' },
                  { label: 'Total Cost',           value: fmt(Number(finalVersion.totalCost)),          color: 'text-slate-700'  },
                  { label: 'Gross Margin',         value: `${Number(finalVersion.grossMarginPct ?? 0).toFixed(1)}%`, color: Number(finalVersion.grossMarginPct ?? 0) >= 35 ? 'text-emerald-600' : 'text-amber-600' },
                  { label: 'Total Hours',          value: `${Number(finalVersion.totalHours ?? 0).toLocaleString()} h`, color: 'text-slate-700' },
                  { label: 'Eff. Rate/Hour',       value: fmt(Number(finalVersion.effectiveRatePerHour)), color: 'text-slate-700' },
                  { label: 'Offshore %',           value: `${Number(finalVersion.offshorePct ?? 0).toFixed(0)}%`, color: 'text-slate-700' },
                  { label: 'Discount/Premium',     value: `${Number(finalVersion.discountPremiumPct ?? 0).toFixed(1)}%`, color: 'text-slate-700' },
                  { label: 'Revenue Share',        value: `${Number(finalVersion.revenueSharePct ?? 0).toFixed(1)}%`, color: 'text-slate-700' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
                    <p className={`mt-0.5 text-lg font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {finalVersion.businessJustification && (
                <div className="mt-4 rounded-lg bg-indigo-50 border border-indigo-100 p-3">
                  <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">Business Justification</p>
                  <p className="text-xs text-indigo-600">{finalVersion.businessJustification}</p>
                </div>
              )}

              {/* Staffing */}
              {finalVersion.staffingResources.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Staffing Resources</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          {['Designation','Location','Billable','Bill Rate/hr','Cost Rate/hr','Eff. Rate/hr'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {finalVersion.staffingResources.map(sr => (
                          <tr key={sr.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 font-medium text-slate-700">{sr.resourceDesignation.replace(/_/g, ' ')}</td>
                            <td className="px-3 py-2.5 text-slate-500">{sr.location}</td>
                            <td className="px-3 py-2.5">{sr.isBillable ? '✓' : '—'}</td>
                            <td className="px-3 py-2.5 text-slate-700">{fmt(Number(sr.systemBillRatePerHour))}</td>
                            <td className="px-3 py-2.5 text-slate-700">{fmt(Number(sr.costRatePerHour))}</td>
                            <td className="px-3 py-2.5 font-semibold text-indigo-600">{fmt(Number(sr.effectiveBillRate))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comments */}
          {opp.comments.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Comments ({opp.comments.length})
              </h2>
              <div className="space-y-4">
                {opp.comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white">
                      {c.author.name.split(' ').map(w => w[0]).slice(0,2).join('')}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-700">{c.author.name}</span>
                        <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-slate-600 bg-slate-50 rounded-xl rounded-tl-none px-3 py-2">{c.content}</p>
                      {c.replies.map(r => (
                        <div key={r.id} className="mt-2 ml-4 flex gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600">
                            {r.author.name.split(' ').map(w => w[0]).slice(0,2).join('')}
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-slate-500">{r.author.name}</p>
                            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1.5 mt-0.5">{r.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — sidebar info */}
        <div className="space-y-5">
          {/* Client card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</h2>
            <p className="font-semibold text-slate-900">{opp.client.name}</p>
            <p className="text-xs font-mono text-indigo-600">{opp.client.clientId}</p>
            {opp.client.industry && <p className="text-xs text-slate-400 mt-0.5">{opp.client.industry}</p>}
            {opp.client.pocs.length > 0 && (
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Contacts</p>
                {opp.client.pocs.map(poc => (
                  <div key={poc.id} className="text-xs">
                    <p className="font-medium text-slate-700">{poc.name}</p>
                    {poc.jobTitle && <p className="text-slate-400">{poc.jobTitle}</p>}
                    {poc.email && <p className="text-indigo-500 truncate">{poc.email}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Approvals */}
          {opp.approvalRequests.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Approvals</h2>
              <div className="space-y-3">
                {opp.approvalRequests.map(ar => (
                  <div key={ar.id} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${APPROVAL_COLORS[ar.status]}`}>
                        {ar.status}
                      </span>
                      <span className="text-[10px] text-slate-400">{fmtDate(ar.requestedAt)}</span>
                    </div>
                    <p className="text-xs text-slate-600">By: <span className="font-medium">{ar.requestedBy.name}</span></p>
                    <p className="text-xs text-slate-600">To: <span className="font-medium">{ar.approver.name}</span></p>
                    {ar.rejectionReason && (
                      <p className="mt-1 text-xs text-red-600 italic">{ar.rejectionReason}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Version history */}
          {opp.pricingVersions.length > 1 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Pricing Versions</h2>
              <div className="space-y-2">
                {opp.pricingVersions.map(v => (
                  <div key={v.id} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${v.isFinal ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                    <span className={`font-semibold ${v.isFinal ? 'text-indigo-700' : 'text-slate-600'}`}>
                      v{v.versionNumber} {v.isFinal ? '✓ Final' : ''}
                    </span>
                    <span className="text-slate-400">{v.label ?? ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
