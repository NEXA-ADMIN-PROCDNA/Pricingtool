'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { ApprovalStatus } from '@prisma/client'
import type { OpportunityDetail } from '@/lib/db/opportunities'
import { STAGE_NEXT_STEPS } from '@/lib/stageNextSteps'
import { StageBadge } from '@/components/ui/StageBadge'
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
  PENDING:   'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  APPROVED:  'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  REJECTED:  'bg-red-50 text-red-700 ring-1 ring-red-200',
  WITHDRAWN: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
}

// Full LoB names for the Details tab (other tabs keep the short codes).
const LOB_LABELS: Record<string, string> = {
  TECH:      'Technology',
  ANALYTICS: 'Analytics',
  MS:        'Managed Services',
  DS:        'Data Science',
  DESIGN:    'Design',
  AUXO:      'Auxo',
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
  // Live primary LoB — opp.primaryLob is the page-load value and goes stale
  // the moment a pricing version is (re-)marked as final and the route
  // recomputes the majority-LoB on the server.
  const [primaryLob, setPrimaryLob]           = useState<string | null>(opp.primaryLob ?? null)
  const [creatingVersion, setCreatingVersion] = useState(false)
  const [markingFinal, setMarkingFinal]       = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  async function closeDrawer() {
    if (drawerVersion) {
      const res = await fetch(`/api/pricing-versions/${drawerVersion.id}`)
      if (res.ok) {
        const updated = await res.json() as PricingVersion & { opportunity?: { primaryLob?: string | null } }
        // Pick up the server's recomputed primaryLob (only set when the
        // pricing was marked final; otherwise stays as it was).
        if (updated.opportunity?.primaryLob !== undefined) {
          setPrimaryLob(updated.opportunity.primaryLob ?? null)
        }
        // If the edited version came back as final, mirror the server's
        // sibling-unset locally — otherwise the previously-final version
        // would keep its stale isFinal:true in component state.
        setPricingVersions(prev => prev.map(v =>
          v.id === updated.id
            ? updated
            : updated.isFinal
              ? { ...v, isFinal: false }
              : v
        ))
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
    setMarkingFinal(true)
    try {
      const res = await fetch(`/api/pricing-versions/${versionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFinal: true }),
      })
      if (!res.ok) { toast.error('Failed to mark version as final'); return }
      // The route returns the recomputed opportunity.primaryLob in
      // opportunityPrimaryLob — apply it so the Details tab updates.
      const body = await res.json() as { opportunityPrimaryLob?: string | null }
      if (body.opportunityPrimaryLob !== undefined) {
        setPrimaryLob(body.opportunityPrimaryLob ?? null)
      }
      setPricingVersions(prev => prev.map(v => ({ ...v, isFinal: v.id === versionId })))
      if (['LEAD', 'PRICE_LINKING_PENDING', 'SOW_PENDING', 'SOW_SUBMITTED'].includes(oppStage)) {
        setOppStage('PRICE_LINKED')
      }
    } finally {
      setMarkingFinal(false)
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

  // SoW/PO unlocks once a pricing approval request has been submitted (stage
  // APPROVAL_PENDING onward) and stays accessible afterwards — even if that
  // request is later rejected/withdrawn (stage reverts to PRICE_LINKED) — as
  // long as a pricing approval request was ever submitted.
  const SOW_UNLOCKED_STAGES = new Set(['APPROVAL_PENDING', 'SOW_PENDING', 'SOW_SUBMITTED', 'SOW_REVIEW_PENDING', 'TO_BE_ARCHIVED'])
  const tabDimmed = (t: Tab) => {
    if (t === 'SOW / PO') {
      const pricingRequested = approvals.some((ar: any) => ar.approvalType === 'PRICING')
      return !(pricingRequested || SOW_UNLOCKED_STAGES.has(oppStage))
    }
    if (t === 'Project Code')   return oppStage !== 'TO_BE_ARCHIVED'
    return false
  }
  const tabTooltip = (t: Tab) => {
    if (t === 'SOW / PO')     return 'Available once a pricing approval request is submitted'
    if (t === 'Project Code') return 'Available after SOW Verification'
    return undefined
  }

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
      {/* ── Mark-as-Final in-flight overlay ── */}
      {markingFinal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(10,31,68,0.55)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', padding: '24px 32px',
            border: '1px solid #D6DCE8', borderRadius: 4,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            minWidth: 240,
          }}>
            <svg className="animate-spin" viewBox="0 0 24 24" width={26} height={26} style={{ color: '#005CD9' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} fill="none" strokeDasharray="40 100" strokeLinecap="round" />
            </svg>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 5, height: 5, background: '#005CD9', display: 'inline-block', transform: 'rotate(45deg)' }} />
              <span style={{
                fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
                fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase',
                color: '#001E96', fontWeight: 600,
              }}>Marking as Final</span>
            </div>
            <p style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 12, color: '#7B7C7F', textAlign: 'center',
              lineHeight: 1.5, margin: 0, maxWidth: 260,
            }}>
              It may take a couple of seconds depending upon the size of the opportunity / time window.
            </p>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 mb-6 gap-1">
        {TABS.map(t => {
          const dimmed = tabDimmed(t)
          return (
          <button
            key={t}
            type="button"
            disabled={dimmed}
            aria-disabled={dimmed}
            onClick={() => { if (!dimmed) setTab(t) }}
            title={dimmed ? tabTooltip(t) : undefined}
            className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 -mb-px ${
              tab === t && !dimmed
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            } ${dimmed ? 'opacity-40 cursor-not-allowed pointer-events-auto' : ''}`}
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
          );
        })}
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
                <Field label="Business Unit" value={opp.businessUnit ?? opp.client.businessUnit} />
                <Field label="Owner"        value={opp.owner.name} />
                <Field label="LOB"          value={primaryLob ? (LOB_LABELS[primaryLob] ?? primaryLob) : null} />
                <Field label="Star Connect" value={opp.starConnect ? 'Yes' : 'No'} />
                <Field label="Start Date"   value={fmtDate(opp.startDate)} />
                <Field label="End Date"     value={fmtDate(opp.endDate)} />
                <Field label="Next Steps" value={STAGE_NEXT_STEPS[oppStage]} wide />
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
                  <option value="LOST">Lost</option>
                  <option value="ABANDONED">Abandoned</option>
                </select>
                <StageBadge  stage={oppStage}   />
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
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#001E96', marginBottom: 6 }}>
                        Pricing approval in progress
                      </p>
                      <p style={{ fontSize: 13, color: '#3A4A6A', lineHeight: 1.6 }}>
                        The pricing approver has not decided yet. Wait for their response before changing the final version.
                      </p>
                    </>
                  )}
                  {isSowVerifyPending && (
                    <>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#001E96', marginBottom: 6 }}>
                        SOW verification in progress
                      </p>
                      <p style={{ fontSize: 13, color: '#3A4A6A', lineHeight: 1.6 }}>
                        A SOW / PO verification request is pending with the approver. The pricing version cannot be changed until they approve or reject it.
                      </p>
                    </>
                  )}
                  {!isBlocked && (
                    <>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#001E96', marginBottom: 6 }}>
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
                  <div style={{ marginBottom: 18 }}>
                    {/* Editorial eyebrow */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
                      fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
                      color: '#7B7C7F', fontWeight: 500, marginBottom: 14,
                    }}>
                      NEXA · Confirmation
                    </div>

                    <h3 style={{
                      fontSize: 18, fontWeight: 600, color: '#001E96',
                      margin: '0 0 10px', letterSpacing: '-0.01em', lineHeight: 1.25,
                    }}>
                      Submit pricing approval request
                    </h3>

                    <p style={{ fontSize: 13, color: '#3A4A6A', lineHeight: 1.6, margin: 0 }}>
                      An approval request for <strong style={{ color: '#001E96' }}>{opp.opportunityName}</strong>
                      {' '}
                      (<span style={{ fontFamily: "var(--font-plex-mono), 'Courier New', monospace", color: '#7B7C7F', fontSize: 12 }}>{opp.opportunityId}</span>)
                      {' '}will be issued to <strong style={{ color: '#001E96' }}>{name}</strong> for review.
                    </p>

                    <p style={{ fontSize: 12.5, color: '#7B7C7F', lineHeight: 1.55, margin: '8px 0 0' }}>
                      On approval, the opportunity advances to SOW preparation. If declined, the request will be returned
                      for revision and resubmission.
                    </p>

                    {finalV && (
                      <div style={{
                        marginTop: 14, padding: '8px 12px',
                        background: '#F4F6FB', border: '1px solid #D6DCE8', borderRadius: 4,
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: 12, color: '#3A4A6A',
                      }}>
                        <span style={{
                          fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
                          fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
                          color: '#005CD9', fontWeight: 600,
                        }}>For Review</span>
                        <span style={{ color: '#D6DCE8' }}>·</span>
                        <span>Pricing <strong style={{ color: '#001E96' }}>V{finalV.versionNumber}</strong> (marked Final)</span>
                      </div>
                    )}
                    {!finalV && (
                      <div style={{
                        marginTop: 14, padding: '8px 12px',
                        background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 4,
                        fontSize: 12, color: '#8A2A1F',
                      }}>
                        <span style={{
                          fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
                          fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
                          fontWeight: 600,
                        }}>Warning</span>
                        {' · '}No version is marked as Final. The reviewer will receive no pricing context.
                      </div>
                    )}

                    {ccNames.length > 0 && (
                      <div style={{
                        marginTop: 10,
                        fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
                        fontSize: 11, color: '#7B7C7F', letterSpacing: '0.04em',
                      }}>
                        <span style={{ textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: 10 }}>CC</span>
                        {' · '}
                        <span style={{ color: '#001E96' }}>{ccNames.join(', ')}</span>
                      </div>
                    )}

                    {businessJustification && (
                      <div style={{
                        marginTop: 12, padding: '10px 12px',
                        background: '#F4F6FB', border: '1px solid #D6DCE8', borderRadius: 4,
                        fontSize: 12.5, color: '#3A4A6A', lineHeight: 1.55,
                      }}>
                        <div style={{
                          fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
                          fontSize: 10, color: '#7B7C7F', textTransform: 'uppercase',
                          letterSpacing: '0.14em', fontWeight: 500, marginBottom: 6,
                        }}>Business Justification</div>
                        {businessJustification}
                      </div>
                    )}
                  </div>
                  {approvalError && (
                    <p style={{ fontSize: 12, color: '#D6454A', marginBottom: 12 }}>{approvalError}</p>
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
                        color: approvalLoading ? '#A5A7AA' : '#fff',
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
              <div className="rounded-lg border border-slate-200 border-l-[3px] border-l-blue-700 bg-white p-5 shadow-sm flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800 mb-1">Approval Pending</p>
                  <p className="text-sm text-slate-500">
                    Awaiting decision from <strong className="text-slate-700">{(pendingPricing as any)?.approver?.name ?? 'the approver'}</strong>.
                    They have received an email with Approve / Reject buttons.
                  </p>
                  {sessionUserId === opp.ownerId && pendingPricing && (
                    <div className="mt-4">
                      {withdrawConfirm ? (
                        <div className="flex flex-col gap-2">
                          <span className="text-xs text-slate-700 font-semibold">Withdraw this request?</span>
                          <textarea
                            value={withdrawReason}
                            onChange={e => setWithdrawReason(e.target.value)}
                            placeholder="Reason for withdrawal (optional)"
                            rows={2}
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => withdrawApproval((pendingPricing as any).id)}
                              disabled={withdrawing}
                              className="rounded-md px-3 py-1.5 text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              {withdrawing ? 'Withdrawing…' : 'Yes, withdraw'}
                            </button>
                            <button
                              onClick={() => { setWithdrawConfirm(false); setWithdrawReason('') }}
                              disabled={withdrawing}
                              className="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setWithdrawConfirm(true)}
                          className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
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
                <div className="rounded-lg border border-slate-200 border-l-[3px] border-l-emerald-600 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-2.5">
                    <div className="w-8 h-8 rounded-md bg-emerald-50 flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">Pricing Approved</p>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">
                    Approved by <strong className="text-slate-700">{approvedBy ?? 'the approver'}</strong>{approvedAt ? ` on ${approvedAt}` : ''}.
                  </p>
                  <div className="rounded-md bg-slate-50 border border-slate-200 p-4 mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Next Step</p>
                    <p className="text-sm text-slate-600">
                      Go to the <strong className="text-slate-800">SOW / PO</strong> tab to upload the signed Statement of Work and Purchase Order, then submit for verification.
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
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center">
                <p className="text-sm text-slate-500">Pricing is approved and the engagement is progressing. No further pricing action is needed here.</p>
              </div>
            )

            // ── LEAD / PRICE_LINKING_PENDING — show request form ──
            return (
              <>
                {wasRejected && (
                  <div className="rounded-lg border border-slate-200 border-l-[3px] border-l-red-500 bg-red-50/60 p-4">
                    <p className="text-sm text-slate-700">
                      <strong className="text-red-700">Approval was rejected.</strong> Review the rejection reason in the history below, revise the pricing if needed, then resubmit.
                    </p>
                  </div>
                )}
                {isInvalidated && !wasRejected && (
                  <div className="rounded-lg border border-slate-200 border-l-[3px] border-l-slate-400 bg-slate-50 p-4">
                    <p className="text-sm text-slate-700">
                      <strong className="text-slate-800">Previous approval invalidated.</strong> A different pricing version was marked as final after{' '}
                      <strong className="text-slate-800">{(approvedPricing as any)?.approver?.name}</strong> approved. Submit a new request below for the updated pricing.
                    </p>
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
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
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => setApprovalConfirm(true)}
                        disabled={!approverId || !businessJustification.trim() || approvalLoading}
                        className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
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
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Approval History ({approvals.length})
              </h2>
              <div className="space-y-3">
                {approvals.map((ar: any) => (
                  <div key={ar.id} className="rounded-md border border-slate-200 p-4">
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
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-slate-500 text-sm">No approval requests yet.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: SoW ─────────────────────────────────────────── */}
      {tab === 'SOW / PO' && (
        <TabSoW
          opportunityId={opp.opportunityId}
          opportunityName={opp.opportunityName}
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
              <div style={{
                padding: '18px 18px 16px',
                border: '1px solid #D6DCE8',
                borderLeft: '3px solid #D6454A',
                background: '#fff',
                borderRadius: 4,
              }}>
                {/* Editorial eyebrow */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
                  fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: '#7B7C7F', fontWeight: 500, marginBottom: 12,
                }}>
                  <span style={{ width: 5, height: 5, background: '#D6454A', display: 'inline-block', transform: 'rotate(45deg)' }} />
                  NEXA · Confirmation · Irreversible
                </div>

                <h4 style={{
                  fontSize: 16, fontWeight: 600, color: '#001E96',
                  margin: '0 0 8px', letterSpacing: '-0.01em', lineHeight: 1.25,
                }}>
                  Confirm project code generation
                </h4>

                <p style={{ fontSize: 13, color: '#3A4A6A', lineHeight: 1.6, margin: 0 }}>
                  Confirming will instruct the Finance team to generate a project code for
                  {' '}<strong style={{ color: '#001E96' }}>{opp.opportunityName}</strong>
                  {' '}(<span style={{ fontFamily: "var(--font-plex-mono), 'Courier New', monospace", color: '#7B7C7F', fontSize: 12 }}>{opp.opportunityId}</span>).
                </p>

                <p style={{ fontSize: 12.5, color: '#7B7C7F', lineHeight: 1.55, margin: '8px 0 14px' }}>
                  A signed Statement of Work, Purchase Order or pre-contract agreement must subsequently be
                  uploaded to formalise the engagement before resources can be allocated. This action cannot be reversed.
                </p>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={confirmProjectCode}
                    disabled={projectCodeSaving}
                    style={{
                      fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
                      fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
                      padding: '8px 16px', borderRadius: 4,
                      background: projectCodeSaving ? '#E2E6EE' : '#D6454A',
                      color: projectCodeSaving ? '#A5A7AA' : '#fff',
                      border: 'none', fontWeight: 600,
                      cursor: projectCodeSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {projectCodeSaving ? 'Confirming…' : 'Authorise Project Code'}
                  </button>
                  <button
                    onClick={() => setProjectCodeConfirm(false)}
                    disabled={projectCodeSaving}
                    style={{
                      fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
                      fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
                      padding: '8px 16px', borderRadius: 4,
                      background: '#fff', color: '#7B7C7F',
                      border: '1px solid #D6DCE8', fontWeight: 600,
                      cursor: projectCodeSaving ? 'not-allowed' : 'pointer',
                    }}
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
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">

            {/* Thread */}
            {comments.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-slate-500">No comments yet. Be the first to add one.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 px-6 pt-6 pb-2 space-y-4">
                {comments.map((c: any) => (
                  <div key={c.id} className="flex gap-3 pb-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: '#001E96' }}>
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
                      <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 whitespace-pre-wrap">
                        {c.content}
                      </p>
                      {c.replies?.map((r: any) => (
                        <div key={r.id} className="mt-2 ml-4 flex gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9px] font-semibold text-slate-600">
                            {r.author.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <p className="text-[10px] font-semibold text-slate-500">{r.author.name}</p>
                              <span className="text-[9px] text-slate-400">
                                {new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5">{r.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Compose box */}
            <div className="border-t border-slate-200 bg-slate-50/60 px-6 py-4">
              <textarea
                rows={3}
                placeholder="Add a comment…"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment()
                }}
                className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-slate-400">⌘ Enter to post</span>
                <button
                  onClick={submitComment}
                  disabled={!newComment.trim() || commentLoading}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                >
                  {commentLoading ? 'Posting…' : 'Post Comment'}
                </button>
              </div>
              {commentError && (
                <p className="mt-1.5 text-xs text-red-500">{commentError}</p>
              )}
            </div>
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
