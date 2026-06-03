'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useMemo, useEffect, useTransition } from 'react'
import Link from 'next/link'
import type { OpportunityRow } from '@/lib/db/opportunities'
import { OpportunityStatus } from '@prisma/client'
import { STAGE_NEXT_STEPS } from '@/lib/stageNextSteps'

// V8 palette
const C = {
  ink:       '#001E96',
  inkSoft:   '#3A4A6A',
  inkMuted:  '#7B7C7F',
  inkFaint:  '#A5A7AA',
  accent:    '#005CD9',
  accentDeep:'#001E96',
  accentSoft:'#DCE7F5',
  rule:      '#D6DCE8',
  ruleSoft:  '#E2E6EE',
}

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
}

const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-instrument-serif), 'Fraunces', Georgia, serif",
}

const STATUS_FILTERS: { label: string; value: 'ALL' | OpportunityStatus }[] = [
  { label: 'All',       value: 'ALL'      },
  { label: 'Open',      value: 'OPEN'     },
  { label: 'Won',       value: 'WON'      },
  { label: 'Lost',      value: 'LOST'     },
  { label: 'Abandoned', value: 'ABANDONED'},
  { label: 'Archived',  value: 'ARCHIVED' },
]

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

function fmtRevenue(row: OpportunityRow) {
  const n = row.pricingVersions[0]?.proposedBillings != null
    ? Number(row.pricingVersions[0].proposedBillings)
    : Number(row.estimatedRevenue ?? 0)
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function hasFinalPricing(row: OpportunityRow) {
  return row.pricingVersions.length > 0 && row.pricingVersions[0]?.proposedBillings != null
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; dot: string }> = {
    OPEN:      { bg: C.accentSoft, fg: C.accentDeep, dot: C.accent },
    WON:       { bg: '#E1F1E9', fg: '#1F6B3C', dot: '#36A463' },
    LOST:      { bg: '#FBE9E7', fg: '#8A2A1F', dot: '#D6454A' },
    ABANDONED: { bg: '#EEF0F4', fg: '#5A6478', dot: '#A5A7AA' },
    ARCHIVED:  { bg: '#EEF0F4', fg: '#5A6478', dot: '#A5A7AA' },
  }
  const s = map[status] ?? map.OPEN
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '2px 8px 2px 7px', borderRadius: 999,
      background: s.bg, color: s.fg,
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: 11, fontWeight: 600, letterSpacing: '0.01em', lineHeight: 1.6,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: s.dot, display: 'inline-block', flexShrink: 0 }} />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  )
}

function Avatar({ initials }: { initials: string }) {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: 999,
      background: C.accentSoft, color: C.accentDeep,
      display: 'inline-grid', placeItems: 'center',
      fontSize: 9, fontWeight: 700, letterSpacing: '-0.01em',
      fontFamily: "'Inter', system-ui, sans-serif",
      flexShrink: 0,
    }}>{initials}</div>
  )
}

function ownerInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function FunnelIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 10, height: 10 }}
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}

function FilterPopover({
  options,
  selected,
  onToggle,
  onClear,
  onClose,
  pos,
}: {
  options: { label: string; value: string }[]
  selected: string[]
  onToggle: (v: string) => void
  onClear: () => void
  onClose: () => void
  pos: { top: number; left: number }
}) {
  return (
    <>
      {/* Backdrop — closes popover on outside click */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={onClose} />

      {/* Popover panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          zIndex: 101,
          background: '#ffffff',
          border: `1px solid ${C.rule}`,
          borderRadius: 8,
          boxShadow: '0 6px 20px rgba(0,0,0,0.13)',
          minWidth: 180,
          maxHeight: 260,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 12px',
          borderBottom: `1px solid ${C.ruleSoft}`,
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: C.inkMuted,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            Filter
          </span>
          {selected.length > 0 && (
            <button
              onClick={onClear}
              style={{
                fontSize: 11, color: C.accent, background: 'none', border: 'none',
                cursor: 'pointer', padding: 0, fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Option list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {options.map(opt => {
            const checked = selected.includes(opt.value)
            return (
              <div
                key={opt.value}
                onClick={() => onToggle(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: 12.5,
                  color: checked ? C.ink : C.inkSoft,
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontWeight: checked ? 500 : 400,
                  background: checked ? `${C.accentSoft}66` : 'transparent',
                  userSelect: 'none',
                }}
              >
                {/* Custom checkbox */}
                <span style={{
                  width: 13, height: 13, borderRadius: 3,
                  border: `1.5px solid ${checked ? C.accent : C.rule}`,
                  background: checked ? C.accent : 'transparent',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 100ms',
                }}>
                  {checked && (
                    <svg viewBox="0 0 10 10" fill="none" style={{ width: 8, height: 8 }}>
                      <path d="M2 5l2.5 2.5L8 2.5" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {opt.label}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

export function OpportunityTable({ rows, roleLabel }: { rows: OpportunityRow[]; roleLabel: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const active = (params.get('status') ?? 'ALL') as 'ALL' | OpportunityStatus

  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter]       = useState<string | null>(null)
  const [popoverPos, setPopoverPos]       = useState({ top: 0, left: 0 })

  // Show a spinner ONLY if a row click takes longer than 400 ms to resolve —
  // snappy navigations stay flicker-free, slow ones get a clear "loading" cue.
  const [isPending, startTransition] = useTransition()
  const [showSpinner, setShowSpinner] = useState(false)
  useEffect(() => {
    if (!isPending) { setShowSpinner(false); return }
    const t = setTimeout(() => setShowSpinner(true), 400)
    return () => clearTimeout(t)
  }, [isPending])

  function openOpportunity(opportunityId: string) {
    startTransition(() => router.push(`/opportunities/${opportunityId}`))
  }

  function openColFilter(key: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (openFilter === key) { setOpenFilter(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setPopoverPos({
      top:  rect.bottom + 6,
      left: Math.min(rect.left - 40, window.innerWidth - 210),
    })
    setOpenFilter(key)
  }

  function toggleFilter(key: string, value: string) {
    setColumnFilters(prev => {
      const cur  = prev[key] ?? []
      const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value]
      if (next.length === 0) { const n = { ...prev }; delete n[key]; return n }
      return { ...prev, [key]: next }
    })
  }

  function clearFilter(key: string) {
    setColumnFilters(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  // ── Derived filter options ─────────────────────────────────────────────────
  const clientOptions = useMemo(() =>
    [...new Set(rows.map(r => r.client.name))].sort().map(n => ({ label: n, value: n })),
    [rows])

  const ownerOptions = useMemo(() =>
    [...new Set(rows.map(r => r.owner.name))].sort().map(n => ({ label: n, value: n })),
    [rows])

  const statusOptions = useMemo(() =>
    [...new Set(rows.map(r => r.status))].sort()
      .map(s => ({ label: s.charAt(0) + s.slice(1).toLowerCase(), value: s })),
    [rows])

  const winOptions = [
    { label: '≤ 25%',  value: '0-25'   },
    { label: '26–50%', value: '26-50'  },
    { label: '51–75%', value: '51-75'  },
    { label: '> 75%',  value: '76-100' },
  ]

  const windowOptions = useMemo(() =>
    [...new Set(
      rows.map(r => r.startDate ? new Date(r.startDate).getFullYear() : null)
          .filter((y): y is number => y !== null)
    )].sort().map(y => ({ label: String(y), value: String(y) })),
    [rows])

  const revenueOptions = [
    { label: 'Final pricing',  value: 'FINAL'     },
    { label: 'Estimated only', value: 'ESTIMATED' },
    { label: 'No revenue set', value: 'NONE'      },
  ]

  const commentsOptions = [
    { label: 'Has comments', value: 'has' },
    { label: 'No comments',  value: 'no'  },
  ]

  const nextstepOptions = useMemo(() => {
    const vals = [...new Set(rows.map(r => STAGE_NEXT_STEPS[r.stage] ?? '—'))].sort()
    return vals.map(v => ({ label: v, value: v }))
  }, [rows])

  const colFilterOptions: Record<string, { label: string; value: string }[]> = {
    client:   clientOptions,
    owner:    ownerOptions,
    status:   statusOptions,
    winpct:   winOptions,
    window:   windowOptions,
    revenue:  revenueOptions,
    comments: commentsOptions,
    nextstep: nextstepOptions,
  }

  function setStatusFilter(value: string) {
    const cur = new URLSearchParams(window.location.search)
    if (value === 'ALL') cur.delete('status')
    else cur.set('status', value)
    router.push(`/dashboard?${cur.toString()}`)
  }

  // ── Multi-column filter logic ──────────────────────────────────────────────
  const visible = useMemo(() => rows.filter(r => {
    if (active !== 'ALL' && r.status !== active) return false

    const cf = columnFilters['client']
    if (cf?.length && !cf.includes(r.client.name)) return false

    const of2 = columnFilters['owner']
    if (of2?.length && !of2.includes(r.owner.name)) return false

    const sf = columnFilters['status']
    if (sf?.length && !sf.includes(r.status)) return false

    const rf = columnFilters['revenue']
    if (rf?.length) {
      const fin = hasFinalPricing(r)
      const est = Number(r.estimatedRevenue ?? 0) > 0
      const match = rf.some(v =>
        (v === 'FINAL' && fin) || (v === 'ESTIMATED' && !fin && est) || (v === 'NONE' && !fin && !est)
      )
      if (!match) return false
    }

    const wf = columnFilters['winpct']
    if (wf?.length) {
      const prob = r.probability != null ? Number(r.probability) : null
      if (prob === null) return false
      const match = wf.some(range => {
        if (range === '0-25')   return prob <= 25
        if (range === '26-50')  return prob > 25 && prob <= 50
        if (range === '51-75')  return prob > 50 && prob <= 75
        if (range === '76-100') return prob > 75
        return false
      })
      if (!match) return false
    }

    const yf = columnFilters['window']
    if (yf?.length) {
      const yr = r.startDate ? String(new Date(r.startDate).getFullYear()) : null
      if (!yr || !yf.includes(yr)) return false
    }

    const cmf = columnFilters['comments']
    if (cmf?.length) {
      const has = r._count.comments > 0
      const match = cmf.some(v => (v === 'has' && has) || (v === 'no' && !has))
      if (!match) return false
    }

    const nsf = columnFilters['nextstep']
    if (nsf?.length) {
      const ns = STAGE_NEXT_STEPS[r.stage] ?? '—'
      if (!nsf.includes(ns)) return false
    }

    return true
  }), [rows, active, columnFilters])

  const hasActiveFilters = Object.values(columnFilters).some(v => v?.length > 0)

  // ── Column definitions ─────────────────────────────────────────────────────
  const COLS = [
    { key: 'bdid',     label: 'BD ID',       w: 56,  filterable: false },
    { key: 'client',   label: 'Client',      w: 140, filterable: true  },
    { key: 'opp',      label: 'Opportunity', w: 220, filterable: false },
    { key: 'owner',    label: 'Owner',       w: 160, filterable: true  },
    { key: 'revenue',  label: 'Revenue',     w: 110, filterable: true  },
    { key: 'winpct',   label: 'Win %',       w: 72,  filterable: true  },
    { key: 'window',   label: 'Time Window', w: 180, filterable: true  },
    { key: 'status',   label: 'Status',      w: 100, filterable: true  },
    { key: 'nextstep',    label: 'Next Step',   w: 90,  filterable: true  },
    { key: 'projectcode', label: 'Proj. Code', w: 72,  filterable: false },
    { key: 'comments',    label: 'Comments',   w: 80,  filterable: true  },
  ]

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* ─── Editorial loading overlay (only after 400ms of waiting) ─── */}
      {showSpinner && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(10,31,68,0.45)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', padding: '24px 32px',
            border: `1px solid ${C.rule}`, borderRadius: 4,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            minWidth: 240,
          }}>
            <svg className="animate-spin" viewBox="0 0 24 24" width={26} height={26} style={{ color: C.accent }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} fill="none" strokeDasharray="40 100" strokeLinecap="round" />
            </svg>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 5, height: 5, background: C.accent, display: 'inline-block', transform: 'rotate(45deg)' }} />
              <span style={{
                ...MONO, fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase',
                color: C.ink, fontWeight: 600,
              }}>Loading Opportunity</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Status tabs + clear ─── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '20px 0 14px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 28, alignItems: 'baseline' }}>
          {STATUS_FILTERS.map(f => {
            const count    = f.value === 'ALL' ? rows.length : rows.filter(r => r.status === f.value).length
            const isActive = active === f.value
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                style={{
                  display: 'inline-flex', gap: 6, alignItems: 'baseline',
                  paddingBottom: 8, cursor: 'pointer', background: 'none', border: 'none',
                  borderBottom: isActive ? `1.5px solid ${C.accent}` : '1.5px solid transparent',
                  color: isActive ? C.ink : C.inkMuted,
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: 13, fontWeight: isActive ? 600 : 500, letterSpacing: '0.01em',
                }}
              >
                {f.label}
                <span style={{ ...MONO, fontSize: 10.5, color: isActive ? C.accent : C.inkFaint }}>
                  {String(count).padStart(2, '0')}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontFamily: "'Inter', system-ui, sans-serif" }}>
          {hasActiveFilters && (
            <button
              onClick={() => setColumnFilters({})}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'none', border: `1px solid ${C.rule}`, borderRadius: 4,
                padding: '4px 10px', cursor: 'pointer',
                fontSize: 11.5, color: C.inkMuted,
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              ✕ Clear all filters
            </button>
          )}
          <span style={{ color: C.accent, borderBottom: `1px dotted ${C.accent}`, cursor: 'pointer', paddingBottom: 1, fontSize: 12.5 }}>
            Export
          </span>
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="flex-1 overflow-auto min-h-0">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Inter', system-ui, sans-serif" }}>
          <thead>
            <tr style={{ borderBottom: `1.5px solid ${C.ink}` }}>
              {COLS.map(col => {
                const colActive = (columnFilters[col.key]?.length ?? 0) > 0
                return (
                  <th
                    key={col.key}
                    style={{
                      padding: '12px 42px 12px 0',
                      textAlign: 'left',
                      fontFamily: "'Inter', system-ui, sans-serif",
                      fontSize: 11, fontWeight: 600,
                      letterSpacing: '0.14em', textTransform: 'uppercase',
                      color: colActive ? C.accent : C.inkMuted,
                      width: col.w,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-start', gap: 5 }}>
                      <span>{col.label}</span>
                      {col.filterable && (
                        <button
                          onClick={e => { e.stopPropagation(); openColFilter(col.key, e) }}
                          title={`Filter by ${col.label}`}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '1px 3px', borderRadius: 3,
                            color: colActive ? C.accent : C.inkFaint,
                            display: 'inline-flex', alignItems: 'center',
                            outline: openFilter === col.key ? `1.5px solid ${C.accent}` : 'none',
                            transition: 'color 100ms',
                          }}
                        >
                          <FunnelIcon active={colActive} />
                        </button>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={11} style={{ padding: '64px 0', textAlign: 'center', color: C.inkMuted, fontSize: 14 }}>
                  No opportunities found.
                </td>
              </tr>
            )}
            {visible.map(row => {
              const revStr   = fmtRevenue(row)
              const isFinal  = hasFinalPricing(row)
              // Once SoW verification is approved (stage advances to TO_BE_ARCHIVED)
              // the deal is effectively certain — show 100% regardless of the
              // stored probability.
              const prob     = row.stage === 'TO_BE_ARCHIVED'
                ? 100
                : (row.probability != null ? Number(row.probability) : null)
              const start    = fmtDate(row.startDate)
              const end      = fmtDate(row.endDate)
              const nextStep = STAGE_NEXT_STEPS[row.stage] ?? '—'

              return (
                <tr
                  key={row.id}
                  onClick={() => openOpportunity(row.opportunityId)}
                  style={{ borderBottom: `1px solid ${C.ruleSoft}`, cursor: 'pointer', transition: 'background 120ms' }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${C.accentSoft}55`)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* BD ID */}
                  <td style={{ padding: '14px 42px 14px 0', verticalAlign: 'middle', textAlign: 'left' }}>
                    <Link
                      href={`/opportunities/${row.opportunityId}`}
                      onClick={e => { e.preventDefault(); e.stopPropagation(); openOpportunity(row.opportunityId) }}
                      style={{ ...MONO, fontSize: 11.5, color: C.inkMuted, letterSpacing: '0.02em', textDecoration: 'none' }}
                    >
                      {row.opportunityId}
                    </Link>
                  </td>

                  {/* Client */}
                  <td style={{ padding: '14px 42px 14px 0', verticalAlign: 'middle', textAlign: 'left', fontWeight: 500, color: C.ink, fontSize: 14, whiteSpace: 'nowrap' }}>
                    {row.client.name}
                  </td>

                  {/* Opportunity */}
                  <td style={{ padding: '14px 42px 14px 0', verticalAlign: 'middle', textAlign: 'left', maxWidth: 220, color: C.inkSoft, fontSize: 14 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.opportunityName}
                    </div>
                  </td>

                  {/* Owner */}
                  <td style={{ padding: '14px 42px 14px 0', verticalAlign: 'middle', textAlign: 'left' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: C.inkSoft, fontSize: 14 }}>
                      <Avatar initials={ownerInitials(row.owner.name)} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.owner.name}
                      </span>
                    </div>
                  </td>

                  {/* Revenue */}
                  <td style={{ padding: '14px 42px 14px 0', verticalAlign: 'middle', textAlign: 'left' }}>
                    <span style={{
                      ...SERIF, fontSize: 19, fontWeight: 400,
                      letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
                      color: revStr === '—' ? C.inkFaint : isFinal ? '#1F6B3C' : C.ink,
                    }}>{revStr}</span>
                  </td>

                  {/* Win % — bar tinted along a warm→cool HSL gradient
                       (red at 0% → orange at 50% → green at 100%) so the
                       visual reading matches the implied confidence. */}
                  <td style={{ padding: '14px 42px 14px 0', verticalAlign: 'middle', textAlign: 'left' }}>
                    {prob !== null ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 64 }}>
                        <span style={{ ...MONO, fontSize: 11, color: C.inkSoft, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>
                          {prob}%
                        </span>
                        <div style={{
                          width: '100%', height: 4,
                          background: C.ruleSoft, borderRadius: 2,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${Math.max(0, Math.min(100, prob))}%`,
                            height: '100%',
                            background: `hsl(${Math.round((prob / 100) * 120)}, 72%, 45%)`,
                            transition: 'width 200ms',
                          }} />
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: C.inkFaint }}>—</span>
                    )}
                  </td>

                  {/* Time Window */}
                  <td style={{ padding: '14px 42px 14px 0', verticalAlign: 'middle', textAlign: 'left' }}>
                    <span style={{ ...MONO, fontSize: 12, color: C.inkMuted, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {start} → {end}
                    </span>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '14px 42px 14px 0', verticalAlign: 'middle', textAlign: 'left' }}>
                    <StatusPill status={row.status} />
                  </td>

                  {/* Next Step */}
                  <td style={{ padding: '14px 42px 14px 0', verticalAlign: 'middle', textAlign: 'left' }}>
                    <span style={{ fontSize: 13, color: C.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {nextStep}
                    </span>
                  </td>

                  {/* Proj. Code */}
                  <td style={{ padding: '14px 0 14px 0', verticalAlign: 'middle', textAlign: 'left' }}>
                    {(row as any).projectCodeProceed ? (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#16A34A' }}>Yes</span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#DC2626' }}>No</span>
                    )}
                  </td>

                  {/* Comments */}
                  <td style={{ padding: '14px 0 14px 0', verticalAlign: 'middle', textAlign: 'left' }}>
                    {row._count.comments > 0 ? (
                      <span style={{ ...MONO, fontSize: 11.5, color: C.inkMuted, fontVariantNumeric: 'tabular-nums' }}>
                        {row._count.comments}
                      </span>
                    ) : (
                      <span style={{ color: C.inkFaint, fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ─── Column filter popover ─── */}
      {openFilter && colFilterOptions[openFilter] && (
        <FilterPopover
          options={colFilterOptions[openFilter]}
          selected={columnFilters[openFilter] ?? []}
          onToggle={v => toggleFilter(openFilter, v)}
          onClear={() => clearFilter(openFilter)}
          onClose={() => setOpenFilter(null)}
          pos={popoverPos}
        />
      )}

      {/* ─── Footer ─── */}
      <div style={{
        padding: '12px 0',
        borderTop: `1px solid ${C.rule}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
        background: '#F4F6FB',
      }}>
        <span style={{ ...MONO, fontSize: 10.5, letterSpacing: '0.12em', color: C.inkFaint }}>
          {visible.length} of {rows.length}&nbsp;&nbsp; SHOWN · CONFIDENTIAL · NEXA · {roleLabel.toUpperCase()}
        </span>
        <span style={{ ...MONO, fontSize: 10.5, letterSpacing: '0.12em', color: C.inkFaint }}>
          {active !== 'ALL' && `FILTERED BY ${active}`}
        </span>
      </div>
    </div>
  )
}
