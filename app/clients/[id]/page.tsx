import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getClientDetail } from '@/lib/db/clients'
import { Sidebar } from '@/components/layout/Sidebar'

export const dynamic = 'force-dynamic'

// ProcDNA editorial palette — matches dashboard / clients / approvals
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
  won:        '#36A463',
  wonSoft:    '#E1F1E9',
  wonDeep:    '#1F6B3C',
  rejected:   '#D6454A',
  rejectedSoft: '#FBE9E7',
  rejectedDeep: '#8A2A1F',
}

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
}
const SANS: React.CSSProperties = {
  fontFamily: "var(--font-geist-sans), 'Inter', system-ui, sans-serif",
}
const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-instrument-serif), 'Fraunces', Georgia, serif",
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function fmtRevenue(billings: number | null | undefined, estimated: number | null | undefined) {
  const n = billings ?? estimated ?? 0
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; dot: string }> = {
  OPEN:      { bg: C.accentSoft,    fg: C.accentDeep,    dot: C.accent     },
  WON:       { bg: C.wonSoft,       fg: C.wonDeep,       dot: C.won        },
  LOST:      { bg: C.rejectedSoft,  fg: C.rejectedDeep,  dot: C.rejected   },
  ABANDONED: { bg: '#EEF0F4',       fg: C.inkMuted,      dot: C.inkFaint   },
  ARCHIVED:  { bg: '#EEF0F4',       fg: C.inkMuted,      dot: C.inkFaint   },
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const client = await getClientDetail(id)
  if (!client) notFound()

  const open    = client.opportunities.filter(o => o.status === 'OPEN').length
  const won     = client.opportunities.filter(o => o.status === 'WON').length
  const totalRev = client.opportunities.reduce((sum, o) => {
    const n = o.pricingVersions[0]?.proposedBillings ?? o.estimatedRevenue ?? 0
    return sum + Number(n)
  }, 0)

  function fmtTotal(n: number) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
    return n ? `$${n}` : '—'
  }

  const kpis = [
    { label: 'Total Deals',   value: String(client.opportunities.length) },
    { label: 'Open',          value: String(open) },
    { label: 'Won',           value: String(won) },
    { label: 'Pipeline Rev.', value: fmtTotal(totalRev) },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg }}>
      <Sidebar />

      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0 }}>

        {/* ── Header ── */}
        <header style={{
          flexShrink: 0, background: '#fff',
          borderBottom: `1px solid ${C.rule}`, padding: '20px 44px 22px',
        }}>
          {/* Breadcrumb */}
          <div style={{
            ...MONO, fontSize: 11, letterSpacing: '0.1em',
            color: C.inkMuted, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
          }}>
            <Link href="/clients" style={{ color: C.inkMuted, textDecoration: 'none' }}>Client Master</Link>
            <span style={{ color: C.inkFaint }}>/</span>
            <span style={{ color: C.accent }}>{client.clientId}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {/* Avatar — solid brand mark */}
            <div style={{
              width: 56, height: 56, borderRadius: 12, flexShrink: 0,
              background: C.ink, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...SANS, fontSize: 18, fontWeight: 600, letterSpacing: '0.02em',
            }}>
              {initials(client.name)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h1 style={{ ...SERIF, fontSize: 30, fontWeight: 400, color: C.ink, letterSpacing: '-0.01em', margin: 0, lineHeight: 1.1 }}>
                  {client.name}
                </h1>
                <span style={{
                  ...MONO, fontSize: 11, color: C.accentDeep,
                  background: C.accentSoft, padding: '3px 9px', borderRadius: 4, letterSpacing: '0.04em',
                }}>{client.clientId}</span>
                {client.industry && (
                  <span style={{
                    ...MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: C.inkSoft, background: C.bgSoft, border: `1px solid ${C.rule}`,
                    padding: '4px 9px', borderRadius: 999,
                  }}>{client.industry}</span>
                )}
              </div>
              <div style={{ ...SANS, fontSize: 13, color: C.inkMuted, marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {client.region && <span>{client.region}</span>}
                {client.region && client.businessUnit && <span style={{ color: C.inkFaint }}>·</span>}
                {client.businessUnit && <span>{client.businessUnit}</span>}
              </div>
            </div>
          </div>
        </header>

        {/* ── Body ── */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 44px 36px' }}>

          {/* KPI strip */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            borderBottom: `1px solid ${C.rule}`, padding: '24px 0',
          }}>
            {kpis.map((it, i) => (
              <div key={it.label} style={{
                padding: '0 32px',
                borderRight: i < 3 ? `1px solid ${C.rule}` : 'none',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{
                  ...SANS, fontSize: 11, letterSpacing: '0.16em',
                  textTransform: 'uppercase', color: C.inkMuted, fontWeight: 500,
                }}>{it.label}</div>
                <div style={{
                  ...SANS, fontSize: 34, fontWeight: 500, color: C.ink,
                  lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                }}>{it.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginTop: 28 }}>

            {/* ── Opportunities ── */}
            <div style={{ background: '#fff', border: `1px solid ${C.rule}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                padding: '16px 22px', borderBottom: `1px solid ${C.ruleSoft}`,
              }}>
                <h2 style={{ ...SANS, fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>Opportunities</h2>
                <span style={{ ...MONO, fontSize: 11, color: C.inkFaint }}>{String(client.opportunities.length).padStart(2, '0')} total</span>
              </div>

              {client.opportunities.length === 0 ? (
                <div style={{ ...SANS, padding: '64px 0', textAlign: 'center', color: C.inkFaint, fontSize: 13 }}>
                  No opportunities yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.ruleSoft}` }}>
                        {['BD ID', 'Name', 'Owner', 'Revenue', 'Status'].map(h => (
                          <th key={h} style={{
                            ...MONO, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase',
                            color: C.inkMuted, fontWeight: 600, textAlign: 'left',
                            padding: '11px 18px', whiteSpace: 'nowrap',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {client.opportunities.map(opp => {
                        const ss = STATUS_STYLE[opp.status] ?? STATUS_STYLE.OPEN
                        const rev = fmtRevenue(
                          opp.pricingVersions[0]?.proposedBillings != null
                            ? Number(opp.pricingVersions[0].proposedBillings)
                            : null,
                          opp.estimatedRevenue != null ? Number(opp.estimatedRevenue) : null,
                        )
                        return (
                          <tr key={opp.id} style={{ borderBottom: `1px solid ${C.ruleSoft}` }}>
                            <td style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>
                              <Link href={`/opportunities/${opp.opportunityId}`} style={{ ...MONO, fontSize: 11.5, color: C.accent, textDecoration: 'none' }}>
                                {opp.opportunityId}
                              </Link>
                            </td>
                            <td style={{ padding: '12px 18px', maxWidth: 220 }}>
                              <Link href={`/opportunities/${opp.opportunityId}`} style={{
                                ...SANS, color: C.ink, fontWeight: 500, textDecoration: 'none',
                                display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {opp.opportunityName}
                              </Link>
                            </td>
                            <td style={{ ...SANS, padding: '12px 18px', color: C.inkSoft, whiteSpace: 'nowrap' }}>{opp.owner.name}</td>
                            <td style={{ ...MONO, padding: '12px 18px', color: C.inkSoft, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{rev}</td>
                            <td style={{ padding: '12px 18px' }}>
                              <span style={{
                                ...SANS, display: 'inline-flex', alignItems: 'center', gap: 6,
                                fontSize: 11, fontWeight: 600, padding: '2px 9px 2px 8px',
                                borderRadius: 999, background: ss.bg, color: ss.fg, whiteSpace: 'nowrap',
                              }}>
                                <span style={{ width: 5, height: 5, borderRadius: 999, background: ss.dot, flexShrink: 0 }} />
                                {opp.status.charAt(0) + opp.status.slice(1).toLowerCase()}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Contacts ── */}
            <div style={{ background: '#fff', border: `1px solid ${C.rule}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                padding: '16px 22px', borderBottom: `1px solid ${C.ruleSoft}`,
              }}>
                <h2 style={{ ...SANS, fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>Contacts</h2>
                <span style={{ ...MONO, fontSize: 11, color: C.inkFaint }}>
                  {String(client.pocs.length).padStart(2, '0')} POC{client.pocs.length !== 1 ? 's' : ''}
                </span>
              </div>

              {client.pocs.length === 0 ? (
                <div style={{ ...SANS, padding: '64px 0', textAlign: 'center', color: C.inkFaint, fontSize: 13 }}>
                  No contacts on file.
                </div>
              ) : (
                <div>
                  {client.pocs.map((poc, i) => (
                    <div key={poc.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '14px 22px',
                      borderTop: i === 0 ? 'none' : `1px solid ${C.ruleSoft}`,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                        background: C.bgSoft, border: `1px solid ${C.rule}`, color: C.inkSoft,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        ...MONO, fontSize: 11, fontWeight: 600,
                      }}>
                        {initials(poc.name)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ ...SANS, fontSize: 13, fontWeight: 600, color: C.ink, margin: 0 }}>{poc.name}</p>
                        {poc.jobTitle && (
                          <p style={{ ...SANS, fontSize: 11.5, color: C.inkMuted, margin: '2px 0 0' }}>{poc.jobTitle}</p>
                        )}
                        {poc.email && (
                          <a href={`mailto:${poc.email}`} style={{
                            ...SANS, fontSize: 11.5, color: C.accent, textDecoration: 'none',
                            display: 'block', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{poc.email}</a>
                        )}
                        {poc.phone && (
                          <p style={{ ...MONO, fontSize: 11, color: C.inkMuted, margin: '3px 0 0' }}>{poc.phone}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
