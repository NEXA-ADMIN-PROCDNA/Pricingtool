'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

// V8 NEXA Blue palette tokens
const C = {
  ink:       '#0A1F44',
  accent:    '#1E5BB8',
  accentDeep:'#143E80',
  iconMuted: '#7B86A4',
  iconActive: '#F4F6FB',
  avatarBg:  '#1A2A4D',
  rule:      'rgba(255,255,255,0.08)',
  popoverBg: '#0D2550',
}

const NAV = [
  {
    href: '/dashboard',
    label: 'Pipeline',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    href: '/clients',
    label: 'Clients',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
        <path d="M4 21h16M6 21V5a1 1 0 011-1h7a1 1 0 011 1v16M15 21V11a1 1 0 011-1h3a1 1 0 011 1v10M9 7h2M9 11h2M9 15h2"/>
      </svg>
    ),
  },
  {
    href: '/opportunities/new',
    label: 'New Deal',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    ),
  },
  {
    href: '/approvals',
    label: 'Approvals',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
        <circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>
      </svg>
    ),
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [sessionOpen, setSessionOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const { data: session } = useSession()

  useEffect(() => {
    fetch('/api/approvals?pending=true')
      .then(r => r.json())
      .then((data: unknown[]) => setPendingCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {})
  }, [])

  const user = session?.user as { name?: string; email?: string; role?: string } | undefined
  const name     = user?.name  ?? '…'
  const email    = user?.email ?? ''
  const role     = user?.role  ?? ''
  const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  const isOpen = expanded || pinned

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => { setExpanded(false); if (!pinned) setSessionOpen(false) }}
      style={{ background: C.ink }}
      className={`relative flex flex-col min-h-screen transition-all duration-200 ease-in-out z-10 shrink-0 ${
        isOpen ? 'w-56' : 'w-16'
      }`}
    >
      {/* Logo / N monogram */}
      <div
        className="flex items-center gap-3 px-[14px] py-[18px] overflow-hidden"
        style={{ borderBottom: `1px solid ${C.rule}` }}
      >
        {/* N monogram box */}
        <div
          className="flex shrink-0 h-9 w-9 items-center justify-center rounded"
          style={{ border: '1px solid rgba(255,255,255,0.14)' }}
        >
          <span style={{
            fontFamily: "var(--font-instrument-serif), 'Fraunces', Georgia, serif",
            fontSize: 22,
            color: '#F4F6FB',
            letterSpacing: '0.02em',
            lineHeight: 1,
          }}>N</span>
        </div>

        {/* Expanded: Nexa wordmark */}
        <div className={`transition-all duration-150 overflow-hidden whitespace-nowrap ${isOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1 }}>
            <span style={{
              fontFamily: "var(--font-playfair), 'Georgia', serif",
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: '0.18em',
              color: '#F4F6FB',
              lineHeight: 1,
              textTransform: 'uppercase',
            }}>
              NEXA
            </span>
            <span style={{
              display: 'inline-block', width: 5, height: 5,
              background: C.accent, transform: 'rotate(45deg)',
              marginTop: -1, flexShrink: 0,
            }} />
          </div>
          <div style={{
            fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
            fontSize: 9,
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
            color: '#6B7591',
            fontWeight: 500,
            marginTop: 4,
          }}>BD & Pricing</div>
        </div>

        {/* Pin button */}
        <button
          onClick={() => setPinned(p => !p)}
          className={`ml-auto shrink-0 rounded p-0.5 transition-all duration-150 ${
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{ color: pinned ? C.accent : '#6B7591' }}
          title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
        >
          <svg viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          const showBadge = href === '/approvals' && pendingCount > 0
          return (
            <Link
              key={href}
              href={href}
              title={!isOpen ? label : undefined}
              className="relative flex items-center gap-3 rounded px-[10px] py-2.5 text-sm transition-colors overflow-hidden"
              style={{
                color: active ? C.iconActive : C.iconMuted,
                borderLeft: active ? `2px solid ${C.accent}` : '2px solid transparent',
                marginLeft: active ? '-2px' : '0',
                paddingLeft: active ? '8px' : '10px',
              }}
            >
              <span className="shrink-0">{icon}</span>
              <span className={`whitespace-nowrap transition-all duration-150 flex-1 text-[13px] font-medium tracking-wide ${isOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                {label}
              </span>
              {showBadge && (
                <span
                  className={`rounded-full text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center transition-all duration-150 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                  style={{ background: C.accent, color: '#FFFFFF' }}
                >
                  {pendingCount}
                </span>
              )}
              {showBadge && !isOpen && (
                <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full" style={{ background: C.accent }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Session popover */}
      {sessionOpen && isOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setSessionOpen(false)} />
          <div
            className="absolute bottom-16 left-2 right-2 z-30 rounded-xl p-4 shadow-lg"
            style={{ background: C.popoverBg, border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: C.avatarBg, color: '#F4F6FB', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#F4F6FB' }}>{name}</p>
                <p className="text-xs truncate" style={{ color: '#6B7591' }}>{email}</p>
              </div>
            </div>
            <div
              className="flex items-center justify-between py-2 text-xs"
              style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span style={{ color: '#6B7591' }}>Role</span>
              <span className="font-medium" style={{ color: '#7DA6E3' }}>{role}</span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium transition-colors hover:bg-white/5"
              style={{ border: '1px solid rgba(255,255,255,0.12)', color: '#9AA3B8' }}
            >
              Sign out
            </button>
          </div>
        </>
      )}

      {/* User button */}
      <div style={{ borderTop: `1px solid ${C.rule}` }} className="px-2 py-2">
        <button
          onClick={() => isOpen && setSessionOpen(v => !v)}
          title={!isOpen ? name : undefined}
          className="flex w-full items-center gap-3 rounded px-[10px] py-2 text-left transition-colors overflow-hidden hover:bg-white/5"
        >
          <div
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
            style={{ background: C.avatarBg, color: '#F4F6FB', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {initials}
          </div>
          <div className={`min-w-0 flex-1 transition-all duration-150 ${isOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
            <p className="truncate text-xs font-semibold whitespace-nowrap" style={{ color: '#F4F6FB' }}>{name}</p>
            <p className="text-[10px] whitespace-nowrap" style={{ color: '#6B7591' }}>{role}</p>
          </div>
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            className={`w-3 h-3 shrink-0 transition-all duration-150 ${isOpen ? 'opacity-100' : 'opacity-0'} ${sessionOpen ? 'rotate-180' : ''}`}
            style={{ color: '#6B7591' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
      </div>
    </aside>
  )
}
