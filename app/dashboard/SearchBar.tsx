'use client'
// SearchBar — dashboard search box. Writes the query into the URL (?q=) so the list
// re-filters and the view stays shareable/bookmarkable. Pure client control.
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

const C = {
  rule:     '#D6DCE8',
  bgSoft:   '#EAEEF6',
  inkMuted: '#7B7C7F',
}

export function SearchBar() {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  const [value, setValue] = useState(() => searchParams.get('q') ?? '')
  const mounted = useRef(false)

  // Debounce: push to URL 350 ms after the user stops typing.
  // Skip the push on the very first render (already in sync with URL).
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search)
      if (value.trim()) {
        params.set('q', value.trim())
      } else {
        params.delete('q')
      }
      // Preserve the status tab that may already be set
      router.push(`${pathname}?${params.toString()}`)
    }, 350)
    return () => clearTimeout(timer)
  }, [value, pathname, router])

  function clear() {
    setValue('')
    const params = new URLSearchParams(window.location.search)
    params.delete('q')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 13px', borderRadius: 4,
      background: '#FFFFFF', border: `1px solid ${C.rule}`,
      color: C.inkMuted, width: 320,
      fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13,
    }}>
      {/* Search icon */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
        strokeLinecap="round" strokeLinejoin="round"
        style={{ width: 16, height: 16, flexShrink: 0, color: C.inkMuted }}>
        <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
      </svg>

      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Search Opportunities"
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          color: '#001E96',
          minWidth: 0,
        }}
      />

      {/* Clear button or ⌘K hint */}
      {value ? (
        <button
          onClick={clear}
          style={{
            flexShrink: 0, border: 'none', background: 'none', padding: 0,
            cursor: 'pointer', color: C.inkMuted, fontSize: 16, lineHeight: 1,
            display: 'grid', placeItems: 'center',
          }}
          aria-label="Clear search"
        >
          ×
        </button>
      ) : (
        <span style={{
          fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
          fontSize: 10, padding: '2px 6px', borderRadius: 3,
          background: C.bgSoft, color: C.inkMuted, letterSpacing: '0.02em', flexShrink: 0,
        }}>⌘K</span>
      )}
    </div>
  )
}
