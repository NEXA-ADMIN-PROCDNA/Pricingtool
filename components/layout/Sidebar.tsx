'use client'
import { useState, useEffect, useRef } from 'react'

const PIN_KEY = 'nexa.sidebar.pinned'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

const C = {
  ink:       '#111111',
  accent:    '#005CD9',
  accentDeep:'#333333',
  iconMuted: '#888888',
  iconActive: '#F4F6FB',
  avatarBg:  '#222222',
  rule:      'rgba(255,255,255,0.08)',
  popoverBg: '#1a1a1a',
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

  // Restore the pinned-state from localStorage on mount, then keep it in sync
  // on every change. The ref guards against clobbering the saved value with the
  // initial `false` on first render (before the load read has run).
  const pinHydrated = useRef(false)
  useEffect(() => {
    if (!pinHydrated.current) {
      pinHydrated.current = true
      try {
        if (localStorage.getItem(PIN_KEY) === '1') setPinned(true)
      } catch {}
      return
    }
    try { localStorage.setItem(PIN_KEY, pinned ? '1' : '0') } catch {}
  }, [pinned])

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
          <span style={{
            fontFamily: "'Playfair Display', 'Georgia', serif",
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: '0.18em',
            color: '#F4F6FB',
            lineHeight: 1,
            textTransform: 'uppercase',
          }}>
            NEXA
          </span>
        </div>

        {/* Pin button — thumbtack icon */}
        <button
          onClick={() => setPinned(p => !p)}
          className={`ml-auto shrink-0 grid place-items-center rounded h-7 w-7 transition-all duration-150 hover:bg-white/10 ${
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{
            color: pinned ? C.accent : '#A5A7AA',
            background: pinned ? 'rgba(30,91,184,0.14)' : 'transparent',
          }}
          aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          title={pinned ? 'Pinned — click to unpin' : 'Click to keep sidebar open'}
        >
          {/* Thumbtack/pushpin — rotates 45° when pinned (pressed into the wall) */}
          <svg
            viewBox="0 0 24 24"
            fill={pinned ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 transition-transform duration-150"
            style={{ transform: pinned ? 'rotate(45deg)' : 'rotate(0deg)' }}
          >
            {/* Head */}
            <path d="M9 4h6v4l3 3v3H6v-3l3-3V4z" />
            {/* Needle */}
            <path d="M12 14v6" />
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

        {/* Admin-only: Rate Cards */}
        {role === 'ADMIN' && (() => {
          const href = '/admin/rate-cards'
          const active = pathname.startsWith(href)
          return (
            <Link
              href={href}
              title={!isOpen ? 'Rate Cards' : undefined}
              className="relative flex items-center gap-3 rounded px-[10px] py-2.5 text-sm transition-colors overflow-hidden"
              style={{
                color: active ? C.iconActive : C.iconMuted,
                borderLeft: active ? `2px solid ${C.accent}` : '2px solid transparent',
                marginLeft: active ? '-2px' : '0',
                paddingLeft: active ? '8px' : '10px',
              }}
            >
              <span className="shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
                  <path d="M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z"/>
                </svg>
              </span>
              <span className={`whitespace-nowrap transition-all duration-150 flex-1 text-[13px] font-medium tracking-wide ${isOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                Rate Cards
              </span>
            </Link>
          )
        })()}
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
                <p className="text-xs truncate" style={{ color: '#7B7C7F' }}>{email}</p>
              </div>
            </div>
            <div
              className="flex items-center justify-between py-2 text-xs"
              style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span style={{ color: '#7B7C7F' }}>Role</span>
              <span className="font-medium" style={{ color: '#7DA6E3' }}>{role}</span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold transition-colors hover:bg-red-500/15"
              style={{ border: '1px solid rgba(239,68,68,0.55)', color: '#F87171' }}
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
            <p className="text-[10px] whitespace-nowrap" style={{ color: '#7B7C7F' }}>{role}</p>
          </div>
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            className={`w-3 h-3 shrink-0 transition-all duration-150 ${isOpen ? 'opacity-100' : 'opacity-0'} ${sessionOpen ? 'rotate-180' : ''}`}
            style={{ color: '#7B7C7F' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
      </div>
    </aside>
  )
}
