import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MainLayout } from '@/components/layout/MainLayout'
import { getOpportunities } from '@/lib/db/opportunities'
import { OpportunityTable } from './OpportunityTable'
import { SearchBar } from './SearchBar'
import { ExportButton } from './ExportButton'
import pkg from '../../package.json'

const APP_VERSION = pkg.version

// V8 palette
const C = {
  bg:       '#F4F6FB',
  bgSoft:   '#EAEEF6',
  rule:     '#D6DCE8',
  ink:      '#001E96',
  inkMuted: '#7B7C7F',
  inkFaint: '#A5A7AA',
  accent:   '#005CD9',
}

// Maps DB role enum → banner display label + restriction copy
const ROLE_BANNER: Record<string, { label: string; restriction: string }> = {
  ADMIN:    { label: 'Admin View',              restriction: 'Full platform access · All data visible' },
  PARTNER:  { label: 'Partner View',            restriction: 'All Opportunities Visible' },
  ED:       { label: 'Executive Director View', restriction: ' |' },
  DIRECTOR: { label: 'Director View',           restriction: ' |' },
  SEL:      { label: 'Senior Engagement Lead View',                restriction: ' |' },
}

// Calendar-year fiscal quarter (Jan–Mar = Q1 … Oct–Dec = Q4)
function NexaWordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Image
        src="/procdna-logo.png"
        alt="ProcDNA"
        width={51}
        height={51}
        style={{ borderRadius: 6, objectFit: 'contain', flexShrink: 0 }}
      />
      <span style={{
        fontFamily: "'Playfair Display', 'Georgia', serif",
        fontWeight: 500,
        fontSize: 20,
        letterSpacing: '0.04em',
        color: C.inkMuted,
        lineHeight: 1,
      }}>
        ProcDNA
      </span>
      <span style={{
        fontFamily: "'Playfair Display', 'Georgia', serif",
        fontWeight: 800,
        fontSize: 28,
        letterSpacing: '0.18em',
        color: C.ink,
        lineHeight: 1,
        textTransform: 'uppercase',
      }}>
        NEXA
      </span>
    </div>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { q } = await searchParams

  const session = await getServerSession(authOptions)
  const sessionUser = session?.user as { id?: string; role?: string } | undefined
  const userId  = sessionUser?.id   ?? ''
  const role    = sessionUser?.role ?? ''
  const auth    = userId && role ? { userId, role } : undefined

  // Fetch the full role-scoped set (status filtering happens client-side in the
  // table). This keeps the status-tab count badges accurate for every status —
  // server-side status filtering would zero out the non-active tabs.
  const rows = await getOpportunities('ALL', q, auth)

  const banner  = ROLE_BANNER[role] ?? { label: 'Nexa', restriction: '' }

  return (
    <MainLayout noPadding>
      {/* ─── Nexa Header ─── */}
      <header
        style={{ background: C.bg, borderBottom: `1px solid ${C.rule}`, padding: '22px 44px 18px', flexShrink: 0 }}
        className="flex items-center justify-between gap-6"
      >
        <div className="flex items-center gap-7">
          <NexaWordmark />
          <div style={{ width: 1, height: 32, background: C.rule, flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{
              fontFamily: "var(--font-instrument-serif), 'Fraunces', Georgia, serif",
              fontSize: 20,
              fontWeight: 400,
              color: C.ink,
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
              maxWidth: 340,
            }}>The nexus of every engagement</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search bar */}
          <Suspense fallback={null}>
            <SearchBar />
          </Suspense>

          {/* Bell */}
          <div style={{ color: C.inkMuted, padding: 6, position: 'relative', display: 'grid', placeItems: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
              <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 20a2 2 0 01-3.4 0"/>
            </svg>
            <div style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: 999, background: C.accent }} />
          </div>

          {/* Export — admin only */}
          {role === 'ADMIN' && <ExportButton />}

          {/* New opportunity */}
          <Link
            href="/opportunities/new"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 4,
              border: '1px solid #1A4FA0',
              background: '#005CD9', color: '#F4F6FB',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 13, fontWeight: 500,
              textDecoration: 'none', whiteSpace: 'nowrap',
              boxShadow: '0 1px 4px rgba(37,99,235,0.35)',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 0.9 }}>+</span>
            New Opportunity
          </Link>
        </div>
      </header>

      {/* ─── Role Banner ─── */}
      <div style={{
        padding: '9px 44px', background: C.ink, color: '#C4CCE0',
        fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
        fontSize: 10.5, letterSpacing: '0.02em',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #001E96', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7DA6E3',
          }}>
            <span style={{ width: 5, height: 5, background: C.accent, display: 'inline-block', transform: 'rotate(45deg)', flexShrink: 0 }} />
            {banner.label}
          </span>
          {banner.restriction && (
            <span style={{ color: '#8B95B0' }}>{banner.restriction}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#8B95B0', letterSpacing: '0.08em' }}>
          <span style={{ color: '#7DA6E3', fontWeight: 600 }}>V{APP_VERSION}</span>
          <span style={{ color: '#56607A' }}>·</span>
          <span>AUTO-REFRESH ON LOAD</span>
        </div>
      </div>

      {/* ─── Body ─── */}
      {/* KPI strip + filter tabs + table all live in OpportunityTable so the
          KPI cards stay in sync with every active filter. */}
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <Suspense fallback={<div className="flex-1 animate-pulse rounded-xl" style={{ background: C.bgSoft }} />}>
          <OpportunityTable rows={rows} roleLabel={banner.label} />
        </Suspense>
      </div>
    </MainLayout>
  )
}
