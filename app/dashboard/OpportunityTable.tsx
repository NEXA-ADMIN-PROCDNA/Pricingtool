'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { OpportunityRow } from '@/lib/db/opportunities'
import { OpportunityStatus } from '@prisma/client'
import { STAGE_NEXT_STEPS } from '@/lib/stageNextSteps'

// V8 palette
const C = {
  ink:       '#0A1F44',
  inkSoft:   '#3A4A6A',
  inkMuted:  '#6B7591',
  inkFaint:  '#9AA3B8',
  accent:    '#1E5BB8',
  accentDeep:'#143E80',
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
    WON:       { bg: '#E1F1E9', fg: '#1F6B3C', dot: '#1E9E5B' },
    LOST:      { bg: '#FBE9E7', fg: '#8A2A1F', dot: '#C6432F' },
    ABANDONED: { bg: '#EEF0F4', fg: '#5A6478', dot: '#9AA3B8' },
    ARCHIVED:  { bg: '#EEF0F4', fg: '#5A6478', dot: '#9AA3B8' },
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

// Tiny initials avatar
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

export function OpportunityTable({ rows }: { rows: OpportunityRow[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const active = (params.get('status') ?? 'ALL') as 'ALL' | OpportunityStatus

  function setFilter(value: string) {
    router.push(value === 'ALL' ? '/dashboard' : `/dashboard?status=${value}`)
  }

  const visible = active === 'ALL' ? rows : rows.filter(r => r.status === active)

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* ─── Filter row ─── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '20px 0 14px', flexShrink: 0,
      }}>
        {/* Tab filters */}
        <div style={{ display: 'flex', gap: 28, alignItems: 'baseline' }}>
          {STATUS_FILTERS.map(f => {
            const count = f.value === 'ALL' ? rows.length : rows.filter(r => r.status === f.value).length
            const isActive = active === f.value
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
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
                <span style={{
                  ...MONO,
                  fontSize: 10.5,
                  color: isActive ? C.accent : C.inkFaint,
                }}>
                  {String(count).padStart(2, '0')}
                </span>
              </button>
            )
          })}
        </div>

        {/* Right: filter dropdowns + export */}
        <div style={{
          display: 'flex', gap: 18, alignItems: 'baseline',
          fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12.5, color: C.inkMuted,
        }}>
          {['Owner', 'Practice', 'Period'].map(label => (
            <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'default' }}>
              {label}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </span>
          ))}
          <span style={{ color: C.accent, borderBottom: `1px dotted ${C.accent}`, cursor: 'pointer', paddingBottom: 1 }}>
            Export
          </span>
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="flex-1 overflow-auto min-h-0">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Inter', system-ui, sans-serif" }}>
          <thead>
            <tr style={{ borderBottom: `1.5px solid ${C.ink}` }}>
              {[
                { label: '№',          w: 56  },
                { label: 'Client',     w: 140 },
                { label: 'Engagement', w: 220 },
                { label: 'Partner',    w: 160 },
                { label: 'Revenue',    w: 110, right: true },
                { label: 'Win %',      w: 72,  right: true },
                { label: 'Window',     w: 180 },
                { label: 'Status',     w: 100 },
                { label: 'Next step',  w: undefined },
              ].map(col => (
                <th
                  key={col.label}
                  style={{
                    padding: '12px 12px 12px 0',
                    textAlign: col.right ? 'right' : 'left',
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: 11, fontWeight: 600,
                    letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: C.inkMuted,
                    width: col.w,
                    whiteSpace: 'nowrap',
                  }}
                >{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: '64px 0', textAlign: 'center', color: C.inkMuted, fontSize: 14 }}>
                  No opportunities found.
                </td>
              </tr>
            )}
            {visible.map(row => {
              const revStr = fmtRevenue(row)
              const isFinal = hasFinalPricing(row)
              const prob = row.probability != null ? Math.round(Number(row.probability) * 100) : null
              const start = fmtDate(row.startDate)
              const end   = fmtDate(row.endDate)
              const nextStep = STAGE_NEXT_STEPS[row.stage] ?? '—'

              return (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/opportunities/${row.opportunityId}`)}
                  style={{
                    borderBottom: `1px solid ${C.ruleSoft}`,
                    cursor: 'pointer',
                    transition: 'background 120ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.accentSoft + '55')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* № */}
                  <td style={{ padding: '14px 12px 14px 0', verticalAlign: 'middle' }}>
                    <Link
                      href={`/opportunities/${row.opportunityId}`}
                      onClick={e => e.stopPropagation()}
                      style={{ ...MONO, fontSize: 11.5, color: C.inkMuted, letterSpacing: '0.02em', textDecoration: 'none' }}
                    >
                      {row.opportunityId.replace('BD-', '')}
                    </Link>
                  </td>

                  {/* Client */}
                  <td style={{ padding: '14px 12px 14px 0', verticalAlign: 'middle', fontWeight: 500, color: C.ink, fontSize: 14, whiteSpace: 'nowrap' }}>
                    {row.client.name}
                  </td>

                  {/* Engagement */}
                  <td style={{ padding: '14px 12px 14px 0', verticalAlign: 'middle', maxWidth: 220, color: C.inkSoft, fontSize: 14 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.opportunityName}
                    </div>
                  </td>

                  {/* Partner */}
                  <td style={{ padding: '14px 12px 14px 0', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.inkSoft, fontSize: 14 }}>
                      <Avatar initials={ownerInitials(row.owner.name)} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.owner.name}
                      </span>
                    </div>
                  </td>

                  {/* Revenue */}
                  <td style={{ padding: '14px 12px 14px 0', verticalAlign: 'middle', textAlign: 'right' }}>
                    <span style={{
                      ...SERIF,
                      fontSize: 19,
                      fontWeight: 400,
                      letterSpacing: '-0.01em',
                      fontVariantNumeric: 'tabular-nums',
                      color: revStr === '—' ? C.inkFaint : isFinal ? '#1F6B3C' : C.ink,
                    }}>{revStr}</span>
                    {isFinal && revStr !== '—' && (
                      <span style={{
                        ...MONO,
                        display: 'block',
                        fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#1F6B3C', textAlign: 'right',
                      }}>FINAL</span>
                    )}
                  </td>

                  {/* Win % */}
                  <td style={{ padding: '14px 12px 14px 0', verticalAlign: 'middle', textAlign: 'right' }}>
                    {prob !== null ? (
                      <span style={{ ...MONO, fontSize: 12.5, color: C.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
                        {prob}%
                      </span>
                    ) : (
                      <span style={{ color: C.inkFaint }}>—</span>
                    )}
                  </td>

                  {/* Window */}
                  <td style={{ padding: '14px 12px 14px 0', verticalAlign: 'middle' }}>
                    <span style={{ ...MONO, fontSize: 12, color: C.inkMuted, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {start} → {end}
                    </span>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '14px 12px 14px 0', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    <StatusPill status={row.status} />
                  </td>

                  {/* Next step */}
                  <td style={{ padding: '14px 0 14px 0', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ fontSize: 13, color: C.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {nextStep}
                      </span>
                      {row._count.comments > 0 && (
                        <span style={{ ...MONO, fontSize: 11, color: C.inkFaint, flexShrink: 0 }}>
                          {row._count.comments} ↩
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ─── Footer ─── */}
      <div style={{
        padding: '12px 0',
        borderTop: `1px solid ${C.rule}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
        background: '#F4F6FB',
      }}>
        <span style={{ ...MONO, fontSize: 10.5, letterSpacing: '0.12em', color: C.inkFaint }}>
          {visible.length} OF {rows.length} SHOWN · CONFIDENTIAL · NEXA · PARTNERS&apos; VIEW
        </span>
        <span style={{ ...MONO, fontSize: 10.5, letterSpacing: '0.12em', color: C.inkFaint }}>
          {active !== 'ALL' && `FILTERED BY ${active}`}
        </span>
      </div>
    </div>
  )
}
