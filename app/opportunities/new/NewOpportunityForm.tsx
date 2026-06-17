'use client'
// ─────────────────────────────────────────────────────────────────────────────
// NewOpportunityForm — the create-opportunity form (client component).
// Big picture: collects client + name + dates (end date required) + optional POCs and an
// estimate, then POSTs /api/opportunities (which assigns the OPP-YY-NNNN id and owner).
// On success it routes to the new opportunity's detail page.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

type POC    = { id: string; name: string; email: string | null; phone: string | null; jobTitle: string | null }
type Client = {
  id: string; name: string; clientId: string | null
  businessUnit: string | null; industry: string | null; region: string | null
  pocs: POC[]
}

type PocRow = { name: string; email: string; phone: string; existingPocId?: string }

// ─── Editorial palette (matches dashboard / clients page) ───────────────────
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
  danger:     '#D6454A',
  dangerSoft: '#FBE9E7',
}

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
}

const PHONE_RE = /^(\+\d{1,3})?\d{10}$/

const WORK_TYPES = [
  'Infrastructure capabilities',
  'Segmentation capabilities',
  'Alignment capabilities',
  'Dynamic targeting capabilities',
  'Call planning capabilities',
  'Market research capabilities',
  'Competitive Intelligence capabilities',
  'Next Best Actions capabilities',
  'Marketing mix measurement capabilities',
  'Omnichannel capabilities',
  'Patient identification capabilities',
  'Launch excellence capabilities',
  'Sales force sizing and restructuring',
  'Forecasting capabilities',
  'HCP 360 Capabilities',
  'Conference insights capabilities',
  'MSL Empowerment capabilities',
  'Social listening capabilities',
  'CRM deployment and migration capabilities/Veeva/SFDC',
  'Data warehousing capabilities',
  'GenAI capabilities',
  'BI reporting capabilities',
  'Data procurement capabilities',
  'Data aggregation and tokenization capabilities',


  // Add here for future work types.
] as const

// ─── Atoms ───────────────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      borderTop: `1.5px solid ${C.ink}`,
      paddingTop: 10,
      marginTop: 28,
      marginBottom: 18,
    }}>
      <span style={{
        ...MONO,
        fontSize: 11,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: C.ink,
        fontWeight: 600,
      }}>{label}</span>
      {count && (
        <span style={{ ...MONO, fontSize: 10.5, color: C.inkFaint, letterSpacing: '0.08em' }}>
          {count}
        </span>
      )}
    </div>
  )
}

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <label style={{
      ...MONO,
      display: 'block',
      fontSize: 10,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: C.inkMuted,
      fontWeight: 500,
      marginBottom: 6,
    }}>
      {text}{required && <span style={{ color: C.danger, marginLeft: 4, position: 'relative', top: -2, display: 'inline-block' }}>*</span>}
    </label>
  )
}

function FieldHint({ text }: { text: string }) {
  return (
    <p style={{ ...MONO, fontSize: 10, color: C.inkFaint, marginTop: 5, letterSpacing: '0.02em' }}>
      {text}
    </p>
  )
}

function FieldError({ msg }: { msg: string | undefined }) {
  if (!msg) return null
  return (
    <p style={{ ...MONO, fontSize: 10, color: C.danger, marginTop: 5, letterSpacing: '0.02em' }}>
      {msg}
    </p>
  )
}

// ─── Input styling ───────────────────────────────────────────────────────────
// Square, thin border, accent focus. No rounded-xl, no shadow.

const inputBase: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 12px',
  border: `1px solid ${C.rule}`,
  background: '#ffffff',
  fontSize: 13.5,
  color: C.ink,
  outline: 'none',
  borderRadius: 2,
  transition: 'border-color 120ms',
  fontFamily: 'inherit',
}

const inputErr: React.CSSProperties = { ...inputBase, borderColor: C.danger }

const focusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = C.accent
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = C.rule
  },
}

// Open the native date picker when the user clicks anywhere on a date input,
// not just the small calendar icon. Guarded for browsers without showPicker
// and for the "already open" case (clicking the icon itself).
const openDatePicker = (e: React.MouseEvent<HTMLInputElement>) => {
  const el = e.currentTarget
  if (typeof el.showPicker === 'function') {
    try { el.showPicker() } catch { /* picker already open or blocked */ }
  }
}

// ─── Form ────────────────────────────────────────────────────────────────────

export function NewOpportunityForm({ clients, users }: { clients: Client[]; users: { id: string; name: string }[] }) {
  const router = useRouter()
  const { data: session } = useSession()
  const sessionUser = session?.user as { name?: string } | undefined
  const ownerName = sessionUser?.name ?? '…'

  const [isPending, startTransition] = useTransition()
  const [error, setError]             = useState<string | null>(null)
  const [clientId, setClientId]       = useState('')
  const [starConnect, setStarConnect] = useState<'yes' | 'no'>('no')
  const [workType, setWorkType]           = useState('')
  const [otherWorkType, setOtherWorkType] = useState('')
  const [coOwnerId, setCoOwnerId]         = useState('')
  const [pocRows, setPocRows]         = useState<PocRow[]>([])
  const [dateError, setDateError]     = useState<string | null>(null)
  const [pocErrors, setPocErrors]     = useState<{ phone?: string; email?: string }[]>([])

  const selectedClient = clients.find(c => c.id === clientId) ?? null

  const sortedClients = [...clients].sort((a, b) => a.name.localeCompare(b.name))

  const usedPocIds = new Set(pocRows.filter(r => r.existingPocId).map(r => r.existingPocId!))
  const availableExisting = (selectedClient?.pocs ?? [])
    .filter(p => !usedPocIds.has(p.id))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))

  function addPocFromExisting(poc: POC) {
    setPocRows(prev => [...prev, {
      name: poc.name,
      email: poc.email ?? '',
      phone: poc.phone ?? '',
      existingPocId: poc.id,
    }])
  }

  function addBlankPoc() {
    setPocRows(prev => [...prev, { name: '', email: '', phone: '' }])
  }

  function removePoc(i: number) {
    setPocRows(prev => prev.filter((_, idx) => idx !== i))
    setPocErrors(prev => prev.filter((_, idx) => idx !== i))
  }

  function updatePoc(i: number, field: 'name' | 'email' | 'phone', value: string) {
    setPocRows(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }

  function handleClientChange(id: string) {
    setClientId(id)
    setPocRows([])
    setPocErrors([])
  }

  function validatePhone(phone: string): string | undefined {
    const v = phone.trim()
    if (!v) return undefined
    return PHONE_RE.test(v) ? undefined : 'Use +XX followed by 10 digits, or just 10 digits'
  }

  function validateEmail(email: string): string | undefined {
    const v = email.trim()
    if (!v) return undefined
    return v.includes('@') ? undefined : 'Email must contain @'
  }

  function checkDates(start: string, end: string) {
    if (start && end && new Date(end) <= new Date(start)) {
      setDateError('End date must be after the start date')
      return false
    }
    setDateError(null)
    return true
  }

  function validatePocs() {
    const errors = pocRows.map(p => ({
      phone: validatePhone(p.phone),
      email: validateEmail(p.email),
    }))
    setPocErrors(errors)
    return errors.every(e => !e.phone && !e.email)
  }

  async function handleSubmit(e: { preventDefault(): void; currentTarget: HTMLFormElement }) {
    e.preventDefault()
    setError(null)
    const data: Record<string, unknown> = Object.fromEntries(new FormData(e.currentTarget))
    data.starConnect = starConnect === 'yes' ? 'true' : 'false'
    data.workType = workType === 'Others' ? otherWorkType.trim() || null : workType || null
    data.coOwnerId = coOwnerId || null
    data.pocs = pocRows
      .filter(p => p.name.trim())
      .map(({ name, email, phone }) => ({ name, email, phone }))

    const datesOk = checkDates(data.startDate as string, data.endDate as string)
    const pocsOk  = validatePocs()
    if (!datesOk || !pocsOk) return

    startTransition(async () => {
      try {
        const res = await fetch('/api/opportunities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) {
          const j = await res.json()
          setError(j.error ?? 'Failed to create opportunity')
          toast.error(j.error ?? 'Failed to create opportunity')
          return
        }
        const opp = await res.json()
        router.push(`/opportunities/${opp.opportunityId}`)
      } catch {
        setError('Something went wrong. Please try again.')
        toast.error('Something went wrong. Please try again.')
      }
    })
  }

  const ownerInitials = ownerName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <form onSubmit={handleSubmit} style={{ fontFamily: 'inherit' }}>
      {error && (
        <div style={{
          background: C.dangerSoft,
          border: `1px solid ${C.danger}`,
          color: C.danger,
          padding: '10px 14px',
          fontSize: 12.5,
          marginBottom: 18,
          borderRadius: 2,
        }}>{error}</div>
      )}

      {/* ── CLIENT ───────────────────────────────────────────────────────── */}
      <SectionHeader label="Client" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <FieldLabel text="Client Name" required />
          <select
            name="clientId"
            required
            value={clientId}
            onChange={e => handleClientChange(e.target.value)}
            style={inputBase}
            {...focusHandlers}
          >
            <option value="">Select client…</option>
            {sortedClients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div style={{
            marginTop: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            {selectedClient
              ? <span style={{ ...MONO, fontSize: 10, color: C.inkFaint, letterSpacing: '0.06em' }}>
                  {selectedClient.clientId ?? 'Pending ID'}
                </span>
              : <span />
            }
            <a
              href="/clients"
              target="_blank"
              style={{
                ...MONO,
                fontSize: 10,
                color: C.accent,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              + Request new client
            </a>
          </div>
        </div>

        <div>
          <FieldLabel text="Client BU" />
          <input
            name="businessUnit"
            type="text"
            placeholder="e.g. Commercial, R&D, IT…"
            style={inputBase}
            {...focusHandlers}
          />
        </div>

        {/* POC sub-section */}
        <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            <FieldLabel text="Client POCs" />
            <button
              type="button"
              onClick={addBlankPoc}
              style={{
                ...MONO,
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: C.accent,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 0',
                fontWeight: 600,
              }}
            >
              + Add POC
            </button>
          </div>

          {availableExisting.length > 0 && (
            <select
              value=""
              onChange={e => {
                const poc = selectedClient!.pocs.find(p => p.id === e.target.value)
                if (poc) addPocFromExisting(poc)
              }}
              style={{ ...inputBase, marginBottom: 12 }}
              {...focusHandlers}
            >
              <option value="">Select from existing POCs…</option>
              {availableExisting.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.jobTitle ? ` — ${p.jobTitle}` : ''}
                </option>
              ))}
            </select>
          )}

          {pocRows.length === 0 && availableExisting.length === 0 && (
            <p style={{ ...MONO, fontSize: 10.5, color: C.inkFaint, letterSpacing: '0.02em' }}>
              {selectedClient ? 'No existing POCs for this client.' : 'Select a client to see existing POCs.'}
            </p>
          )}

          {pocRows.map((poc, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Name"
                  value={poc.name}
                  onChange={e => updatePoc(i, 'name', e.target.value)}
                  style={{ ...inputBase, flex: 1 }}
                  {...focusHandlers}
                />
                <input
                  type="text"
                  placeholder="Email"
                  value={poc.email}
                  onChange={e => {
                    updatePoc(i, 'email', e.target.value)
                    const err = validateEmail(e.target.value)
                    setPocErrors(prev => {
                      const next = [...prev]
                      next[i] = { ...next[i], email: err }
                      return next
                    })
                  }}
                  style={{ ...(pocErrors[i]?.email ? inputErr : inputBase), flex: 1 }}
                  {...focusHandlers}
                />
                <input
                  type="tel"
                  placeholder="+919876543210"
                  value={poc.phone}
                  onChange={e => {
                    updatePoc(i, 'phone', e.target.value)
                    const err = validatePhone(e.target.value)
                    setPocErrors(prev => {
                      const next = [...prev]
                      next[i] = { ...next[i], phone: err }
                      return next
                    })
                  }}
                  style={{ ...(pocErrors[i]?.phone ? inputErr : inputBase), flex: 1 }}
                  {...focusHandlers}
                />
                <button
                  type="button"
                  onClick={() => removePoc(i)}
                  aria-label="Remove POC"
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    background: 'transparent',
                    border: `1px solid ${C.rule}`,
                    color: C.inkMuted,
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 2,
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} style={{ width: 14, height: 14 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {poc.existingPocId && (
                <p style={{ ...MONO, fontSize: 9.5, color: C.accent, marginTop: 4, letterSpacing: '0.04em' }}>
                  Autofilled from existing POC — edit if needed
                </p>
              )}
              <FieldError msg={pocErrors[i]?.email} />
              <FieldError msg={pocErrors[i]?.phone} />
            </div>
          ))}
        </div>
      </div>

      {/* ── OPPORTUNITY DETAILS ──────────────────────────────────────────── */}
      <SectionHeader label="Opportunity Details" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        <div>
          <FieldLabel text="Opportunity Name" required />
          <input
            name="opportunityName"
            type="text"
            required
            placeholder="e.g. Commercial Analytics Transformation"
            style={inputBase}
            {...focusHandlers}
          />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <FieldLabel text="Work Type" />
          <select
            value={workType}
            onChange={e => { setWorkType(e.target.value); setOtherWorkType('') }}
            style={inputBase}
            {...focusHandlers}
          >
            <option value="">Select work type…</option>
            {WORK_TYPES.map(wt => (
              <option key={wt} value={wt}>{wt}</option>
            ))}
            <option value="Others">Others</option>
          </select>
          {workType === 'Others' && (
            <input
              type="text"
              placeholder="Describe the work type…"
              value={otherWorkType}
              onChange={e => setOtherWorkType(e.target.value)}
              style={{ ...inputBase, marginTop: 8 }}
              {...focusHandlers}
            />
          )}
        </div>

        <div>
          <FieldLabel text="Co-Owner" />
          <select
            value={coOwnerId}
            onChange={e => setCoOwnerId(e.target.value)}
            style={inputBase}
            {...focusHandlers}
          >
            <option value="">None</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel text="Start Date" required />
          <input name="startDate" type="date" required style={inputBase} onClick={openDatePicker} {...focusHandlers} />
        </div>

        <div>
          <FieldLabel text="End Date" required />
          <input
            name="endDate"
            type="date"
            required
            style={dateError ? inputErr : inputBase}
            onClick={openDatePicker}
            onChange={e => {
              const form = e.currentTarget.form
              const start = (form?.elements.namedItem('startDate') as HTMLInputElement)?.value ?? ''
              checkDates(start, e.target.value)
            }}
            {...focusHandlers}
          />
          <FieldError msg={dateError ?? undefined} />
        </div>

        {/* STAR Connect — segmented control */}
        <div>
          <FieldLabel text="STAR Connect Required?" />
          <div style={{
            display: 'inline-flex',
            border: `1px solid ${C.rule}`,
            borderRadius: 2,
            overflow: 'hidden',
            background: '#ffffff',
          }}>
            {(['no', 'yes'] as const).map((v, idx) => {
              const active = starConnect === v
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setStarConnect(v)}
                  style={{
                    ...MONO,
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    padding: '8px 22px',
                    background: active ? C.ink : 'transparent',
                    color:      active ? '#ffffff' : C.inkMuted,
                    border: 'none',
                    cursor: 'pointer',
                    borderLeft: idx === 0 ? 'none' : `1px solid ${C.rule}`,
                    fontWeight: 600,
                  }}
                >
                  {v}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <FieldLabel text="Estimated Revenue (USD)" />
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              ...MONO,
              fontSize: 12,
              color: C.inkFaint,
            }}>$</span>
            <input
              name="estimatedRevenue"
              type="number"
              min={0}
              step={1}
              placeholder="500000"
              style={{ ...inputBase, paddingLeft: 24, fontVariantNumeric: 'tabular-nums' }}
              {...focusHandlers}
            />
          </div>
          <FieldHint text=" " />
        </div>

        <div>
          <FieldLabel text="Win Probability (%)" />
          <div style={{ position: 'relative' }}>
            <input
              name="probability"
              type="number"
              min={1}
              max={100}
              step={1}
              placeholder="70"
              style={{ ...inputBase, paddingRight: 28, fontVariantNumeric: 'tabular-nums' }}
              {...focusHandlers}
            />
            <span style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              ...MONO,
              fontSize: 12,
              color: C.inkFaint,
            }}>%</span>
          </div>
          <FieldHint text="1 – 100. Multiplied by Estimated Revenue for the weighted pipeline." />
        </div>
      </div>

      {/* ── OWNER ────────────────────────────────────────────────────────── */}
      <SectionHeader label="Owner" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36,
          height: 36,
          background: C.accentSoft,
          color: C.accentDeep,
          display: 'grid',
          placeItems: 'center',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          flexShrink: 0,
        }}>
          {ownerInitials}
        </div>
        <div style={{ fontSize: 14, color: C.ink, fontWeight: 500 }}>{ownerName}</div>
      </div>

      {/* ── ACTIONS ──────────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 36,
        paddingTop: 18,
        borderTop: `1px solid ${C.rule}`,
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 10,
      }}>
        <a
          href="/dashboard"
          style={{
            ...MONO,
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: C.inkMuted,
            border: `1px solid ${C.rule}`,
            padding: '10px 18px',
            background: '#ffffff',
            textDecoration: 'none',
          }}
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={isPending}
          style={{
            ...MONO,
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            background: C.accent,
            color: '#ffffff',
            border: `1px solid ${C.accentDeep}`,
            padding: '10px 22px',
            cursor: isPending ? 'not-allowed' : 'pointer',
            opacity: isPending ? 0.55 : 1,
            fontWeight: 600,
          }}
        >
          {isPending ? 'Creating…' : 'Create Opportunity'}
        </button>
      </div>
    </form>
  )
}
