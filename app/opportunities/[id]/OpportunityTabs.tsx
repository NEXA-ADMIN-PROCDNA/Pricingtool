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
const TABS = ['Details', 'Pricing', 'Approvals', 'Comments'] as const
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

  type PricingVersion = OpportunityDetail['pricingVersions'][number]
  const [pricingVersions, setPricingVersions] = useState<PricingVersion[]>(opp.pricingVersions)
  const [creatingVersion, setCreatingVersion] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  async function closeDrawer() {
    if (drawerVersion) {
      const res = await fetch(`/api/pricing-versions/${drawerVersion.id}`)
      if (res.ok) {
        const updated = await res.json() as PricingVersion
        setPricingVersions(prev => prev.map(v => v.id === updated.id ? updated : v))
      }
    }
    setDrawer(null)
  }

  async function deleteVersion(versionId: string) {
    const res = await fetch(`/api/pricing-versions/${versionId}`, { method: 'DELETE' })
    if (!res.ok) return
    setPricingVersions(prev => prev.filter(v => v.id !== versionId))
    setConfirmDeleteId(null)
  }

  async function duplicateVersion(versionId: string) {
    const res = await fetch(`/api/pricing-versions/${versionId}/duplicate`, { method: 'POST' })
    if (!res.ok) return
    const newVersion = await res.json() as PricingVersion
    setPricingVersions(prev => [...prev, newVersion])
  }

  async function markAsFinal(versionId: string) {
    await fetch(`/api/pricing-versions/${versionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFinal: true }),
    })
    setPricingVersions(prev => prev.map(v => ({ ...v, isFinal: v.id === versionId })))
  }

  async function createPricingVersion() {
    setCreatingVersion(true)
    try {
      const res = await fetch(`/api/opportunities/${opp.opportunityId}/pricing-versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) return
      const version = await res.json() as PricingVersion
      setPricingVersions(prev => [...prev, version])
      setDrawer(version)
    } finally {
      setCreatingVersion(false)
    }
  }

  const [approverId, setApproverId] = useState('')
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [approvalError, setApprovalError]     = useState<string | null>(null)
  type ApprovalItem = OpportunityDetail['approvalRequests'][number]
  const [approvals, setApprovals] = useState<ApprovalItem[]>(opp.approvalRequests)

  type CommentItem = OpportunityDetail['comments'][number]
  const [comments, setComments] = useState<CommentItem[]>(() => [...opp.comments].reverse())
  const [newComment, setNewComment] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)

  async function submitComment() {
    if (!newComment.trim()) return
    setCommentLoading(true)
    setCommentError(null)
    try {
      const res = await fetch(`/api/opportunities/${opp.opportunityId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setCommentError(j.error ?? 'Failed to post comment')
        return
      }
      const created = await res.json()
      setComments(prev => [...prev, created as CommentItem])
      setNewComment('')
    } catch {
      setCommentError('Network error')
    } finally {
      setCommentLoading(false)
    }
  }

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
            {t === 'Pricing' && pricingVersions.length > 0 && (
              <span className="ml-1.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5">
                {pricingVersions.length}
              </span>
            )}
            {t === 'Approvals' && approvals.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5">
                {approvals.length}
              </span>
            )}
            {t === 'Comments' && comments.length > 0 && (
              <span className="ml-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5">
                {comments.length}
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

            {pricingVersions.length > 0 && (() => {
              const final = pricingVersions.find(v => v.isFinal) ?? pricingVersions.at(-1)!
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
            <p className="text-sm text-slate-500">
              {pricingVersions.length > 0 ? 'Click a version to open detailed pricing.' : 'No pricing versions yet.'}
            </p>
            <button
              onClick={createPricingVersion}
              disabled={creatingVersion}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {creatingVersion ? 'Creating…' : 'New Version'}
            </button>
          </div>

          {pricingVersions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6 text-indigo-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-600 mb-1">No pricing versions yet</p>
              <p className="text-xs text-slate-400 mb-5">Create your first version to start adding staffing, costs, and financials.</p>
              <button
                onClick={createPricingVersion}
                disabled={creatingVersion}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {creatingVersion ? 'Creating…' : 'Create First Pricing Version'}
              </button>
            </div>
          )}

          <div className="space-y-2">
            {pricingVersions.map(v => {
              const billings = v.proposedBillings != null ? Number(v.proposedBillings) : null
              const margin   = v.grossMarginPct   != null ? Number(v.grossMarginPct)   : null
              return (
                <div
                  key={v.id}
                  className={`w-full rounded-2xl border bg-white shadow-sm transition-all group ${
                    v.isFinal ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  {/* Clickable open area */}
                  <button
                    onClick={() => setDrawer(v)}
                    className="w-full text-left p-4"
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
                            {billings != null ? `$${(billings / 1000).toFixed(0)}K` : '—'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-400">Margin</p>
                          <p className={`font-bold ${margin != null && margin >= 35 ? 'text-emerald-600' : margin != null ? 'text-amber-600' : 'text-slate-300'}`}>
                            {margin != null ? `${margin.toFixed(1)}%` : '—'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-400">Hours</p>
                          <p className="font-bold text-slate-800">
                            {v.totalHours != null ? `${Number(v.totalHours).toLocaleString()} h` : '—'}
                          </p>
                        </div>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {/* Card footer */}
                  <div className={`border-t px-4 py-2 flex items-center justify-between ${v.isFinal ? 'border-emerald-100' : 'border-slate-100'}`}>
                    {/* Left: selected-for-approval label or mark-as-final */}
                    {v.isFinal ? (
                      <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                        </svg>
                        Selected for approval
                      </span>
                    ) : (
                      <button
                        onClick={() => markAsFinal(v.id)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Mark as Final
                      </button>
                    )}

                    {/* Right: duplicate + delete */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => duplicateVersion(v.id)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                        </svg>
                        Duplicate
                      </button>

                      {confirmDeleteId === v.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-red-600 font-semibold px-1">Delete?</span>
                          <button
                            onClick={() => deleteVersion(v.id)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                          >
                            Yes, delete
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(v.id)}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
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

      {/* ── Tab: Comments ────────────────────────────────────── */}
      {tab === 'Comments' && (
        <div className="max-w-2xl space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

            {/* Thread */}
            {comments.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-slate-400">No comments yet. Be the first to add one.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 px-6 pt-6 pb-2 space-y-4">
                {comments.map((c: any) => (
                  <div key={c.id} className="flex gap-3 pb-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white">
                      {c.author.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-700">{c.author.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {' · '}
                          {new Date(c.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 bg-slate-50 rounded-xl rounded-tl-none px-3 py-2 whitespace-pre-wrap">
                        {c.content}
                      </p>
                      {c.replies?.map((r: any) => (
                        <div key={r.id} className="mt-2 ml-4 flex gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600">
                            {r.author.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <p className="text-[10px] font-semibold text-slate-500">{r.author.name}</p>
                              <span className="text-[9px] text-slate-300">
                                {new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1.5">{r.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Compose box */}
            <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <textarea
                rows={3}
                placeholder="Add a comment…"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment()
                }}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-colors"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-slate-300">⌘ Enter to post</span>
                <button
                  onClick={submitComment}
                  disabled={!newComment.trim() || commentLoading}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                >
                  {commentLoading ? 'Posting…' : 'Post Comment'}
                </button>
              </div>
              {commentError && (
                <p className="mt-1.5 text-xs text-red-500">{commentError}</p>
              )}
            </div>
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
          onClose={closeDrawer}
        />
      )}
    </>
  )
}
