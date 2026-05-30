import Link from 'next/link'
import { getClients, type ClientRow } from '@/lib/db/clients'

export const dynamic = 'force-dynamic'
import { Sidebar } from '@/components/layout/Sidebar'
import { AddClientModal } from './AddClientModal'
import { AdminRequestsPanel } from './AdminRequestsPanel'

// V8 palette — matches dashboard
const C = {
  bg:         '#F4F6FB',
  bgSoft:     '#EAEEF6',
  rule:       '#D6DCE8',
  ruleSoft:   '#E2E6EE',
  ink:        '#0A1F44',
  inkSoft:    '#3A4A6A',
  inkMuted:   '#6B7591',
  inkFaint:   '#9AA3B8',
  accent:     '#1E5BB8',
  accentDeep: '#143E80',
  accentSoft: '#DCE7F5',
}

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
}

const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-instrument-serif), 'Fraunces', Georgia, serif",
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function KPIStrip({ clients }: { clients: ClientRow[] }) {
  const totalOpps = clients.reduce((s, c) => s + c._count.opportunities, 0)
  const totalPocs = clients.reduce((s, c) => s + c.pocs.length, 0)
  const avgOpps   = clients.length > 0 ? (totalOpps / clients.length).toFixed(1) : '0'

  const items = [
    { label: 'Total Clients',       value: String(clients.length), sub: 'in master registry' },
    { label: 'Total Opportunities', value: String(totalOpps),      sub: 'across all clients'  },
    { label: 'POC Contacts',        value: String(totalPocs),      sub: `${avgOpps} avg. deals/client` },
  ]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      borderTop: `1px solid ${C.rule}`,
      borderBottom: `1px solid ${C.rule}`,
      padding: '24px 0',
    }}>
      {items.map((it, i) => (
        <div key={i} style={{
          padding: '0 36px',
          borderRight: i < 2 ? `1px solid ${C.rule}` : 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <div style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: C.inkMuted,
            fontWeight: 500,
          }}>{it.label}</div>

          <div style={{
            ...SERIF,
            fontSize: 44,
            fontWeight: 400,
            letterSpacing: '-0.02em',
            color: C.ink,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>{it.value}</div>

          <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, color: C.inkMuted }}>
            {it.sub}
          </div>
        </div>
      ))}
    </div>
  )
}

function ClientCard({ client }: { client: ClientRow }) {
  return (
    <Link
      href={`/clients/${client.clientId}`}
      style={{
        background: '#ffffff',
        border: `1px solid ${C.rule}`,
        textDecoration: 'none',
        display: 'block',
        transition: 'border-color 120ms, background 120ms',
      }}
      className="hover:border-[#1E5BB8] hover:bg-[#FAFBFE]"
    >
      {/* Card header — ID + Industry */}
      <div style={{
        padding: '12px 16px 10px',
        borderBottom: `1px solid ${C.ruleSoft}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <span style={{
          ...MONO,
          fontSize: 10.5,
          color: C.inkMuted,
          letterSpacing: '0.08em',
        }}>{client.clientId}</span>
        {client.industry && (
          <span style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 9.5,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: C.inkMuted,
            fontWeight: 500,
            padding: '2px 8px',
            border: `1px solid ${C.rule}`,
            whiteSpace: 'nowrap',
          }}>{client.industry}</span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '16px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, flexShrink: 0,
            background: C.accentSoft, color: C.accentDeep,
            display: 'grid', placeItems: 'center',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 12, fontWeight: 700, letterSpacing: '-0.01em',
          }}>
            {initials(client.name)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              ...SERIF,
              fontSize: 19,
              fontWeight: 400,
              letterSpacing: '-0.01em',
              color: C.ink,
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>{client.name}</div>
          </div>
        </div>

        {/* Metric row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          borderTop: `1px solid ${C.ruleSoft}`,
          borderBottom: `1px solid ${C.ruleSoft}`,
          marginBottom: 14,
        }}>
          <div style={{ padding: '10px 0', borderRight: `1px solid ${C.ruleSoft}` }}>
            <div style={{
              ...SERIF, fontSize: 24, color: C.ink, lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}>{client._count.opportunities}</div>
            <div style={{
              fontFamily: "'Inter', system-ui, sans-serif", fontSize: 9.5,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              color: C.inkMuted, marginTop: 4, fontWeight: 500,
            }}>Deals</div>
          </div>
          <div style={{ padding: '10px 0 10px 14px' }}>
            <div style={{
              ...SERIF, fontSize: 24, color: C.ink, lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}>{client.pocs.length}</div>
            <div style={{
              fontFamily: "'Inter', system-ui, sans-serif", fontSize: 9.5,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              color: C.inkMuted, marginTop: 4, fontWeight: 500,
            }}>Contacts</div>
          </div>
        </div>

        {/* POC list */}
        {client.pocs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {client.pocs.slice(0, 2).map(poc => (
              <div key={poc.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 12, color: C.inkSoft,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 999,
                  background: C.bgSoft, color: C.inkMuted,
                  display: 'grid', placeItems: 'center',
                  fontSize: 8.5, fontWeight: 700, flexShrink: 0,
                }}>{initials(poc.name)}</div>
                <span style={{
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
                }}>
                  {poc.name}
                  {poc.jobTitle && (
                    <span style={{ color: C.inkFaint, fontWeight: 400 }}> · {poc.jobTitle}</span>
                  )}
                </span>
              </div>
            ))}
            {client.pocs.length > 2 && (
              <div style={{
                ...MONO, fontSize: 10, color: C.inkFaint, paddingLeft: 26,
                letterSpacing: '0.06em',
              }}>+{client.pocs.length - 2} MORE</div>
            )}
          </div>
        ) : (
          <div style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 12, color: C.inkFaint, fontStyle: 'italic',
          }}>No POC contacts on file.</div>
        )}

        {/* Footer metadata */}
        {(client.region || client.businessUnit) && (
          <div style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: `1px solid ${C.ruleSoft}`,
            display: 'flex', gap: 16, flexWrap: 'wrap',
            ...MONO,
            fontSize: 10,
            color: C.inkFaint,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            {client.region && <span>{client.region}</span>}
            {client.businessUnit && <span>· {client.businessUnit}</span>}
          </div>
        )}
      </div>
    </Link>
  )
}

export default async function ClientsPage() {
  const clients = await getClients()

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: C.bg }}>
      <Sidebar />

      {/* Right panel */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* Sticky editorial header */}
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
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 10.5,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: C.inkMuted,
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{
                width: 5, height: 5, background: C.accent,
                display: 'inline-block', transform: 'rotate(45deg)',
              }} />
              NEXA · Client Registry
            </div>
            <h1 style={{
              ...SERIF,
              fontSize: 30,
              fontWeight: 400,
              letterSpacing: '-0.01em',
              color: C.ink,
              lineHeight: 1.1,
              margin: 0,
            }}>Client Master</h1>
          </div>
          <AddClientModal />
        </header>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: '0 44px 32px' }}>

          {/* Admin pending requests */}
          <AdminRequestsPanel />

          {/* KPI strip */}
          <KPIStrip clients={clients} />

          {/* Section heading — matches dashboard editorial style */}
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            padding: '20px 0 12px',
            borderBottom: `1.5px solid ${C.ink}`,
            marginBottom: 18,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <h2 style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: C.ink,
                fontWeight: 600,
                margin: 0,
              }}>All Clients</h2>
              <span style={{
                ...MONO, fontSize: 10.5, color: C.inkFaint, letterSpacing: '0.08em',
              }}>{String(clients.length).padStart(2, '0')} TOTAL</span>
            </div>
          </div>

          {/* Client cards grid */}
          {clients.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {clients.map(client => (
                <ClientCard key={client.id} client={client} />
              ))}
            </div>
          ) : (
            <div style={{
              padding: '80px 0',
              textAlign: 'center',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 14, color: C.inkMuted,
            }}>
              No clients yet. Submit a request using the button above.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
