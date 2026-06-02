'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'

// ─── Editorial palette (matches dashboard / clients / new opportunity) ──────
const C = {
  bg:         '#F4F6FB',
  bgSoft:     '#EAEEF6',
  rule:       '#D6DCE8',
  ruleSoft:   '#E2E6EE',
  ink:        '#001E96',
  inkSoft:    '#3A4A6A',
  inkMuted:   '#7B7C7F',
  inkFaint:   '#A5A7AA',
  accent:     '#005CD9',
  accentDeep: '#001E96',
  accentSoft: '#DCE7F5',
  // Brand secondary
  won:        '#36A463',
  wonDeep:    '#1F6B3C',
  wonSoft:    '#E1F1E9',
  rejected:   '#D6454A',
  rejectedDeep:'#8A2A1F',
  rejectedSoft:'#FBE9E7',
  withdrawn:  '#7B7C7F',
  withdrawnSoft:'#EEF0F4',
}

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
}

const SANS: React.CSSProperties = {
  fontFamily: "var(--font-geist-sans), 'Inter', system-ui, sans-serif",
}

type PricingSnap = {
  versionNumber: number
  proposedBillings: number | null
  grossMarginPct: number | null
  totalHours: number | null
  discountPremiumPct: number | null
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
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'
  requestedAt: string
  decidedAt: string | null
  rejectionReason: string | null
  pricingVersionNumber: number | null
  businessJustification: string | null
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
  if (!bytes) return ''
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000)     return `${(bytes / 1_000).toFixed(0)} KB`
  return `${bytes} B`
}

// ─── Atoms ──────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: ApprovalItem['status'] }) {
  const map = {
    PENDING:   { fg: C.accentDeep,    bg: C.accentSoft,    dot: C.accent,    label: 'Pending' },
    APPROVED:  { fg: C.wonDeep,       bg: C.wonSoft,       dot: C.won,       label: 'Approved' },
    REJECTED:  { fg: C.rejectedDeep,  bg: C.rejectedSoft,  dot: C.rejected,  label: 'Rejected' },
    WITHDRAWN: { fg: C.inkSoft,       bg: C.withdrawnSoft, dot: C.withdrawn, label: 'Withdrawn' },
  }[status]
  return (
    <span style={{
      ...SANS,
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '2px 9px 2px 8px',
      borderRadius: 999,
      background: map.bg,
      color: map.fg,
      fontSize: 11, fontWeight: 600,
      letterSpacing: '0.02em',
      lineHeight: 1.6,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: map.dot, flexShrink: 0 }} />
      {map.label}
    </span>
  )
}

function MetaItem({ label, value, valueColor = C.ink }: { label: string; value: React.ReactNode; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span style={{
        ...MONO, fontSize: 9.5, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: C.inkMuted, fontWeight: 500,
      }}>{label}</span>
      <span style={{ ...SANS, fontSize: 13, color: valueColor, fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function SectionDivider({ label, count }: { label: string; count?: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '20px 0 12px',
      borderBottom: `1.5px solid ${C.ink}`,
      marginBottom: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{
          ...SANS, fontSize: 11, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: C.ink, fontWeight: 600, margin: 0,
        }}>{label}</h2>
        {count !== undefined && (
          <span style={{ ...MONO, fontSize: 10.5, color: C.inkFaint, letterSpacing: '0.08em' }}>
            {String(count).padStart(2, '0')}
          </span>
        )}
      </div>
    </div>
  )
}

function DocRow({ doc }: { doc: DocSnap }) {
  const isPdf  = doc.mimeType === 'application/pdf'
  const isWord = doc.mimeType?.includes('word') || doc.mimeType?.includes('document')
  const color  = isPdf ? '#E53935' : isWord ? '#1565C0' : '#546E7A'
  const label  = isPdf ? 'PDF' : isWord ? 'DOC' : 'FILE'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 0',
      borderBottom: `1px solid ${C.ruleSoft}`,
    }}>
      <div style={{
        width: 28, height: 34, background: color, flexShrink: 0,
        display: 'grid', placeItems: 'center', borderRadius: 2,
      }}>
        <span style={{ color: '#fff', fontSize: 8, fontWeight: 700, letterSpacing: '0.04em' }}>{label}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...SANS, fontSize: 12.5, color: C.ink, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {doc.fileName}
        </div>
        <div style={{ ...MONO, fontSize: 10, color: C.inkFaint, marginTop: 2, letterSpacing: '0.04em' }}>
          V{doc.version} · {fmtSize(doc.fileSizeBytes)} · {fmtDate(doc.uploadedAt)}
        </div>
      </div>
      {doc.signedUrl && (
        <a
          href={doc.signedUrl} target="_blank" rel="noopener noreferrer"
          style={{
            ...MONO, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: C.accent, textDecoration: 'none', fontWeight: 600,
            padding: '5px 10px', border: `1px solid ${C.rule}`, background: '#fff',
            whiteSpace: 'nowrap',
          }}
        >
          Download
        </a>
      )}
    </div>
  )
}

function SowEvidence({ opp }: { opp: ApprovalItem['opportunity'] }) {
  return (
    <div style={{
      marginTop: 16, padding: '14px 16px',
      background: C.bgSoft, border: `1px solid ${C.rule}`, borderRadius: 4,
    }}>
      <div style={{
        ...MONO, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: C.inkMuted, fontWeight: 500, marginBottom: 12,
      }}>Verification Evidence</div>

      {/* Pre-contract agreement */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 14, height: 14, borderRadius: 2, flexShrink: 0,
          background: opp.preContractAgreed ? C.accent : '#fff',
          border: `1px solid ${opp.preContractAgreed ? C.accent : C.rule}`,
          display: 'grid', placeItems: 'center',
        }}>
          {opp.preContractAgreed && (
            <svg viewBox="0 0 12 10" fill="none" style={{ width: 8, height: 7 }}>
              <path d="M1 5l3.5 3.5L11 1" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span style={{ ...SANS, fontSize: 12.5, color: C.inkSoft }}>
          Pre-contract agreement
          <span style={{ color: opp.preContractAgreed ? C.wonDeep : C.inkFaint, fontWeight: 600, marginLeft: 6 }}>
            {opp.preContractAgreed ? '· Agreed' : '· Not agreed'}
          </span>
        </span>
      </div>

      {/* SOW documents */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          ...MONO, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: C.inkMuted, fontWeight: 500, marginBottom: 6,
        }}>
          Statement of Work {opp.sowDocuments.length > 0 ? `· ${opp.sowDocuments.length}` : '· none uploaded'}
        </div>
        {opp.sowDocuments.map(d => <DocRow key={d.id} doc={d} />)}
      </div>

      {/* PO documents */}
      <div>
        <div style={{
          ...MONO, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: C.inkMuted, fontWeight: 500, marginBottom: 6,
        }}>
          Purchase Order {opp.poDocuments.length > 0 ? `· ${opp.poDocuments.length}` : '· none uploaded'}
        </div>
        {opp.poDocuments.map(d => <DocRow key={d.id} doc={d} />)}
      </div>
    </div>
  )
}

function PricingSnap({ pv }: { pv: PricingSnap }) {
  const cells: [string, string][] = [
    ['Proposed Billings', fmt(pv.proposedBillings != null ? Number(pv.proposedBillings) : null)],
    ['Gross Margin',      pv.grossMarginPct      != null ? `${Number(pv.grossMarginPct).toFixed(1)}%`        : '—'],
    ['Total Hours',       pv.totalHours          != null ? `${Number(pv.totalHours).toLocaleString()} h`     : '—'],
    ['D / P',             pv.discountPremiumPct  != null
      ? `${Number(pv.discountPremiumPct) >= 0 ? '+' : ''}${Number(pv.discountPremiumPct).toFixed(1)}%`
      : '—'],
  ]
  return (
    <div style={{
      marginTop: 16, padding: '14px 16px',
      background: C.bgSoft, border: `1px solid ${C.rule}`, borderRadius: 4,
    }}>
      <div style={{
        ...MONO, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: C.inkMuted, fontWeight: 500, marginBottom: 12,
        display: 'flex', alignItems: 'baseline', gap: 8,
      }}>
        <span>Pricing Snapshot</span>
        <span style={{ color: C.inkFaint }}>· V{pv.versionNumber}</span>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 0,
        borderTop: `1px solid ${C.rule}`,
      }}>
        {cells.map(([label, value], i) => (
          <div key={label} style={{
            padding: '10px 12px',
            borderRight: i < 3 ? `1px solid ${C.rule}` : 'none',
          }}>
            <div style={{
              ...MONO, fontSize: 9.5, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: C.inkMuted, fontWeight: 500,
            }}>{label}</div>
            <div style={{
              ...SANS, fontSize: 16, color: C.ink, fontWeight: 500,
              marginTop: 4, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
            }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Card ───────────────────────────────────────────────────────────────────

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
  const isSow     = item.approvalType === 'SOW_VERIFICATION'
  const typeLabel = isSow ? 'SoW Verification' : 'Pricing Approval'

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
    <div style={{
      background: '#fff',
      border: `1px solid ${C.inkMuted}`,
      borderTop: `3px solid ${C.ink}`,
      boxShadow: `0 1px 0 ${C.rule}, 4px 4px 0 -1px ${C.bgSoft}`,
      padding: '18px 20px 20px',
    }}>
      {/* TYPE eyebrow + STATUS pill */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: 10,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          ...MONO, fontSize: 13.5,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          color: C.accent, fontWeight: 600,
        }}>
          <span style={{
            width: 6, height: 6, background: C.accent,
            display: 'inline-block', transform: 'rotate(45deg)',
          }} />
          {typeLabel}
        </div>
        <StatusPill status={item.status} />
      </div>

      {/* Opportunity name + BD ID */}
      <Link
        href={`/opportunities/${item.opportunity.opportunityId}`}
        style={{
          ...SANS, fontSize: 19, fontWeight: 600,
          color: C.ink, textDecoration: 'none',
          letterSpacing: '-0.01em', lineHeight: 1.25,
          display: 'block',
        }}
        className="hover:underline decoration-from-font"
      >
        {item.opportunity.opportunityName}
      </Link>
      <div style={{ ...MONO, fontSize: 10.5, color: C.inkMuted, letterSpacing: '0.08em', marginTop: 4 }}>
        {item.opportunity.opportunityId}
        {item.pricingVersionNumber != null && (
          <> · <span style={{ color: C.accent, fontWeight: 600 }}>V{item.pricingVersionNumber}</span></>
        )}
      </div>

      {/* META strip */}
      <div style={{
        marginTop: 16, paddingTop: 14, paddingBottom: 14,
        borderTop: `1px solid ${C.rule}`, borderBottom: `1px solid ${C.rule}`,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 18,
      }}>
        <MetaItem label="Client"        value={item.opportunity.client.name} />
        <MetaItem label="Period"        value={`${fmtDate(item.opportunity.startDate)} → ${fmtDate(item.opportunity.endDate)}`} />
        <MetaItem label="Requested by"  value={<>{item.requestedBy.name} <span style={{ color: C.inkFaint, fontWeight: 400 }}>· {item.requestedBy.role}</span></>} />
        <MetaItem label="Submitted"     value={fmtDate(item.requestedAt)} />
        {item.decidedAt && <MetaItem label="Decided" value={fmtDate(item.decidedAt)} />}
      </div>

      {/* Business Justification */}
      {item.businessJustification && (
        <div style={{
          marginTop: 16, padding: '12px 14px',
          background: C.bgSoft, border: `1px solid ${C.rule}`, borderRadius: 4,
        }}>
          <div style={{
            ...MONO, fontSize: 10, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: C.inkMuted, fontWeight: 500,
            marginBottom: 6,
          }}>Business Justification</div>
          <div style={{ ...SANS, fontSize: 13, color: C.inkSoft, lineHeight: 1.55 }}>
            {item.businessJustification}
          </div>
        </div>
      )}

      {/* SOW evidence */}
      {isSow && <SowEvidence opp={item.opportunity} />}

      {/* Pricing snapshot */}
      {!isSow && pv && <PricingSnap pv={pv} />}
      {!isSow && !pv && (
        <div style={{
          marginTop: 16, padding: '14px 16px',
          border: `1px dashed ${C.rule}`,
          ...MONO, fontSize: 11, color: C.inkFaint, letterSpacing: '0.04em',
        }}>
          No final pricing version set on this opportunity.
        </div>
      )}

      {/* Rejection reason */}
      {item.status === 'REJECTED' && item.rejectionReason && (
        <div style={{
          marginTop: 16, padding: '12px 14px',
          background: C.rejectedSoft, borderLeft: `3px solid ${C.rejected}`, borderRadius: 0,
        }}>
          <div style={{
            ...MONO, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: C.rejectedDeep, fontWeight: 500, marginBottom: 6,
          }}>Rejection Reason</div>
          <div style={{ ...SANS, fontSize: 13, color: C.rejectedDeep, lineHeight: 1.55 }}>
            {item.rejectionReason}
          </div>
        </div>
      )}

      {/* ACTIONS */}
      {isPending && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.rule}` }}>
          {rejecting ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea
                rows={2}
                placeholder="Reason for rejection (optional)…"
                value={reason}
                onChange={e => setReason(e.target.value)}
                style={{
                  ...SANS,
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 12px',
                  border: `1px solid ${C.rejected}`,
                  borderRadius: 2,
                  fontSize: 13, color: C.ink,
                  outline: 'none', resize: 'none',
                  background: '#fff',
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleReject} disabled={loading}
                  style={{
                    ...MONO, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
                    padding: '10px 18px', background: C.rejected, color: '#fff',
                    border: `1px solid ${C.rejectedDeep}`, fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.55 : 1,
                  }}>
                  {loading ? 'Rejecting…' : 'Confirm Reject'}
                </button>
                <button onClick={() => { setRejecting(false); setReason('') }} disabled={loading}
                  style={{
                    ...MONO, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
                    padding: '10px 16px', background: '#fff', color: C.inkMuted,
                    border: `1px solid ${C.rule}`, fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleApprove} disabled={loading}
                style={{
                  ...MONO, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
                  padding: '10px 22px', background: C.won, color: '#fff',
                  border: `1px solid ${C.wonDeep}`, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.55 : 1,
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                     style={{ width: 12, height: 12 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {loading ? 'Approving…' : isSow ? 'Verify & Mark Won' : 'Approve'}
              </button>
              <button onClick={() => setRejecting(true)} disabled={loading}
                style={{
                  ...MONO, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
                  padding: '10px 18px', background: '#fff', color: C.rejectedDeep,
                  border: `1px solid ${C.rejected}`, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.55 : 1,
                }}>
                Reject
              </button>
              <Link
                href={`/opportunities/${item.opportunity.opportunityId}`}
                style={{
                  ...MONO, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: C.accent, textDecoration: 'none', fontWeight: 600,
                  marginLeft: 'auto',
                }}>
                View Opportunity →
              </Link>
            </div>
          )}
        </div>
      )}

      {!isPending && (
        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
          <Link
            href={`/opportunities/${item.opportunity.opportunityId}`}
            style={{
              ...MONO, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: C.accent, textDecoration: 'none', fontWeight: 600,
            }}>
            View Opportunity →
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function ApprovalsInbox() {
  const [items, setItems]     = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/approvals')
      .then(r => r.json())
      .then(setItems)
      .catch(() => { setError('Failed to load approvals'); toast.error('Failed to load approvals') })
      .finally(() => setLoading(false))
  }, [])

  async function handleApprove(id: string) {
    const res = await fetch(`/api/approvals/${id}/approve`, { method: 'POST' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast.error(j.error ?? 'Failed to approve. Please try again.')
      return
    }
    setItems(prev => prev.map(a => a.id === id ? { ...a, status: 'APPROVED', decidedAt: new Date().toISOString() } : a))
  }

  async function handleReject(id: string, reason: string) {
    const res = await fetch(`/api/approvals/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast.error(j.error ?? 'Failed to reject. Please try again.')
      return
    }
    setItems(prev => prev.map(a => a.id === id
      ? { ...a, status: 'REJECTED', decidedAt: new Date().toISOString(), rejectionReason: reason || null }
      : a
    ))
  }

  const pending = items.filter(a => a.status === 'PENDING')
  const decided = items.filter(a => a.status !== 'PENDING')

  return (
    <>
      {/* ── Editorial header (matches Clients / New Opportunity) ── */}
      <header
        style={{
          background: C.bg,
          borderBottom: `1px solid ${C.rule}`,
          padding: '22px 44px 18px',
          flexShrink: 0,
        }}
        className="flex items-center justify-between gap-6"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            ...MONO, fontSize: 10.5, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: C.inkMuted, fontWeight: 500,
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            NEXA · Approvals Inbox
          </div>
          <h1 style={{
            ...SANS, fontSize: 28, fontWeight: 600,
            color: C.ink, letterSpacing: '-0.015em',
            lineHeight: 1.1, margin: 0,
          }}>Approvals</h1>
        </div>
      </header>

      <div style={{ padding: '0 44px 32px' }}>
        {/* ── KPI strip ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          borderTop: `1px solid ${C.rule}`, borderBottom: `1px solid ${C.rule}`,
          padding: '20px 0', marginTop: 0,
        }}>
          {[
            { label: 'Pending',  value: pending.length },
            { label: 'Decided',  value: decided.length },
            { label: 'Total',    value: items.length },
          ].map((it, i) => (
            <div key={it.label} style={{
              padding: '0 36px',
              borderRight: i < 2 ? `1px solid ${C.rule}` : 'none',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{
                ...MONO, fontSize: 11, letterSpacing: '0.16em',
                textTransform: 'uppercase', color: C.inkMuted, fontWeight: 500,
              }}>{it.label}</div>
              <div style={{
                ...SANS, fontSize: 38, fontWeight: 500,
                color: it.label === 'Pending' && it.value > 0 ? C.accent : C.ink,
                lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
              }}>{String(it.value).padStart(2, '0')}</div>
            </div>
          ))}
        </div>

        {/* ── Loading / error states ── */}
        {loading && (
          <div style={{
            ...MONO, fontSize: 11, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: C.inkFaint,
            textAlign: 'center', padding: '80px 0',
          }}>
            Loading approvals…
          </div>
        )}
        {error && (
          <div style={{
            marginTop: 24, padding: '12px 14px',
            background: C.rejectedSoft, border: `1px solid ${C.rejected}`, borderRadius: 2,
            ...SANS, fontSize: 13, color: C.rejectedDeep,
          }}>{error}</div>
        )}

        {/* ── Pending section ── */}
        {!loading && !error && (
          <>
            <SectionDivider label="Pending Decision" count={pending.length} />

            {pending.length === 0 ? (
              <div style={{
                padding: '60px 0',
                textAlign: 'center',
              }}>
                <div style={{
                  ...MONO, fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: C.inkMuted, fontWeight: 500, marginBottom: 8,
                }}>NEXA · Inbox</div>
                <div style={{
                  ...SANS, fontSize: 22, fontWeight: 600, color: C.ink, letterSpacing: '-0.01em',
                  marginBottom: 6,
                }}>All clear.</div>
                <div style={{ ...SANS, fontSize: 13, color: C.inkMuted }}>
                  No approvals awaiting your decision.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {pending.map(item => (
                  <ApprovalCard key={item.id} item={item} onApprove={handleApprove} onReject={handleReject} />
                ))}
              </div>
            )}

            {/* ── Decided section ── */}
            {decided.length > 0 && (
              <>
                <SectionDivider label="Decision History" count={decided.length} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {decided.map(item => (
                    <ApprovalCard key={item.id} item={item} onApprove={handleApprove} onReject={handleReject} />
                  ))}
                </div>
              </>
            )}

            {/* ── Truly empty ── */}
            {items.length === 0 && !loading && (
              <div style={{
                padding: '80px 0', textAlign: 'center',
              }}>
                <div style={{
                  ...MONO, fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: C.inkMuted, fontWeight: 500, marginBottom: 8,
                }}>NEXA · Inbox</div>
                <div style={{ ...SANS, fontSize: 22, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
                  No requests yet.
                </div>
                <div style={{ ...SANS, fontSize: 13, color: C.inkMuted }}>
                  Approval requests assigned to you will appear here.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
