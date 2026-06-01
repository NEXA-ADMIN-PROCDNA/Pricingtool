'use client'
import { useState } from 'react'
import { toast } from 'sonner'

const C = {
  rule:     '#D6DCE8',
  bg:       '#F4F6FB',
  inkMuted: '#7B7C7F',
}

export function ExportButton() {
  const [state, setState]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [webUrl, setWebUrl] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function handleSync() {
    setState('loading')
    setErrMsg(null)
    try {
      const res  = await fetch('/api/export/opportunities', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.detail ?? data.error ?? 'Sync to OneDrive failed'
        setErrMsg(msg)
        toast.error(msg)
        setState('error')
        return
      }
      setWebUrl(data.webUrl ?? null)
      setState('done')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error'
      setErrMsg(msg)
      toast.error(msg)
      setState('error')
    }
  }

  // Download button — always visible, opens GET endpoint directly
  const DownloadBtn = () => (
    <a
      href="/api/export/opportunities"
      download="opportunities.xlsx"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '10px 14px', borderRadius: 4,
        border: `1px solid ${C.rule}`, background: C.bg, color: C.inkMuted,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 13, fontWeight: 500,
        textDecoration: 'none', whiteSpace: 'nowrap',
      }}
      title="Download latest copy to your PC"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
      Download
    </a>
  )

  if (state === 'done' && webUrl) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <DownloadBtn />
        <a
          href={webUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 16px', borderRadius: 4,
            border: '1px solid #86EFAC', background: '#F0FDF4', color: '#16A34A',
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
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <DownloadBtn />
          <button
            onClick={handleSync}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 4,
              border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} style={{ width: 15, height: 15 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Failed — retry sync
          </button>
        </div>
        {errMsg && (
          <span style={{
            maxWidth: 380, fontSize: 11, color: '#B91C1C', lineHeight: 1.5,
            fontFamily: "'Inter', system-ui, sans-serif", textAlign: 'right',
          }}>
            {errMsg}
          </span>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <DownloadBtn />
      <button
        onClick={handleSync}
        disabled={state === 'loading'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', borderRadius: 4,
          border: `1px solid ${C.rule}`, background: C.bg, color: C.inkMuted,
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
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            Sync to OneDrive
          </>
        )}
      </button>
    </div>
  )
}
