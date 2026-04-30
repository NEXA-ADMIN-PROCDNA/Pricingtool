'use client'
import { useState, useRef, useEffect } from 'react'

export type SelectOption = { value: string; label: string; sub?: string }

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  emptyMessage = 'No results found.',
}: {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyMessage?: string
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const inputRef  = useRef<HTMLInputElement>(null)
  const wrapRef   = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value) ?? null

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function openDropdown() {
    setOpen(true)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function select(opt: SelectOption) {
    onChange(opt.value)
    setOpen(false)
    setQuery('')
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={wrapRef} className="relative">
      {/* Trigger button */}
      {!open ? (
        <button
          type="button"
          onClick={openDropdown}
          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-sm hover:border-indigo-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition text-left"
        >
          {selected ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-700">
                {selected.label.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </div>
              <div className="min-w-0">
                <span className="block truncate font-medium text-slate-800">{selected.label}</span>
                {selected.sub && <span className="block text-[10px] text-slate-400">{selected.sub}</span>}
              </div>
            </div>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {selected && (
              <span
                role="button"
                onClick={clear}
                className="flex h-4 w-4 items-center justify-center rounded-full text-slate-300 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            )}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-slate-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </button>
      ) : (
        /* Search input shown when open */
        <div className="flex items-center rounded-xl border border-indigo-400 bg-white px-3.5 py-2.5 shadow-sm ring-2 ring-indigo-100">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-slate-400 mr-2 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type to search…"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
            onKeyDown={e => {
              if (e.key === 'Escape') { setOpen(false); setQuery('') }
              if (e.key === 'Enter' && filtered.length === 1) select(filtered[0])
            }}
          />
        </div>
      )}

      {/* Dropdown list */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400 italic">{emptyMessage}</div>
          ) : (
            filtered.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => select(opt)}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-indigo-50 transition-colors ${
                  opt.value === value ? 'bg-indigo-50' : ''
                }`}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                  {opt.label.split(' ').map(w => w[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{opt.label}</p>
                  {opt.sub && <p className="text-[10px] text-slate-400">{opt.sub}</p>}
                </div>
                {opt.value === value && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="ml-auto w-4 h-4 text-indigo-600 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
