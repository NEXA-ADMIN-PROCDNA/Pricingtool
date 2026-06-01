import { getClients, type ClientRow } from '@/lib/db/clients'

export const dynamic = 'force-dynamic'
import { Sidebar } from '@/components/layout/Sidebar'
import { AddClientModal } from './AddClientModal'
import { AdminRequestsPanel } from './AdminRequestsPanel'
import { ClientsBrowser } from './ClientsBrowser'

// V8 palette — matches dashboard
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
}

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
}

const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-instrument-serif), 'Fraunces', Georgia, serif",
}

function KPIStrip({ clients }: { clients: ClientRow[] }) {
  const totalOpps = clients.reduce((s, c) => s + c._count.opportunities, 0)

  const items = [
    { label: 'Total Clients',       value: String(clients.length) },
    { label: 'Total Opportunities', value: String(totalOpps) },
  ]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      borderTop: `1px solid ${C.rule}`,
      borderBottom: `1px solid ${C.rule}`,
      padding: '24px 0',
    }}>
      {items.map((it, i) => (
        <div key={i} style={{
          padding: '0 36px',
          borderRight: i < 1 ? `1px solid ${C.rule}` : 'none',
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
        </div>
      ))}
    </div>
  )
}

// ClientCard moved to ClientsBrowser.tsx since it's only consumed there now.

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

          {/* Search bar + autocomplete dropdown + filtered grid */}
          <ClientsBrowser clients={clients} />
        </div>
      </div>
    </div>
  )
}
