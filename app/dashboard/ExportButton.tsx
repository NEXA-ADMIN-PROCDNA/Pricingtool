'use client'
import { useState } from 'react'

const C = {
  rule:     '#D6DCE8',
  bg:       '#F4F6FB',
  inkMuted: '#6B7591',
}

export function ExportButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [webUrl, setWebUrl] = useState<string | null>(null)

  async function handleExport() {
    setState('loading')
    try {
      const res = await fetch('/api/export/opportunities', { method: 'POST' })
      if (!res.ok) { setState('error'); return }
      const data = await res.json()
      setWebUrl(data.webUrl ?? null)
      setState('done')
    } catch {
      setState('error')
    }
  }

  if (state === 'done' && webUrl) {
    return (
      <a
        href={webUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', borderRadius: 4,
          border: '1px solid #86EFAC',
          background: '#F0FDF4', color: '#16A34A',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 13, fontWeight: 500,
          textDecoration: 'none', whiteSpace: 'nowrap',
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
          <path d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        Open in OneDrive →
      </a>
    )
  }

  return (
    <button
      onClick={handleExport}
      disabled={state === 'loading'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '10px 16px', borderRadius: 4,
        border: `1px solid ${state === 'error' ? '#FCA5A5' : C.rule}`,
        background: state === 'error' ? '#FEF2F2' : C.bg,
        color: state === 'error' ? '#DC2626' : C.inkMuted,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 13, fontWeight: 500,
        cursor: state === 'loading' ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap', opacity: state === 'loading' ? 0.6 : 1,
      }}
    >
      {state === 'loading' ? (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="animate-spin" style={{ width: 15, height: 15 }}>
            <path strokeLinecap="round" d="M12 3a9 9 0 109 9" />
          </svg>
          Syncing…
        </>
      ) : state === 'error' ? (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} style={{ width: 15, height: 15 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Failed — retry
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          Sync to OneDrive
        </>
      )}
    </button>
  )
}
