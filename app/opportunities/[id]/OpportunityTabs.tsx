'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { ApprovalStatus } from '@prisma/client'
import type { OpportunityDetail } from '@/lib/db/opportunities'
import { STAGE_NEXT_STEPS } from '@/lib/stageNextSteps'
import { StageBadge } from '@/components/ui/StageBadge'
import { LOBBadge } from '@/components/ui/LOBBadge'
import { PricingDrawer } from './PricingDrawer'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { TabSoW } from './TabSoW'

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
  PENDING:   'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  APPROVED:  'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  REJECTED:  'bg-red-50 text-red-700 ring-1 ring-red-200',
  WITHDRAWN: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
}

// ── Tab bar ──────────────────────────────────────────────────────
const TABS = ['Details', 'Pricing', 'Pricing Approval', 'SOW / PO', 'Project Code', 'Comments'] as const
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
    if (!res.ok) {
      toast.error('Failed to delete pricing version')
      return
    }
    setPricingVersions(prev => prev.filter(v => v.id !== versionId))
    setConfirmDeleteId(null)
  }

  async function duplicateVersion(versionId: string) {
    const res = await fetch(`/api/pricing-versions/${versionId}/duplicate`, { method: 'POST' })
    if (!res.ok) {
      toast.error('Failed to duplicate pricing version')
      return
    }
    const newVersion = await res.json() as PricingVersion
    setPricingVersions(prev => [...prev, newVersion])
  }

  async function markAsFinal(versionId: string) {
    if (pricingLocked) { setFinalWarningId(versionId); return }
    await doMarkAsFinal(versionId)
  }

  async function doMarkAsFinal(versionId: string) {
    const res = await fetch(`/api/pricing-versions/${versionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFinal: true }),
    })
    if (!res.ok) { toast.error('Failed to mark version as final'); return }
    setPricingVersions(prev => prev.map(v => ({ ...v, isFinal: v.id === versionId })))
    if (['LEAD', 'PRICE_LINKING_PENDING', 'SOW_PENDING', 'SOW_SUBMITTED'].includes(oppStage)) {
      setOppStage('PRICE_LINKED')
    }
  }

  async function createPricingVersion() {
    setCreatingVersion(true)
    try {
      const res = await fetch(`/api/opportunities/${opp.opportunityId}/pricing-versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        toast.error('Failed to create pricing version')
        return
      }
      const version = await res.json() as PricingVersion
      setPricingVersions(prev => [...prev, version])
      setDrawer(version)
    } finally {
      setCreatingVersion(false)
    }
  }

  const [finalWarningId, setFinalWarningId]   = useState<string | null>(null)

  const { data: session } = useSession()
  const sessionUserId = (session?.user as any)?.id as string | undefined

  const [oppStage, setOppStage]   = useState<string>(opp.stage as string)
  const LOCKED_STAGES = ['APPROVAL_PENDING', 'SOW_PENDING', 'SOW_SUBMITTED', 'SOW_REVIEW_PENDING', 'TO_BE_ARCHIVED']
  const pricingLocked = LOCKED_STAGES.includes(oppStage)

  const [approverId, setApproverId]                     = useState('')
  const [ccIds, setCcIds]                               = useState<string[]>([])
  const [businessJustification, setBusinessJustification] = useState('')
  const [approvalLoading, setApprovalLoading]           = useState(false)
  const [approvalError, setApprovalError]               = useState<string | null>(null)
  const [approvalConfirm, setApprovalConfirm]           = useState(false)
  const [withdrawConfirm, setWithdrawConfirm]           = useState(false)
  const [withdrawing, setWithdrawing]                   = useState(false)
  const [withdrawReason, setWithdrawReason]             = useState('')

  const [oppStatus, setOppStatus]                       = useState<string>(opp.status as string)
  const [statusSaving, setStatusSaving]                 = useState(false)
  const [projectCodeProceed, setProjectCodeProceed]     = useState<boolean>((opp as any).projectCodeProceed ?? false)
  const [projectCodeConfirm, setProjectCodeConfirm]     = useState(false)
  const [projectCodeSaving, setProjectCodeSaving]       = useState(false)

  async function updateStatus(newStatus: string) {
    setStatusSaving(true)
    try {
      const res = await fetch(`/api/opportunities/${opp.opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) { toast.error('Failed to update status'); return }
      setOppStatus(newStatus)
    } finally {
      setStatusSaving(false)
    }
  }

  async function confirmProjectCode() {
    setProjectCodeSaving(true)
    try {
      const res = await fetch(`/api/opportunities/${opp.opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectCodeProceed: true }),
      })
      if (!res.ok) { toast.error('Failed to save'); return }
      setProjectCodeProceed(true)
      setProjectCodeConfirm(false)
    } finally {
      setProjectCodeSaving(false)
    }
  }
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
        toast.error(j.error ?? 'Failed to post comment')
        return
      }
      const created = await res.json()
      setComments(prev => [...prev, created as CommentItem])
      setNewComment('')
    } catch {
      setCommentError('Network error')
      toast.error('Network error — failed to post comment')
    } finally {
      setCommentLoading(false)
    }
  }

  async function withdrawApproval(approvalId: string) {
    setWithdrawing(true)
    try {
      const res = await fetch(`/api/approvals/${approvalId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: withdrawReason.trim() || undefined }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j.error ?? 'Failed to withdraw approval')
        return
      }
      setApprovals(prev => prev.map(a => a.id === approvalId ? { ...a, status: 'WITHDRAWN' as ApprovalStatus } : a))
      setOppStage('PRICE_LINKED')
      setWithdrawConfirm(false)
      setWithdrawReason('')
    } catch {
      toast.error('Network error — failed to withdraw approval')
    } finally {
      setWithdrawing(false)
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
        body: JSON.stringify({ approverId, requestedById: opp.ownerId, businessJustification, ccIds }),
      })
      if (!res.ok) {
        const j = await res.json()
        setApprovalError(j.error ?? 'Failed to send approval request')
        toast.error(j.error ?? 'Failed to send approval request')
        return
      }
      const created = await res.json()
      setApprovals((prev: ApprovalItem[]) => [created as ApprovalItem, ...prev])
      setOppStage('APPROVAL_PENDING')
      setApproverId('')
      setCcIds([])
      setBusinessJustification('')
      setApprovalConfirm(false)
    } catch {
      setApprovalError('Network error')
      toast.error('Network error — failed to send approval request')
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
            {t === 'Pricing Approval' && approvals.length > 0 && (
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
                <Field label="Next Steps" value={STAGE_NEXT_STEPS[oppStage]} wide />
                {opp.notes     && <Field label="Notes"      value={opp.notes}     wide />}
              </dl>
            </div>

            {/* Team */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-slate-500">Team</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <Field label="Owner" value={opp.owner.name} />
              </dl>
            </div>

            {/* Client POCs */}
            {opp.client.pocs.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Client Contacts (POCs)</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {opp.client.pocs.map((poc: any) => (
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
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={oppStatus}
                  disabled={statusSaving}
                  onChange={e => updateStatus(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 cursor-pointer"
                >
                  <option value="OPEN">Open</option>
                  <option value="WON">Won</option>
                </select>
                <StageBadge  stage={oppStage}   />
                <LOBBadge    lob={opp.primaryLob} />
              </div>
              <p className="mt-2 text-[10px] text-slate-400">You can change the status at any time.</p>
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

      {/* ── Final-version change warning modal ──────────────── */}
      {finalWarningId && (() => {
        const targetV               = pricingVersions.find(v => v.id === finalWarningId)
        const isPricingPending      = oppStage === 'APPROVAL_PENDING'
        const isSowVerifyPending    = oppStage === 'SOW_REVIEW_PENDING'
        const isBlocked             = isPricingPending || isSowVerifyPending
        return (
          <>
            <div
              onClick={() => setFinalWarningId(null)}
              style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,31,68,0.45)', backdropFilter: 'blur(2px)' }}
            />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', zIndex: 201,
              transform: 'translate(-50%,-50%)',
              background: '#fff', borderRadius: 14, padding: '28px 28px 24px',
              boxShadow: '0 20px 60px rgba(10,31,68,0.18)',
              width: 420, maxWidth: 'calc(100vw - 32px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <div>
                  {isPricingPending && (
                    <>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#0A1F44', marginBottom: 6 }}>
                        Pricing approval in progress
                      </p>
                      <p style={{ fontSize: 13, color: '#3A4A6A', lineHeight: 1.6 }}>
                        The pricing approver has not decided yet. Wait for their response before changing the final version.
                      </p>
                    </>
                  )}
                  {isSowVerifyPending && (
                    <>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#0A1F44', marginBottom: 6 }}>
                        SOW verification in progress
                      </p>
                      <p style={{ fontSize: 13, color: '#3A4A6A', lineHeight: 1.6 }}>
                        A SOW / PO verification request is pending with the approver. The pricing version cannot be changed until they approve or reject it.
                      </p>
                    </>
                  )}
                  {!isBlocked && (
                    <>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#0A1F44', marginBottom: 6 }}>
                        This will reset the pricing approval
                      </p>
                      <p style={{ fontSize: 13, color: '#3A4A6A', lineHeight: 1.6 }}>
                        Marking <strong>V{targetV?.versionNumber}</strong> as final will invalidate the existing pricing approval.
                        The opportunity will go back to the pricing approval stage and a new approval request will be required.
                        Uploaded SOW / PO documents will be kept.
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setFinalWarningId(null)}
                  style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#F4F6FB', color: '#3A4A6A', border: '1px solid #D6DCE8', cursor: 'pointer' }}
                >
                  {isBlocked ? 'OK' : 'Cancel'}
                </button>
                {!isBlocked && (
                  <button
                    onClick={() => { setFinalWarningId(null); doMarkAsFinal(finalWarningId) }}
                    style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer' }}
                  >
                    Yes, change final version
                  </button>
                )}
              </div>
            </div>
          </>
        )
      })()}

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
                            <span className="text-sm font-semibold text-slate-800">V{v.versionNumber}</span>
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
                      <span className={`text-[10px] font-semibold flex items-center gap-1 ${pricingLocked ? 'text-slate-500' : 'text-emerald-600'}`}>
                        {pricingLocked ? (
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                            <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                          </svg>
                        )}
                        {oppStage === 'APPROVAL_PENDING' ? 'Pending Approval' : pricingLocked ? 'Locked · Approved' : 'Selected for approval'}
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

      {/* ── Tab: Pricing Approval ────────────────────────────── */}
      {tab === 'Pricing Approval' && (
        <div className="max-w-2xl space-y-5">

          {/* Confirm modal */}
          {approvalConfirm && (() => {
            const name     = users.find(u => u.id === approverId)?.name ?? 'the selected approver'
            const ccNames  = ccIds.map(id => users.find(u => u.id === id)?.name).filter(Boolean)
            const finalV   = pricingVersions.find(v => v.isFinal)
            return (
              <>
                <div
                  onClick={() => setApprovalConfirm(false)}
                  style={{
                    position: 'fixed', inset: 0, zIndex: 200,
                    background: 'rgba(10,31,68,0.45)', backdropFilter: 'blur(2px)',
                  }}
                />
                <div style={{
                  position: 'fixed', top: '50%', left: '50%', zIndex: 201,
                  transform: 'translate(-50%,-50%)',
                  background: '#fff', borderRadius: 14, padding: '28px 28px 24px',
                  boxShadow: '0 20px 60px rgba(10,31,68,0.18)',
                  width: 420, maxWidth: 'calc(100vw - 32px)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#EA8C00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
                      </svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#0A1F44', marginBottom: 6 }}>
                        Send pricing approval request?
                      </p>
                      <p style={{ fontSize: 13, color: '#3A4A6A', lineHeight: 1.6 }}>
                        This will send a mail to <strong style={{ color: '#0A1F44' }}>{name}</strong>.
                        If the request is rejected, <strong style={{ color: '#0A1F44' }}>you will have to redo the pricing</strong>.
                      </p>
                      {finalV && (
                        <p style={{ marginTop: 10, fontSize: 12, color: '#1E5BB8', background: '#EFF4FF', border: '1px solid #C7D7F8', borderRadius: 7, padding: '6px 10px', display: 'inline-block' }}>
                          <strong>V{finalV.versionNumber}</strong> is marked as final and will be sent for review.
                        </p>
                      )}
                      {!finalV && (
                        <p style={{ marginTop: 10, fontSize: 12, color: '#C6432F', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 7, padding: '6px 10px', display: 'inline-block' }}>
                          No version is marked as final. The approver will see no pricing data.
                        </p>
                      )}
                      {ccNames.length > 0 && (
                        <p style={{ marginTop: 8, fontSize: 12, color: '#3A4A6A' }}>
                          CC: <strong style={{ color: '#0A1F44' }}>{ccNames.join(', ')}</strong>
                        </p>
                      )}
                      {businessJustification && (
                        <div style={{ marginTop: 10, fontSize: 12, color: '#3A4A6A', background: '#F4F6FB', border: '1px solid #D6DCE8', borderRadius: 7, padding: '8px 10px' }}>
                          <span style={{ display: 'block', fontSize: 10, color: '#9AA3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Business Justification</span>
                          {businessJustification}
                        </div>
                      )}
                    </div>
                  </div>
                  {approvalError && (
                    <p style={{ fontSize: 12, color: '#C6432F', marginBottom: 12 }}>{approvalError}</p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      onClick={() => { setApprovalConfirm(false); setApprovalError(null) }}
                      disabled={approvalLoading}
                      style={{
                        padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        background: '#F4F6FB', color: '#3A4A6A',
                        border: '1px solid #D6DCE8', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitApproval}
                      disabled={approvalLoading}
                      style={{
                        padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        background: approvalLoading ? '#E2E6EE' : '#4F46E5',
                        color: approvalLoading ? '#9AA3B8' : '#fff',
                        border: 'none', cursor: approvalLoading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {approvalLoading ? 'Sending…' : 'Yes, send'}
                    </button>
                  </div>
                </div>
              </>
            )
          })()}

          {/* ── Approval request panel (stage-aware) ── */}
          {(() => {
            const stage           = oppStage
            const pendingPricing  = approvals.find((ar: any) => ar.approvalType === 'PRICING' && ar.status === 'PENDING')
            const approvedPricing = approvals.find((ar: any) => ar.approvalType === 'PRICING' && ar.status === 'APPROVED')
            const wasRejected     = stage === 'PRICE_LINKED' && approvals.some((ar: any) => ar.approvalType === 'PRICING' && ar.status === 'REJECTED')
            const isInvalidated   = !!approvedPricing && stage === 'PRICE_LINKED'
            const isReapproval    = wasRejected || isInvalidated

            // ── In-flight approval ────────────────────────────────
            if (stage === 'APPROVAL_PENDING') return (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800 mb-1">Approval Pending</p>
                  <p className="text-sm text-amber-700">
                    Awaiting decision from <strong>{(pendingPricing as any)?.approver?.name ?? 'the approver'}</strong>.
                    They have received an email with Approve / Reject buttons.
                  </p>
                  {sessionUserId === opp.ownerId && pendingPricing && (
                    <div className="mt-4">
                      {withdrawConfirm ? (
                        <div className="flex flex-col gap-2">
                          <span className="text-xs text-amber-800 font-semibold">Withdraw this request?</span>
                          <textarea
                            value={withdrawReason}
                            onChange={e => setWithdrawReason(e.target.value)}
                            placeholder="Reason for withdrawal (optional)"
                            rows={2}
                            className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => withdrawApproval((pendingPricing as any).id)}
                              disabled={withdrawing}
                              className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              {withdrawing ? 'Withdrawing…' : 'Yes, withdraw'}
                            </button>
                            <button
                              onClick={() => { setWithdrawConfirm(false); setWithdrawReason('') }}
                              disabled={withdrawing}
                              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setWithdrawConfirm(true)}
                          className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
                        >
                          Withdraw Approval
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )

            // ── Pricing approved — show next steps ────────────────
            if (stage === 'SOW_PENDING') {
              const approvedBy = (approvedPricing as any)?.approver?.name
              const decidedAt  = (approvedPricing as any)?.decidedAt
              const approvedAt = decidedAt
                ? new Date(decidedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : null
              return (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-emerald-800">Pricing Approved</p>
                  </div>
                  <p className="text-sm text-emerald-700 mb-4">
                    Approved by <strong>{approvedBy ?? 'the approver'}</strong>{approvedAt ? ` on ${approvedAt}` : ''}.
                  </p>
                  <div className="rounded-xl bg-white border border-emerald-200 p-4 mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Next Step</p>
                    <p className="text-sm text-slate-700">
                      Go to the <strong>SOW / PO</strong> tab to upload the signed Statement of Work and Purchase Order, then submit for verification.
                    </p>
                  </div>
                  <p className="text-xs text-slate-400">
                    If the pricing needs to change, mark a different version as final in the Pricing tab. This will invalidate this approval and require a new submission.
                  </p>
                </div>
              )
            }

            // ── Past pricing stage entirely ───────────────────────
            if (['SOW_SUBMITTED', 'SOW_REVIEW_PENDING', 'TO_BE_ARCHIVED'].includes(stage)) return (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center">
                <p className="text-sm text-slate-400">Pricing is approved and the engagement is progressing. No further pricing action is needed here.</p>
              </div>
            )

            // ── LEAD / PRICE_LINKING_PENDING — show request form ──
            return (
              <>
                {wasRejected && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm text-red-800">
                      <strong>Approval was rejected.</strong> Review the rejection reason in the history below, revise the pricing if needed, then resubmit.
                    </p>
                  </div>
                )}
                {isInvalidated && !wasRejected && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm text-amber-800">
                      <strong>Previous approval invalidated.</strong> A different pricing version was marked as final after{' '}
                      <strong>{(approvedPricing as any)?.approver?.name}</strong> approved. Submit a new request below for the updated pricing.
                    </p>
                  </div>
                )}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
                    {isReapproval ? 'Re-request Approval' : 'Request Approval'}
                  </h2>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-500">Approver</label>
                      <SearchableSelect
                        options={users.map(u => ({ value: u.id, label: u.name, sub: u.role }))}
                        value={approverId}
                        onChange={setApproverId}
                        placeholder="Search approver by name…"
                        emptyMessage="No matching users found."
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                        CC <span className="font-normal text-slate-400">(optional — they receive a notification only)</span>
                      </label>
                      <MultiSelect
                        options={users
                          .filter(u => u.id !== approverId)
                          .map(u => ({ value: u.id, label: u.name, sub: u.role }))}
                        values={ccIds}
                        onChange={setCcIds}
                        placeholder="Search people to CC…"
                        emptyMessage="No matching users found."
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                        Business Justification <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={businessJustification}
                        onChange={e => setBusinessJustification(e.target.value)}
                        placeholder="Explain why this pricing should be approved…"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => setApprovalConfirm(true)}
                        disabled={!approverId || !businessJustification.trim() || approvalLoading}
                        className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {isReapproval ? 'Send Re-approval Request' : 'Send Request'}
                      </button>
                    </div>
                  </div>
                  {approvalError && (
                    <p className="mt-2 text-xs text-red-600">{approvalError}</p>
                  )}
                </div>
              </>
            )
          })()}

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
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-slate-700">
                            Requested by <span className="font-semibold">{ar.requestedBy.name}</span>
                          </p>
                          {ar.pricingVersionNumber != null && (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 ring-1 ring-indigo-200">
                              V{ar.pricingVersionNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700">
                          Approver: <span className="font-semibold">{ar.approver.name}</span>
                          <span className="ml-1 text-xs text-slate-400">({ar.approver.role})</span>
                        </p>
                        <p className="text-xs text-slate-400">{fmtDate(ar.requestedAt)}</p>
                        {ar.businessJustification && (
                          <p className="text-xs text-slate-500 mt-1">
                            <span className="font-semibold not-italic">BJ: </span>
                            <span className="italic">{ar.businessJustification}</span>
                          </p>
                        )}
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

      {/* ── Tab: SoW ─────────────────────────────────────────── */}
      {tab === 'SOW / PO' && (
        <TabSoW
          opportunityId={opp.opportunityId}
          initialPreContractAgreed={(opp as any).preContractAgreed ?? false}
          existingVerification={
            (opp.approvalRequests as any[]).find(
              (a: any) => a.approvalType === 'SOW_VERIFICATION'
            ) ?? null
          }
        />
      )}

      {/* ── Tab: Project Code ────────────────────────────────── */}
      {tab === 'Project Code' && (
        <div className="max-w-xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Project Code Creation</h3>
            <p className="text-xs text-slate-500 mb-6">
              Confirm that you want to proceed with project code creation. Once confirmed, the finance team will generate a project code.
              You must then upload a SoW, PO, or pre-contract agreement to formalise the legal contract and allocate company resources.
            </p>

            {projectCodeProceed ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-emerald-600 shrink-0">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Confirmed — proceed with project code</p>
                  <p className="text-xs text-emerald-600 mt-0.5">This cannot be undone. Finance has been notified.</p>
                </div>
              </div>
            ) : projectCodeConfirm ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-600 shrink-0 mt-0.5">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-bold text-red-700">This action is permanent and cannot be undone.</p>
                    <p className="text-xs text-red-600 mt-1">
                      Once confirmed, the finance team will create a project code. You will be required to upload a SoW or PO
                      to establish a legal contract before company resources can be allocated to this project.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={confirmProjectCode}
                    disabled={projectCodeSaving}
                    className="rounded-lg px-4 py-1.5 text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {projectCodeSaving ? 'Confirming…' : 'Yes, proceed with project code'}
                  </button>
                  <button
                    onClick={() => setProjectCodeConfirm(false)}
                    disabled={projectCodeSaving}
                    className="rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setProjectCodeConfirm(true)}
                className="flex items-center gap-3 w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-left hover:border-indigo-400 hover:bg-indigo-50 transition-colors group"
              >
                <span className="w-5 h-5 rounded border-2 border-slate-300 group-hover:border-indigo-500 flex items-center justify-center shrink-0 transition-colors" />
                <span className="text-sm text-slate-500 group-hover:text-indigo-700 font-medium transition-colors">
                  Proceed with project code creation
                </span>
              </button>
            )}
          </div>
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
          currentStage={oppStage}
          onClose={closeDrawer}
        />
      )}
    </>
  )
}
