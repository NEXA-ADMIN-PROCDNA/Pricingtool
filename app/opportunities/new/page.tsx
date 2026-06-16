// app/opportunities/new/page.tsx — the "New Opportunity" route (server component).
// Loads the client list for the dropdown (getClientsForSelect) and renders the client
// <NewOpportunityForm> inside the app shell. force-dynamic so the client list is fresh.
import Link from 'next/link'
import { MainLayout } from '@/components/layout/MainLayout'
import { getClientsForSelect } from '@/lib/db/clients'
import { NewOpportunityForm } from './NewOpportunityForm'

export const dynamic = 'force-dynamic'

const C = {
  bg:         '#F4F6FB',
  rule:       '#D6DCE8',
  ruleSoft:   '#E2E6EE',
  ink:        '#001E96',
  inkMuted:   '#7B7C7F',
  inkFaint:   '#A5A7AA',
  accent:     '#005CD9',
}

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
}

export default async function NewOpportunityPage() {
  const clients = await getClientsForSelect()

  return (
    <MainLayout noPadding scrollable>
      {/* Editorial header */}
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
            ...MONO,
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
            NEXA · New Opportunity
          </div>
          <h1 style={{
            fontSize: 22,
            fontWeight: 500,
            color: C.ink,
            letterSpacing: '-0.005em',
            lineHeight: 1.15,
            margin: 0,
          }}>Create Opportunity</h1>
          <p style={{ ...MONO, fontSize: 11, color: C.inkFaint, letterSpacing: '0.04em', marginTop: 2 }}>
            BD ID auto-assigned on save · Primary BU derived from final pricing
          </p>
        </div>

        <Link
          href="/dashboard"
          style={{
            ...MONO,
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: C.inkMuted,
            border: `1px solid ${C.rule}`,
            padding: '8px 14px',
            background: '#ffffff',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          ← Back to Pipeline
        </Link>
      </header>

      {/* Body */}
      <div style={{ padding: '32px 44px 48px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <NewOpportunityForm clients={clients} />
        </div>
      </div>
    </MainLayout>
  )
}
