'use client'
// MultiSelect — reusable multi-pick dropdown built on SearchableSelect's option shape.
// Used for things like the approval CC list. Self-contained (search + checkboxes + chips).
import { useState, useRef, useEffect } from 'react'
import type { SelectOption } from './SearchableSelect'

export function MultiSelect({
  options,
  values,
  onChange,
  placeholder = 'Search and select…',
  emptyMessage = 'No results found.',
}: {
  options: SelectOption[]
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  emptyMessage?: string
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)

  const selected = options.filter(o => values.includes(o.value))

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

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

  function toggle(opt: SelectOption) {
    if (values.includes(opt.value)) {
      onChange(values.filter(v => v !== opt.value))
    } else {
      onChange([...values, opt.value])
    }
  }

  function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    onChange(values.filter(v => v !== id))
  }

  function openDropdown() {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const initials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('')

  return (
    <div ref={wrapRef} className="relative">
      {/* Trigger */}
      <div
        onClick={openDropdown}
        className={`min-h-[42px] flex flex-wrap items-center gap-1.5 rounded-xl border bg-white px-3 py-2 cursor-pointer shadow-sm transition ${
          open ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-300'
        }`}
      >
        {selected.map(opt => (
          <span
            key={opt.value}
            className="flex items-center gap-1 rounded-full bg-indigo-100 pl-2 pr-1 py-0.5 text-xs font-semibold text-indigo-700"
          >
            {opt.label}
            <button
              type="button"
              onClick={e => remove(opt.value, e)}
              className="flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-indigo-200 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-2.5 h-2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}

        {open ? (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={selected.length === 0 ? placeholder : 'Add more…'}
            className="flex-1 min-w-[120px] bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
            onKeyDown={e => {
              if (e.key === 'Escape') { setOpen(false); setQuery('') }
              if (e.key === 'Backspace' && !query && selected.length > 0) {
                onChange(values.slice(0, -1))
              }
            }}
          />
        ) : (
          selected.length === 0 && (
            <span className="text-sm text-slate-400 flex-1">{placeholder}</span>
          )
        )}

        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-slate-400 shrink-0 ml-auto">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400 italic">{emptyMessage}</div>
          ) : (
            filtered.map(opt => {
              const isSelected = values.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${
                    isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {initials(opt.label)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{opt.label}</p>
                    {opt.sub && <p className="text-[10px] text-slate-400">{opt.sub}</p>}
                  </div>
                  {isSelected && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-indigo-600 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
