'use client'
import { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import type { ClientRow } from '@/lib/db/clients'

const C = {
  bg:         '#F4F6FB',
  bgSoft:     '#EAEEF6',
  rule:       '#D6DCE8',
  ruleSoft:   '#E2E6EE',
  ink:        '#001E96',
  inkSoft:    '#3A4A6A',
  inkMuted:   '#7B7C7F',
  inkFaint:   '#A5A7AA',
  accent:     '#005CD9',
  accentDeep: '#001E96',
  accentSoft: '#DCE7F5',
}

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
}
const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-instrument-serif), 'Fraunces', Georgia, serif",
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function ClientCard({ client }: { client: ClientRow }) {
  return (
    <Link
      href={`/clients/${client.clientId}`}
      style={{
        background: '#ffffff',
        border: `1px solid ${C.inkMuted}`,
        borderTop: `3px solid ${C.ink}`,
        boxShadow: `0 1px 0 ${C.rule}, 4px 4px 0 -1px ${C.bgSoft}`,
        textDecoration: 'none',
        display: 'block',
        transition: 'border-color 120ms, background 120ms, box-shadow 120ms, transform 120ms',
      }}
      className="hover:border-[#005CD9] hover:bg-[#FAFBFE] hover:[border-top-color:#005CD9] hover:-translate-y-0.5"
    >
      <div style={{
        padding: '12px 16px 10px',
        borderBottom: `1px solid ${C.rule}`,
        background: C.bgSoft,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <span style={{ ...MONO, fontSize: 10.5, color: C.inkMuted, letterSpacing: '0.08em' }}>
          {client.clientId}
        </span>
        {client.industry && (
          <span style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 9.5,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: C.inkMuted,
            fontWeight: 500,
            padding: '2px 8px',
            border: `1px solid ${C.rule}`,
            whiteSpace: 'nowrap',
          }}>{client.industry}</span>
        )}
      </div>

      <div style={{ padding: '16px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, flexShrink: 0,
            background: C.accentSoft, color: C.accentDeep,
            display: 'grid', placeItems: 'center',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 12, fontWeight: 700, letterSpacing: '-0.01em',
          }}>{initials(client.name)}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              ...SERIF, fontSize: 19, fontWeight: 400, letterSpacing: '-0.01em',
              color: C.ink, lineHeight: 1.15,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{client.name}</div>
          </div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          borderTop: `1px solid ${C.ruleSoft}`, borderBottom: `1px solid ${C.ruleSoft}`,
          marginBottom: 14,
        }}>
          <div style={{ padding: '10px 0', borderRight: `1px solid ${C.ruleSoft}` }}>
            <div style={{ ...SERIF, fontSize: 24, color: C.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {client._count.opportunities}
            </div>
            <div style={{
              fontFamily: "'Inter', system-ui, sans-serif", fontSize: 9.5,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              color: C.inkMuted, marginTop: 4, fontWeight: 500,
            }}>Deals</div>
          </div>
          <div style={{ padding: '10px 0 10px 14px' }}>
            <div style={{ ...SERIF, fontSize: 24, color: C.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {client.pocs.length}
            </div>
            <div style={{
              fontFamily: "'Inter', system-ui, sans-serif", fontSize: 9.5,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              color: C.inkMuted, marginTop: 4, fontWeight: 500,
            }}>Contacts</div>
          </div>
        </div>

        {client.pocs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {client.pocs.slice(0, 2).map(poc => (
              <div key={poc.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 12, color: C.inkSoft,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 999,
                  background: C.bgSoft, color: C.inkMuted,
                  display: 'grid', placeItems: 'center',
                  fontSize: 8.5, fontWeight: 700, flexShrink: 0,
                }}>{initials(poc.name)}</div>
                <span style={{
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
                }}>
                  {poc.name}
                  {poc.jobTitle && (
                    <span style={{ color: C.inkFaint, fontWeight: 400 }}> · {poc.jobTitle}</span>
                  )}
                </span>
              </div>
            ))}
            {client.pocs.length > 2 && (
              <div style={{
                ...MONO, fontSize: 10, color: C.inkFaint, paddingLeft: 26,
                letterSpacing: '0.06em',
              }}>+{client.pocs.length - 2} MORE</div>
            )}
          </div>
        ) : (
          <div style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 12, color: C.inkFaint, fontStyle: 'italic',
          }}>No POC contacts on file.</div>
        )}

        {(client.region || client.businessUnit) && (
          <div style={{
            marginTop: 14, paddingTop: 12,
            borderTop: `1px solid ${C.ruleSoft}`,
            display: 'flex', gap: 16, flexWrap: 'wrap',
            ...MONO,
            fontSize: 10, color: C.inkFaint,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            {client.region && <span>{client.region}</span>}
            {client.businessUnit && <span>· {client.businessUnit}</span>}
          </div>
        )}
      </div>
    </Link>
  )
}

export function ClientsBrowser({ clients }: { clients: ClientRow[] }) {
  const [query, setQuery]     = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef              = useRef<HTMLInputElement>(null)

  // Live filter — matches against name, ID, industry, region, business unit
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.clientId.toLowerCase().includes(q) ||
      (c.industry?.toLowerCase().includes(q) ?? false) ||
      (c.region?.toLowerCase().includes(q) ?? false) ||
      (c.businessUnit?.toLowerCase().includes(q) ?? false)
    )
  }, [clients, query])

  // Top matches shown as autocomplete dropdown — capped so it stays scannable
  const dropdownItems = useMemo(() => {
    if (!query.trim() || !focused) return []
    return filtered.slice(0, 6)
  }, [filtered, query, focused])

  return (
    <>
      {/* ── Search bar (combobox: input + autocomplete dropdown) ── */}
      <div style={{ position: 'relative', marginTop: 24 }}>
        <div style={{ position: 'relative' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={C.inkMuted} strokeWidth={1.75}
               strokeLinecap="round" strokeLinejoin="round"
               style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 140)} // give the dropdown click time to register
            placeholder="Search Clients"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '11px 38px 11px 38px',
              border: `1px solid ${focused ? C.accent : C.rule}`,
              borderRadius: 2,
              fontSize: 13.5, color: C.ink,
              outline: 'none',
              background: '#fff',
              fontFamily: 'inherit',
              transition: 'border-color 120ms',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              aria-label="Clear search"
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                width: 22, height: 22, display: 'grid', placeItems: 'center',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: C.inkMuted,
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ width: 12, height: 12 }}>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {dropdownItems.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
            background: '#fff',
            border: `1px solid ${C.rule}`,
            borderRadius: 2,
            boxShadow: '0 6px 24px rgba(0,30,150,0.10)',
            maxHeight: 320, overflowY: 'auto',
          }}>
            <div style={{
              padding: '8px 14px',
              borderBottom: `1px solid ${C.ruleSoft}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: C.bgSoft,
            }}>
              <span style={{
                ...MONO, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase',
                color: C.inkMuted, fontWeight: 500,
              }}>Top Matches</span>
              <span style={{ ...MONO, fontSize: 10, color: C.inkFaint, letterSpacing: '0.08em' }}>
                {String(filtered.length).padStart(2, '0')} of {String(clients.length).padStart(2, '0')}
              </span>
            </div>
            {dropdownItems.map((c, i) => (
              <Link
                key={c.id}
                href={`/clients/${c.clientId}`}
                onMouseDown={e => e.preventDefault()} // keep input focused until click resolves
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px',
                  textDecoration: 'none',
                  borderBottom: i === dropdownItems.length - 1 ? 'none' : `1px solid ${C.ruleSoft}`,
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: 13, color: C.ink,
                  background: '#fff',
                }}
                className="hover:bg-[#F4F6FB]"
              >
                <span style={{
                  width: 30, height: 30, flexShrink: 0,
                  background: C.accentSoft, color: C.accentDeep,
                  display: 'grid', placeItems: 'center',
                  fontSize: 10, fontWeight: 700, letterSpacing: '-0.01em',
                }}>{initials(c.name)}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontWeight: 500, color: C.ink,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{c.name}</div>
                  <div style={{
                    ...MONO, fontSize: 10, color: C.inkMuted,
                    letterSpacing: '0.06em', marginTop: 2,
                  }}>
                    {c.clientId}
                    {c.industry && ` · ${c.industry.toUpperCase()}`}
                    {c.region && ` · ${c.region.toUpperCase()}`}
                  </div>
                </div>
                <span style={{ ...MONO, fontSize: 11, color: C.inkFaint, letterSpacing: '0.06em' }}>
                  →
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Section heading */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        padding: '20px 0 12px',
        borderBottom: `1.5px solid ${C.ink}`,
        marginTop: 18, marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h2 style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: C.ink, fontWeight: 600, margin: 0,
          }}>{query.trim() ? 'Matches' : 'All Clients'}</h2>
          <span style={{ ...MONO, fontSize: 10.5, color: C.inkFaint, letterSpacing: '0.08em' }}>
            {query.trim()
              ? `${String(filtered.length).padStart(2, '0')} of ${String(clients.length).padStart(2, '0')}`
              : `${String(clients.length).padStart(2, '0')} TOTAL`}
          </span>
        </div>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(client => <ClientCard key={client.id} client={client} />)}
        </div>
      ) : (
        <div style={{
          padding: '80px 0', textAlign: 'center',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 14, color: C.inkMuted,
        }}>
          {query.trim()
            ? <>No clients match <strong style={{ color: C.ink }}>“{query.trim()}”</strong>.</>
            : 'No clients yet. Submit a request using the button above.'}
        </div>
      )}
    </>
  )
}
