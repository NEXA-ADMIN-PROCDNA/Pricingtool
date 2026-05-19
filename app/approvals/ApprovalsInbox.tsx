'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

type PricingSnap = {
  versionNumber: number
  proposedBillings: number | null
  grossMarginPct: number | null
  totalHours: number | null
  discountPremiumPct: number | null
  businessJustification: string | null
}

type DocSnap = {
  id: string
  fileName: string
  fileSizeBytes: number | null
  mimeType: string | null
  version: number
  uploadedAt: string
  signedUrl: string | null
}

type ApprovalItem = {
  id: string
  approvalType: 'PRICING' | 'SOW_VERIFICATION'
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  requestedAt: string
  decidedAt: string | null
  rejectionReason: string | null
  pricingVersionNumber: number | null
  requestedBy: { name: string; role: string }
  opportunity: {
    opportunityId: string
    opportunityName: string
    startDate: string
    endDate: string
    preContractAgreed: boolean
    client: { name: string }
    pricingVersions: PricingSnap[]
    sowDocuments: DocSnap[]
    poDocuments: DocSnap[]
  }
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtSize(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000)     return `${(bytes / 1_000).toFixed(0)} KB`
  return `${bytes} B`
}

function StatusPill({ status }: { status: ApprovalItem['status'] }) {
  const cls = {
    PENDING:  'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    APPROVED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    REJECTED: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  }[status]
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{status}</span>
}

function TypeBadge({ type }: { type: ApprovalItem['approvalType'] }) {
  if (type === 'SOW_VERIFICATION') {
    return (
      <span className="rounded-full px-2.5 py-1 text-[10px] font-bold bg-violet-50 text-violet-700 ring-1 ring-violet-200">
        SOW Verification
      </span>
    )
  }
  return (
    <span className="rounded-full px-2.5 py-1 text-[10px] font-bold bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200">
      Pricing
    </span>
  )
}

function DocRow({ doc }: { doc: DocSnap }) {
  const isPdf  = doc.mimeType === 'application/pdf'
  const isWord = doc.mimeType?.includes('word') || doc.mimeType?.includes('document')
  const color  = isPdf ? '#E53935' : isWord ? '#1565C0' : '#546E7A'
  const label  = isPdf ? 'PDF' : isWord ? 'DOC' : 'FILE'

  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
      <div style={{
        width: 30, height: 36, borderRadius: 3, background: color, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: '#fff', fontSize: 8, fontWeight: 700 }}>{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-800 truncate">{doc.fileName}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          v{doc.version} · {fmtSize(doc.fileSizeBytes)} · {fmtDate(doc.uploadedAt)}
        </p>
      </div>
      {doc.signedUrl && (
        <a
          href={doc.signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 px-2.5 py-1 border border-blue-100 rounded bg-blue-50 hover:bg-blue-100 transition-colors whitespace-nowrap"
        >
          Download
        </a>
      )}
    </div>
  )
}

function SowVerificationPanel({ opp }: { opp: ApprovalItem['opportunity'] }) {
  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/30 px-4 py-3 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-500">
        Verification Evidence
      </p>

      {/* Pre-contract */}
      <div className="flex items-center gap-2">
        <div style={{
          width: 16, height: 16, borderRadius: 3, flexShrink: 0,
          background: opp.preContractAgreed ? '#2563EB' : '#E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {opp.preContractAgreed && (
            <svg viewBox="0 0 12 10" fill="none" style={{ width: 9, height: 7 }}>
              <path d="M1 5l3.5 3.5L11 1" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span className="text-xs text-slate-700">
          Pre-contract agreement:{' '}
          <span className={`font-semibold ${opp.preContractAgreed ? 'text-emerald-700' : 'text-slate-400'}`}>
            {opp.preContractAgreed ? 'Agreed' : 'Not agreed'}
          </span>
        </span>
      </div>

      {/* SoW documents */}
      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Statement of Work {opp.sowDocuments.length > 0 ? `(${opp.sowDocuments.length})` : '— none uploaded'}
        </p>
        {opp.sowDocuments.map(doc => <DocRow key={doc.id} doc={doc} />)}
      </div>

      {/* PO documents */}
      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Purchase Order {opp.poDocuments.length > 0 ? `(${opp.poDocuments.length})` : '— none uploaded'}
        </p>
        {opp.poDocuments.map(doc => <DocRow key={doc.id} doc={doc} />)}
      </div>
    </div>
  )
}

function ApprovalCard({
  item, onApprove, onReject,
}: {
  item: ApprovalItem
  onApprove: (id: string) => Promise<void>
  onReject: (id: string, reason: string) => Promise<void>
}) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason]       = useState('')
  const [loading, setLoading]     = useState(false)
  const pv = item.opportunity.pricingVersions[0] ?? null
  const isPending = item.status === 'PENDING'
  const isSow = item.approvalType === 'SOW_VERIFICATION'

  async function handleApprove() {
    setLoading(true)
    await onApprove(item.id)
    setLoading(false)
  }

  async function handleReject() {
    setLoading(true)
    await onReject(item.id, reason)
    setLoading(false)
    setRejecting(false)
    setReason('')
  }

  return (
    <div className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${
      isPending ? 'border-amber-200 ring-1 ring-amber-100' : 'border-slate-200'
    }`}>
      {/* Header */}
      <div className={`px-5 py-3 flex items-center justify-between gap-3 ${isPending ? 'bg-amber-50' : 'bg-slate-50'}`}>
        <div className="flex items-center gap-2 min-w-0">
          {isPending && <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />}
          <Link
            href={`/opportunities/${item.opportunity.opportunityId}`}
            className="text-sm font-bold text-slate-800 hover:text-indigo-600 transition-colors truncate"
          >
            {item.opportunity.opportunityId} · {item.opportunity.opportunityName}
          </Link>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <TypeBadge type={item.approvalType} />
          <StatusPill status={item.status} />
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {/* Meta */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
          <span><span className="text-slate-400">Client:</span> <span className="font-semibold text-slate-700">{item.opportunity.client.name}</span></span>
          <span><span className="text-slate-400">Period:</span> <span className="font-semibold text-slate-700">{fmtDate(item.opportunity.startDate)} – {fmtDate(item.opportunity.endDate)}</span></span>
          <span>
            <span className="text-slate-400">Requested by:</span> <span className="font-semibold text-slate-700">{item.requestedBy.name}</span> <span className="text-slate-400">({item.requestedBy.role})</span>
            {item.pricingVersionNumber != null && (
              <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 ring-1 ring-indigo-200">V{item.pricingVersionNumber}</span>
            )}
          </span>
          <span><span className="text-slate-400">On:</span> <span className="font-semibold text-slate-700">{fmtDate(item.requestedAt)}</span></span>
          {item.decidedAt && (
            <span><span className="text-slate-400">Decided:</span> <span className="font-semibold text-slate-700">{fmtDate(item.decidedAt)}</span></span>
          )}
        </div>

        {/* SOW Verification panel */}
        {isSow && <SowVerificationPanel opp={item.opportunity} />}

        {/* Pricing panel (only for PRICING type) */}
        {!isSow && pv && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-500 mb-2">
              Final Pricing · v{pv.versionNumber}
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4 text-xs">
              {[
                ['Proposed Billings', fmt(pv.proposedBillings != null ? Number(pv.proposedBillings) : null)],
                ['Gross Margin',      pv.grossMarginPct   != null ? `${Number(pv.grossMarginPct).toFixed(1)}%`   : '—'],
                ['Total Hours',       pv.totalHours       != null ? `${Number(pv.totalHours).toLocaleString()} h` : '—'],
                ['D/P',               pv.discountPremiumPct != null ? `${Number(pv.discountPremiumPct) >= 0 ? '+' : ''}${Number(pv.discountPremiumPct).toFixed(1)}%` : '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-slate-400">{label}</p>
                  <p className="font-semibold text-slate-800">{value}</p>
                </div>
              ))}
            </div>
            {pv.businessJustification && (
              <div className="mt-3 border-t border-indigo-100 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-500 mb-1">Business Justification</p>
                <p className="text-xs text-slate-700 leading-relaxed">{pv.businessJustification}</p>
              </div>
            )}
          </div>
        )}

        {!isSow && !pv && (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-400 italic">
            No final pricing version set on this opportunity.
          </div>
        )}

        {/* Rejection reason */}
        {item.status === 'REJECTED' && item.rejectionReason && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
            <span className="font-semibold">Rejection reason: </span>{item.rejectionReason}
          </div>
        )}

        {/* Actions */}
        {isPending && (
          <div className="pt-1">
            {rejecting ? (
              <div className="space-y-2">
                <textarea
                  rows={2}
                  placeholder="Reason for rejection (optional)…"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full rounded-xl border border-red-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100 resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={handleReject} disabled={loading}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                    {loading ? 'Rejecting…' : 'Confirm Reject'}
                  </button>
                  <button onClick={() => { setRejecting(false); setReason('') }} disabled={loading}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <button onClick={handleApprove} disabled={loading}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {loading ? 'Approving…' : isSow ? 'Verify & Mark Won' : 'Approve'}
                </button>
                <button onClick={() => setRejecting(true)} disabled={loading}
                  className="flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject
                </button>
                <Link
                  href={`/opportunities/${item.opportunity.opportunityId}`}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors ml-auto"
                >
                  View Opportunity →
                </Link>
              </div>
            )}
          </div>
        )}

        {!isPending && (
          <div className="flex justify-end">
            <Link href={`/opportunities/${item.opportunity.opportunityId}`}
              className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition-colors">
              View Opportunity →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export function ApprovalsInbox() {
  const [items, setItems]     = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/approvals')
      .then(r => r.json())
      .then(setItems)
      .catch(() => setError('Failed to load approvals'))
      .finally(() => setLoading(false))
  }, [])

  async function handleApprove(id: string) {
    const res = await fetch(`/api/approvals/${id}/approve`, { method: 'POST' })
    if (!res.ok) return
    setItems(prev => prev.map(a => a.id === id ? { ...a, status: 'APPROVED', decidedAt: new Date().toISOString() } : a))
  }

  async function handleReject(id: string, reason: string) {
    const res = await fetch(`/api/approvals/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    if (!res.ok) return
    setItems(prev => prev.map(a => a.id === id
      ? { ...a, status: 'REJECTED', decidedAt: new Date().toISOString(), rejectionReason: reason || null }
      : a
    ))
  }

  const pending = items.filter(a => a.status === 'PENDING')
  const decided = items.filter(a => a.status !== 'PENDING')

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading approvals…</div>
  }

  if (error) {
    return <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Pending Your Decision</h2>
          {pending.length > 0 && (
            <span className="rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5">
              {pending.length}
            </span>
          )}
        </div>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5 text-emerald-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-600">All clear</p>
            <p className="text-xs text-slate-400 mt-1">No approvals waiting for your decision.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map(item => (
              <ApprovalCard key={item.id} item={item} onApprove={handleApprove} onReject={handleReject} />
            ))}
          </div>
        )}
      </div>

      {decided.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Decision History</h2>
          <div className="space-y-3">
            {decided.map(item => (
              <ApprovalCard key={item.id} item={item} onApprove={handleApprove} onReject={handleReject} />
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-16 text-center">
          <p className="text-slate-400 text-sm">No approval requests assigned to you yet.</p>
        </div>
      )}
    </div>
  )
}
