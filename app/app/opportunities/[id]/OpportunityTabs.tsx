'use client'
import { useState } from 'react'
import { ApprovalStatus } from '@prisma/client'
import type { OpportunityDetail } from '@/lib/db/opportunities'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StageBadge } from '@/components/ui/StageBadge'
import { LOBBadge } from '@/components/ui/LOBBadge'
import { PricingDrawer } from './PricingDrawer'
import { SearchableSelect } from '@/components/ui/SearchableSelect'

type User = { id: string; name: string; role: string }

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Field({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-full' : ''}>
      <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value ?? '—'}</dd>
    </div>
  )
}

const APPROVAL_COLORS: Record<ApprovalStatus, string> = {
  PENDING:  'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 ring-1 ring-red-200',
}

// ── Tab bar ──────────────────────────────────────────────────────
const TABS = ['Details', 'Pricing', 'Approvals', 'Others'] as const
type Tab = typeof TABS[number]

export function OpportunityTabs({
  opp,
  users,
}: {
  opp: OpportunityDetail
  users: User[]
}) {
  const [tab, setTab]               = useState<Tab>('Details')
  const [drawerVersion, setDrawer]  = useState<OpportunityDetail['pricingVersions'][number] | null>(null)
  const [approverId, setApproverId] = useState('')
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [approvalError, setApprovalError]     = useState<string | null>(null)
  type ApprovalItem = OpportunityDetail['approvalRequests'][number]
  const [approvals, setApprovals] = useState<ApprovalItem[]>(opp.approvalRequests)

  async function submitApproval() {
    if (!approverId) return
    setApprovalLoading(true)
    setApprovalError(null)
    try {
      const res = await fetch(`/api/opportunities/${opp.opportunityId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverId, requestedById: opp.ownerId }),
      })
      if (!res.ok) {
        const j = await res.json()
        setApprovalError(j.error ?? 'Failed')
        return
      }
      const created = await res.json()
      setApprovals((prev: ApprovalItem[]) => [created as ApprovalItem, ...prev])
      setApproverId('')
    } catch {
      setApprovalError('Network error')
    } finally {
      setApprovalLoading(false)
    }
  }

  return (
    <>
      {/* Tab bar */}
      <div className="flex border-b border-slate-200 mb-6 gap-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 -mb-px ${
              tab === t
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
            {t === 'Pricing' && opp.pricingVersions.length > 0 && (
              <span className="ml-1.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5">
                {opp.pricingVersions.length}
              </span>
            )}
            {t === 'Approvals' && approvals.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5">
                {approvals.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Details ─────────────────────────────────────── */}
      {tab === 'Details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Core info */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-slate-500">Core Details</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <Field label="Client"       value={opp.client.name} />
                <Field label="Client ID"    value={opp.client.clientId} />
                <Field label="Business Unit" value={opp.client.businessUnit} />
                <Field label="Industry"     value={opp.client.industry} />
                <Field label="Region"       value={opp.client.region} />
                <Field label="Opp. Type"    value={opp.opportunityType === 'NEW' ? 'New Business' : 'Existing Client'} />
                <Field label="LOB"          value={opp.primaryLob} />
                <Field label="Start Date"   value={fmtDate(opp.startDate)} />
                <Field label="End Date"     value={fmtDate(opp.endDate)} />
                <Field label="Star Connect" value={opp.starConnect ? 'Yes ⭐' : 'No'} />
                {opp.nextSteps && <Field label="Next Steps" value={opp.nextSteps} wide />}
                {opp.notes     && <Field label="Notes"      value={opp.notes}     wide />}
              </dl>
            </div>

            {/* Team */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-slate-500">Team</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <Field label="Owner"    value={opp.owner.name} />
                <Field label="Co-Owner" value={opp.coOwner?.name} />
              </dl>
            </div>

            {/* Client POCs */}
            {opp.client.pocs.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Client Contacts (POCs)</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {opp.client.pocs.map(poc => (
                    <div key={poc.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-sm font-semibold text-slate-800">{poc.name}</p>
                      {poc.jobTitle && <p className="text-xs text-slate-500 mt-0.5">{poc.jobTitle}</p>}
                      {poc.email    && <p className="text-xs text-indigo-600 mt-0.5">{poc.email}</p>}
                      {poc.phone    && <p className="text-xs text-slate-400 mt-0.5">{poc.phone}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Status</h2>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={opp.status} />
                <StageBadge  stage={opp.stage}   />
                <LOBBadge    lob={opp.primaryLob} />
              </div>
            </div>

            {opp.pricingVersions.length > 0 && (() => {
              const final = opp.pricingVersions.find(v => v.isFinal) ?? opp.pricingVersions.at(-1)!
              return (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Pricing Snapshot · v{final.versionNumber}
                    {final.isFinal && <span className="ml-1.5 text-emerald-600">✓ Final</span>}
                  </h2>
                  <dl className="space-y-2 text-xs">
                    {[
                      ['Proposed Billings', final.proposedBillings != null ? `$${Number(final.proposedBillings).toLocaleString()}` : '!'],
                      ['Gross Margin',      final.grossMarginPct   != null ? `${Number(final.grossMarginPct).toFixed(1)}%`          : '!'],
                      ['Total Hours',       final.totalHours       != null ? `${Number(final.totalHours).toLocaleString()} h`       : '!'],
                      ['Offshore %',        final.offshorePct      != null ? `${Number(final.offshorePct).toFixed(0)}%`             : '!'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <dt className="text-slate-400">{label}</dt>
                        <dd className="font-semibold text-slate-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <button
                    onClick={() => { setTab('Pricing') }}
                    className="mt-3 w-full rounded-lg bg-indigo-50 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                  >
                    View Pricing →
                  </button>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── Tab: Pricing ─────────────────────────────────────── */}
      {tab === 'Pricing' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Click a version to open detailed pricing.</p>
          </div>

          {opp.pricingVersions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <p className="text-slate-400 text-sm">No pricing versions yet.</p>
            </div>
          )}

          <div className="space-y-2">
            {opp.pricingVersions.map(v => {
              const billings = v.proposedBillings != null ? Number(v.proposedBillings) : null
              const margin   = v.grossMarginPct   != null ? Number(v.grossMarginPct)   : null
              return (
                <button
                  key={v.id}
                  onClick={() => setDrawer(v)}
                  className="w-full text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
                        v.isFinal ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        P{v.versionNumber}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">Version {v.versionNumber}</span>
                          {v.isFinal && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                              Final
                            </span>
                          )}
                        </div>
                        {v.label && <p className="text-xs text-slate-400 mt-0.5 italic">{v.label}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-xs">
                      <div className="text-right">
                        <p className="text-slate-400">Billings</p>
                        <p className="font-bold text-slate-800">
                          {billings != null ? `$${(billings / 1000).toFixed(0)}K` : '!'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-400">Margin</p>
                        <p className={`font-bold ${margin != null && margin >= 35 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {margin != null ? `${margin.toFixed(1)}%` : '!'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-400">Hours</p>
                        <p className="font-bold text-slate-800">
                          {v.totalHours != null ? `${Number(v.totalHours).toLocaleString()} h` : '!'}
                        </p>
                      </div>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Tab: Approvals ───────────────────────────────────── */}
      {tab === 'Approvals' && (
        <div className="max-w-2xl space-y-5">
          {/* Request new approval */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Request Approval</h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <SearchableSelect
                  options={users.map(u => ({ value: u.id, label: u.name, sub: u.role }))}
                  value={approverId}
                  onChange={setApproverId}
                  placeholder="Search approver by name…"
                  emptyMessage="No matching users found."
                />
              </div>
              <button
                onClick={submitApproval}
                disabled={!approverId || approvalLoading}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {approvalLoading ? 'Sending…' : 'Send Request'}
              </button>
            </div>
            {approvalError && (
              <p className="mt-2 text-xs text-red-600">{approvalError}</p>
            )}
          </div>

          {/* Existing approvals */}
          {approvals.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Approval History ({approvals.length})
              </h2>
              <div className="space-y-3">
                {approvals.map((ar: any) => (
                  <div key={ar.id} className="rounded-xl border border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm text-slate-700">
                          Requested by <span className="font-semibold">{ar.requestedBy.name}</span>
                        </p>
                        <p className="text-sm text-slate-700">
                          Approver: <span className="font-semibold">{ar.approver.name}</span>
                          <span className="ml-1 text-xs text-slate-400">({ar.approver.role})</span>
                        </p>
                        <p className="text-xs text-slate-400">{fmtDate(ar.requestedAt)}</p>
                        {ar.rejectionReason && (
                          <p className="text-xs text-red-600 italic mt-1">{ar.rejectionReason}</p>
                        )}
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${APPROVAL_COLORS[ar.status as ApprovalStatus]}`}>
                        {ar.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {approvals.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-slate-400 text-sm">No approval requests yet.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Others ──────────────────────────────────────── */}
      {tab === 'Others' && (
        <div className="max-w-2xl space-y-5">
          {/* Comments */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Comments {opp.comments.length > 0 && `(${opp.comments.length})`}
            </h2>
            {opp.comments.length === 0 ? (
              <p className="text-sm text-slate-400">No comments yet.</p>
            ) : (
              <div className="space-y-4">
                {opp.comments.map((c: any) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white">
                      {c.author.name.split(' ').map((w: string) => w[0]).slice(0,2).join('')}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-700">{c.author.name}</span>
                        <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-slate-600 bg-slate-50 rounded-xl rounded-tl-none px-3 py-2">{c.content}</p>
                      {c.replies?.map((r: any) => (
                        <div key={r.id} className="mt-2 ml-4 flex gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600">
                            {r.author.name.split(' ').map((w: string) => w[0]).slice(0,2).join('')}
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
            )}
          </div>

          {/* SOW / Documents placeholder */}
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">SOW Documents</p>
            <p className="text-sm text-slate-400">Document upload coming soon.</p>
          </div>
        </div>
      )}

      {/* Pricing Drawer */}
      {drawerVersion && (
        <PricingDrawer
          version={drawerVersion}
          opp={opp}
          onClose={() => setDrawer(null)}
        />
      )}
    </>
  )
}
