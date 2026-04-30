'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  {
    href: '/dashboard',
    label: 'BD Tracker',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    ),
  },
  {
    href: '/clients',
    label: 'Clients',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
  },
  {
    href: '/opportunities/new',
    label: 'New Deal',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
]

// Mock session — replace with real Kinde session when auth is wired up
const MOCK_SESSION = {
  name:  'Demo User',
  email: 'demo@procdna.com',
  role:  'SEL',
  since: '29 Apr 2026, 09:41',
}

export function Sidebar() {
  const pathname = usePathname()
  const [sessionOpen, setSessionOpen] = useState(false)

  return (
    <aside className="relative flex flex-col w-60 min-h-screen bg-slate-950 text-slate-400">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-slate-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
          <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-white tracking-wide">ProcDNA</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Analytics</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="px-2 mb-2 text-[10px] uppercase tracking-widest text-slate-600 font-semibold">
          Main menu
        </p>
        {nav.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {icon}
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Session popover — floats above the button */}
      {sessionOpen && (
        <>
          {/* Click-away backdrop */}
          <div
            className="fixed inset-0 z-20"
            onClick={() => setSessionOpen(false)}
          />
          <div className="absolute bottom-20 left-3 right-3 z-30 rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl shadow-black/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-sm font-bold text-white">
                {MOCK_SESSION.name.split(' ').map(w => w[0]).join('')}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{MOCK_SESSION.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{MOCK_SESSION.email}</p>
              </div>
            </div>

            <div className="space-y-1 border-t border-slate-800 pt-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Role</span>
                <span className="font-semibold text-indigo-400">{MOCK_SESSION.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Session since</span>
                <span className="text-slate-300">{MOCK_SESSION.since}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Auth</span>
                <span className="text-amber-400">! Kinde not wired</span>
              </div>
            </div>

            <button
              onClick={() => setSessionOpen(false)}
              className="mt-3 w-full rounded-lg border border-slate-700 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </>
      )}

      {/* Login / Session button — bottom left */}
      <div className="border-t border-slate-800 px-3 py-3">
        <button
          onClick={() => setSessionOpen(v => !v)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-slate-800"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white">
            {MOCK_SESSION.name.split(' ').map(w => w[0]).join('')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-300">{MOCK_SESSION.name}</p>
            <p className="text-[10px] text-slate-500">{MOCK_SESSION.role} · View session</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-3.5 h-3.5 text-slate-600 transition-transform ${sessionOpen ? 'rotate-180' : ''}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
      </div>
    </aside>
  )
}
