'use client'
import { useState, useRef } from 'react'
import { MainLayout } from '@/components/layout/MainLayout'
import { toast } from 'sonner'

const C = {
  pageBg:      '#0D1B35',
  cardBg:      '#132544',
  cardBgAlt:   '#0F1E3A',
  border:      'rgba(255,255,255,0.08)',
  ink:         '#E8EDF5',
  inkMuted:    '#8FA8C8',
  inkFaint:    '#4E6A8A',
  accent:      '#3B82F6',
  success:     '#22C55E',
  successBg:   'rgba(34,197,94,0.08)',
  warn:        '#F59E0B',
  warnBg:      'rgba(245,158,11,0.08)',
  danger:      '#F87171',
  dangerBg:    'rgba(248,113,113,0.08)',
  rule:        'rgba(255,255,255,0.06)',
}

type ParsedRow = {
  jobRole: string
  location: string
  domain: string | null
  billRatePerHour: number
  costRatePerHour: number
}

type State = 'idle' | 'parsing' | 'preview' | 'importing' | 'done' | 'error'

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 99,
      background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
      color: '#93C5FD', fontSize: 11, fontWeight: 600,
      letterSpacing: '0.06em', textTransform: 'uppercase' as const,
    }}>{children}</span>
  )
}

export default function RateCardUploadPage() {
  const [state, setState]           = useState<State>('idle')
  const [rows, setRows]             = useState<ParsedRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [importedCount, setImportedCount] = useState(0)
  const [updatedCount, setUpdatedCount]   = useState(0)
  const [errorMsg, setErrorMsg]     = useState('')
  const [dropHover, setDropHover]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await parseFile(file)
  }

  async function parseFile(file: File) {
    setState('parsing')
    setParseErrors([])
    setRows([])
    setErrorMsg('')
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/rate-cards/upload', { method: 'POST', body: fd })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      const msg = err.error ?? 'Upload failed'
      setState('error')
      setErrorMsg(msg)
      toast.error(msg)
      return
    }
    const data = await res.json()
    setRows(data.rows ?? [])
    setParseErrors(data.errors ?? [])
    setState('preview')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDropHover(false)
    const file = e.dataTransfer.files?.[0]
    if (file) parseFile(file)
  }

  async function handleConfirm() {
    setState('importing')
    const res = await fetch('/api/rate-cards/upload/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      const msg = err.error ?? 'Import failed'
      setState('error')
      setErrorMsg(msg)
      toast.error(msg)
      return
    }
    const data = await res.json()
    setImportedCount(data.created ?? 0)
    setUpdatedCount(data.updated ?? 0)
    setState('done')
  }

  function reset() {
    setState('idle')
    setRows([])
    setParseErrors([])
    setErrorMsg('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const grouped = rows.reduce<Record<string, ParsedRow[]>>((acc, row) => {
    const key = row.domain ?? 'Uncategorised'
    if (!acc[key]) acc[key] = []
    acc[key].push(row)
    return acc
  }, {})

  const indiaCount = rows.filter(r => r.location === 'INDIA').length
  const usCount    = rows.filter(r => r.location === 'US').length

  return (
    <MainLayout noPadding scrollable>
      <div style={{ minHeight: '100%', background: C.pageBg }}>

        {/* ── Top bar ── */}
        <div style={{
          background: 'rgba(13,27,53,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${C.border}`,
          padding: '18px 40px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <Chip>Admin</Chip>
          <Chip>Rate Cards</Chip>
          <div style={{ width: 1, height: 16, background: C.border, marginLeft: 4 }} />
          <span style={{
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
            fontSize: 18,
            color: C.ink,
            fontWeight: 400,
            letterSpacing: '-0.01em',
          }}>
            Periodic Rate Card Upload
          </span>
        </div>

        <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 40px 80px' }}>

          {/* ── Description ── */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontSize: 32, fontWeight: 400, color: C.ink,
              margin: '0 0 8px', letterSpacing: '-0.01em',
            }}>
              Upload Rate Card
            </h1>
            <p style={{ color: C.inkMuted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
              Replace or update active rates from the periodic Excel sheet.
              Existing entries that match on position + location + domain will have their rates updated.
              New entries will be created.
            </p>
          </div>

          {/* ── Requirements ── */}
          <div style={{
            background: C.cardBg, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '20px 24px', marginBottom: 16,
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 48px',
          }}>
            {[
              { label: 'File format',  value: '.xlsx or .xls' },
              { label: 'Sheet name',   value: 'Must contain "Rate Card"' },
              { label: 'Header row',   value: 'Auto-detected (any row)' },
              { label: 'Columns',      value: 'A: Location · B: Position · C: BU · E: Billing · F: Cost' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', gap: 10 }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%', background: C.accent,
                  marginTop: 7, flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.10em', color: C.inkFaint }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 13, color: C.inkMuted, marginTop: 2 }}>{value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Note ── */}
          <div style={{
            background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)',
            borderRadius: 10, padding: '13px 18px', marginBottom: 28,
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ color: '#60A5FA', fontSize: 14, flexShrink: 0, marginTop: 1 }}>ⓘ</span>
            <p style={{ fontSize: 13, color: '#93C5FD', margin: 0, lineHeight: 1.6 }}>
              The worksheet within the uploaded Excel must have the string{' '}
              <strong style={{ color: '#BFDBFE' }}>"Rate Card"</strong> in its name.
              You can change this naming convention to whatever suits your finance or admin team —
              just ensure the sheet name always contains those two words.
            </p>
          </div>

          {/* ── Upload zone ── */}
          {(state === 'idle' || state === 'parsing') && (
            <label
              onMouseEnter={() => setDropHover(true)}
              onMouseLeave={() => setDropHover(false)}
              onDragOver={e => { e.preventDefault(); setDropHover(true) }}
              onDragLeave={() => setDropHover(false)}
              onDrop={handleDrop}
              style={{
                display: 'flex', flexDirection: 'column' as const,
                alignItems: 'center', justifyContent: 'center',
                gap: 16, padding: '56px 40px',
                background: dropHover
                  ? 'rgba(59,130,246,0.10)'
                  : state === 'parsing' ? C.cardBgAlt : C.cardBg,
                border: `2px dashed ${dropHover || state === 'parsing' ? C.accent : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 14,
                cursor: state === 'parsing' ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: dropHover ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.08)',
                border: `1px solid ${dropHover ? 'rgba(59,130,246,0.5)' : 'rgba(59,130,246,0.15)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, transition: 'background 0.15s, border-color 0.15s',
              }}>
                {state === 'parsing' ? '⏳' : '📂'}
              </div>

              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.ink }}>
                  {state === 'parsing' ? 'Parsing file…' : 'Click to upload or drag & drop'}
                </p>
                <p style={{ margin: '5px 0 0', fontSize: 13, color: C.inkMuted }}>
                  {state === 'parsing' ? 'Reading rate card sheet…' : '.xlsx or .xls · Max 20 MB'}
                </p>
              </div>

              {state === 'idle' && (
                <div style={{
                  padding: '9px 24px',
                  background: dropHover ? C.accent : 'rgba(59,130,246,0.15)',
                  border: `1px solid ${dropHover ? C.accent : 'rgba(59,130,246,0.3)'}`,
                  borderRadius: 8, color: dropHover ? '#fff' : '#93C5FD',
                  fontSize: 13, fontWeight: 600,
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                }}>
                  Choose File
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                disabled={state === 'parsing'}
                onChange={handleFileChange}
              />
            </label>
          )}

          {/* ── Error ── */}
          {state === 'error' && (
            <div style={{
              background: C.dangerBg, border: `1px solid rgba(248,113,113,0.2)`,
              borderRadius: 12, padding: '22px 24px',
            }}>
              <p style={{ color: C.danger, fontWeight: 700, fontSize: 14, margin: '0 0 6px' }}>Upload failed</p>
              <p style={{ color: C.danger, fontSize: 13, opacity: 0.8, margin: '0 0 18px' }}>{errorMsg}</p>
              <button onClick={reset} style={{
                padding: '9px 22px', background: C.accent, color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>Try Again</button>
            </div>
          )}

          {/* ── Done ── */}
          {state === 'done' && (
            <div style={{
              background: C.successBg, border: `1px solid rgba(34,197,94,0.2)`,
              borderRadius: 14, padding: '44px 40px', textAlign: 'center',
            }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, margin: '0 auto 18px', color: C.success,
              }}>✓</div>
              <p style={{ fontWeight: 700, fontSize: 20, color: C.success, margin: '0 0 8px' }}>
                Import complete
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 14 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{updatedCount}</div>
                  <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 3 }}>rates updated</div>
                </div>
                <div style={{ width: 1, background: C.border }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{importedCount}</div>
                  <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 3 }}>new rows added</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Preview ── */}
          {(state === 'preview' || state === 'importing') && (
            <div>
              {/* Action bar */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: C.cardBg, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: '16px 22px', marginBottom: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 22, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>
                      {rows.length}
                    </span>
                    <span style={{ color: C.inkMuted, fontSize: 13, marginLeft: 6 }}>rows ready</span>
                  </div>
                  <div style={{ width: 1, height: 24, background: C.border }} />
                  <span style={{ fontSize: 12, color: C.inkMuted }}>
                    <span style={{ fontWeight: 600, color: '#FB923C' }}>{indiaCount}</span> India
                  </span>
                  <span style={{ fontSize: 12, color: C.inkMuted }}>
                    <span style={{ fontWeight: 600, color: '#60A5FA' }}>{usCount}</span> US
                  </span>
                  {parseErrors.length > 0 && (
                    <>
                      <div style={{ width: 1, height: 24, background: C.border }} />
                      <span style={{ fontSize: 12, color: C.warn }}>⚠ {parseErrors.length} skipped</span>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={reset}
                    disabled={state === 'importing'}
                    style={{
                      padding: '9px 20px', background: 'transparent',
                      border: `1px solid ${C.border}`, borderRadius: 8,
                      color: C.inkMuted, cursor: 'pointer', fontSize: 13,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={state === 'importing' || rows.length === 0}
                    style={{
                      padding: '9px 22px',
                      background: state === 'importing' ? C.inkFaint : C.accent,
                      color: '#fff', border: 'none', borderRadius: 8,
                      cursor: state === 'importing' ? 'not-allowed' : 'pointer',
                      fontSize: 13, fontWeight: 700,
                    }}
                  >
                    {state === 'importing' ? 'Importing…' : `Import ${rows.length} Rows`}
                  </button>
                </div>
              </div>

              {/* Skipped rows */}
              {parseErrors.length > 0 && (
                <div style={{
                  background: C.warnBg, border: `1px solid rgba(245,158,11,0.2)`,
                  borderRadius: 10, padding: '14px 18px', marginBottom: 20,
                }}>
                  <p style={{ fontWeight: 700, color: C.warn, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 8px' }}>
                    Skipped rows
                  </p>
                  {parseErrors.map((e, i) => (
                    <p key={i} style={{ fontSize: 12, color: C.warn, opacity: 0.85, margin: '3px 0' }}>· {e}</p>
                  ))}
                </div>
              )}

              {/* Tables by domain */}
              {Object.entries(grouped).map(([domain, domainRows]) => (
                <div key={domain} style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: C.inkFaint }}>
                      {domain}
                    </span>
                    <span style={{
                      fontSize: 11, color: C.inkFaint,
                      background: C.cardBgAlt, border: `1px solid ${C.border}`,
                      borderRadius: 99, padding: '1px 8px',
                    }}>
                      {domainRows.length} roles
                    </span>
                    <div style={{ flex: 1, height: 1, background: C.rule }} />
                  </div>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', background: C.cardBg }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: C.cardBgAlt }}>
                          {['Position', 'Location', 'Billing / hr', 'Cost / hr'].map((h, hi) => (
                            <th key={h} style={{
                              padding: '10px 16px',
                              textAlign: hi >= 2 ? 'right' as const : 'left' as const,
                              color: C.inkFaint, fontWeight: 600, fontSize: 10,
                              letterSpacing: '0.10em', textTransform: 'uppercase' as const,
                              borderBottom: `1px solid ${C.border}`,
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {domainRows.map((row, i) => (
                          <tr key={i} style={{ borderBottom: i < domainRows.length - 1 ? `1px solid ${C.rule}` : undefined }}>
                            <td style={{ padding: '9px 16px', color: C.ink, fontWeight: 500 }}>{row.jobRole}</td>
                            <td style={{ padding: '9px 16px' }}>
                              <span style={{
                                display: 'inline-block', padding: '2px 9px', borderRadius: 99,
                                fontSize: 11, fontWeight: 600,
                                background: row.location === 'INDIA' ? 'rgba(251,146,60,0.1)' : 'rgba(59,130,246,0.1)',
                                color: row.location === 'INDIA' ? '#FB923C' : '#60A5FA',
                                border: `1px solid ${row.location === 'INDIA' ? 'rgba(251,146,60,0.2)' : 'rgba(59,130,246,0.2)'}`,
                              }}>
                                {row.location}
                              </span>
                            </td>
                            <td style={{ padding: '9px 16px', textAlign: 'right', color: C.ink, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                              ${row.billRatePerHour.toFixed(0)}
                            </td>
                            <td style={{ padding: '9px 16px', textAlign: 'right', color: C.inkMuted, fontVariantNumeric: 'tabular-nums' }}>
                              ${row.costRatePerHour.toFixed(0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </MainLayout>
  )
}
