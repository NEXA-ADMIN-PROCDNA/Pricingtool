'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { LineOfBusiness } from '@prisma/client'

type POC    = { id: string; name: string; email: string | null; phone: string | null; jobTitle: string | null }
type Client = {
  id: string; name: string; clientId: string
  businessUnit: string | null; industry: string | null; region: string | null
  pocs: POC[]
}

const LOB_OPTIONS: { value: LineOfBusiness; label: string }[] = [
  { value: 'TECH',      label: 'Technology'       },
  { value: 'ANALYTICS', label: 'Analytics'         },
  { value: 'DS',        label: 'Data Science'      },
  { value: 'MS',        label: 'Managed Services'  },
  { value: 'DESIGN',    label: 'Design'            },
]

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-slate-700 mb-1">
      {text} {required && <span className="text-red-500">*</span>}
    </label>
  )
}

// +1–3 digit country code (optional) followed by exactly 10 digits
const PHONE_RE = /^(\+\d{1,3})?\d{10}$/

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition'

const inputErrCls =
  'w-full rounded-xl border border-red-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100 transition'

function FieldError({ msg }: { msg: string | undefined }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-red-500">{msg}</p>
}

export function NewOpportunityForm({ clients }: { clients: Client[] }) {
  const router = useRouter()
  const { data: session } = useSession()
  const sessionUser = session?.user as any
  const ownerName = sessionUser?.name ?? '…'

  const [isPending, startTransition] = useTransition()
  const [error, setError]             = useState<string | null>(null)
  const [clientId, setClientId]       = useState('')
  const [starConnect, setStarConnect] = useState<'yes' | 'no'>('no')
  const [newPocs, setNewPocs]         = useState<{ name: string; email: string; phone: string }[]>([])
  const [deletedPocIds, setDeletedPocIds] = useState<Set<string>>(new Set())
  const [deletingPocId, setDeletingPocId] = useState<string | null>(null)
  const [dateError, setDateError]         = useState<string | null>(null)
  const [pocErrors, setPocErrors]         = useState<{ phone?: string; email?: string }[]>([])

  const selectedClient = clients.find(c => c.id === clientId) ?? null
  const visibleExistingPocs = selectedClient?.pocs.filter(p => !deletedPocIds.has(p.id)) ?? []

  function addPoc()    { setNewPocs(p => [...p, { name: '', email: '', phone: '' }]) }
  function removePoc(i: number) { setNewPocs(p => p.filter((_, idx) => idx !== i)) }
  function updatePoc(i: number, field: 'name' | 'email' | 'phone', value: string) {
    setNewPocs(p => p.map((poc, idx) => idx === i ? { ...poc, [field]: value } : poc))
  }

  function handleClientChange(id: string) {
    setClientId(id)
    setDeletedPocIds(new Set())
    setNewPocs([])
  }

  async function deleteExistingPoc(pocId: string) {
    setDeletingPocId(pocId)
    try {
      const res = await fetch(`/api/client-pocs/${pocId}`, { method: 'DELETE' })
      if (res.ok) setDeletedPocIds(prev => new Set([...prev, pocId]))
    } finally {
      setDeletingPocId(null)
    }
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
    if (start && end && new Date(end) < new Date(start)) {
      setDateError('End date must be on or after start date')
      return false
    }
    setDateError(null)
    return true
  }

  function validatePocs() {
    const errors = newPocs.map(p => ({
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
    data.pocs = newPocs.filter(p => p.name.trim())

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
          return
        }
        const opp = await res.json()
        router.push(`/opportunities/${opp.opportunityId}`)
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Section: Client */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-slate-500">Client</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

          <div>
            <Label text="Client Name" required />
            <select
              name="clientId"
              required
              value={clientId}
              onChange={e => handleClientChange(e.target.value)}
              className={inputCls}
            >
              <option value="">Select client…</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.clientId})</option>
              ))}
            </select>
            <div className="mt-1 flex items-center justify-between">
              {selectedClient
                ? <p className="text-[10px] text-slate-400 font-mono">{selectedClient.clientId}</p>
                : <span />
              }
              <a
                href="/clients"
                target="_blank"
                className="text-[10px] text-indigo-500 hover:text-indigo-700 hover:underline transition-colors"
              >
                + Request new client →
              </a>
            </div>
          </div>

          <div>
            <Label text="Business Unit" />
            <input
              name="businessUnit"
              type="text"
              placeholder="e.g. Commercial, R&D, IT…"
              className={inputCls}
            />
          </div>

          {/* Existing POCs from client master */}
          {visibleExistingPocs.length > 0 && (
            <div className="col-span-full">
              <Label text="Existing Client POCs" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {visibleExistingPocs.map(poc => (
                  <div key={poc.id} className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-700">
                      {poc.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700 truncate">{poc.name}</p>
                      {poc.jobTitle && <p className="text-[10px] text-slate-400">{poc.jobTitle}</p>}
                      {poc.email    && <p className="text-[10px] text-indigo-500 truncate">{poc.email}</p>}
                      {poc.phone    && <p className="text-[10px] text-slate-400">{poc.phone}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteExistingPoc(poc.id)}
                      disabled={deletingPocId === poc.id}
                      className="shrink-0 rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-400 transition-colors disabled:opacity-40"
                      title="Delete POC"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add new POCs */}
          <div className="col-span-full">
            <div className="flex items-center justify-between mb-2">
              <Label text="Add Client POCs" />
              <button
                type="button"
                onClick={addPoc}
                className="flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add POC
              </button>
            </div>

            {newPocs.length === 0 && (
              <p className="text-xs text-slate-400 italic">No POCs added yet.</p>
            )}

            <div className="space-y-3">
              {newPocs.map((poc, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={poc.name}
                      onChange={e => updatePoc(i, 'name', e.target.value)}
                      className={inputCls + ' flex-1'}
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
                      className={(pocErrors[i]?.email ? inputErrCls : inputCls) + ' flex-1'}
                    />
                    <input
                      type="tel"
                      placeholder="e.g. +919876543210"
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
                      className={(pocErrors[i]?.phone ? inputErrCls : inputCls) + ' flex-1'}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        removePoc(i)
                        setPocErrors(prev => prev.filter((_, idx) => idx !== i))
                      }}
                      className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {pocErrors[i]?.email && <FieldError msg={pocErrors[i].email} />}
                  {pocErrors[i]?.phone && <FieldError msg={pocErrors[i].phone} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section: Opportunity Details */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-slate-500">Opportunity Details</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

          <div>
            <Label text="Opportunity Type" required />
            <select name="opportunityType" required className={inputCls}>
              <option value="NEW">New Opportunity</option>
              <option value="EXISTING">Existing Client</option>
            </select>
          </div>

          <div>
            <Label text="Opportunity Name" required />
            <input
              name="opportunityName"
              type="text"
              required
              placeholder="e.g. Commercial Analytics Transformation"
              className={inputCls}
            />
          </div>

          <div>
            <Label text="Start Date" required />
            <input name="startDate" type="date" required className={inputCls} />
          </div>

          <div>
            <Label text="End Date" />
            <input
              name="endDate"
              type="date"
              className={dateError ? inputErrCls : inputCls}
              onChange={e => {
                const form = e.currentTarget.form
                const start = (form?.elements.namedItem('startDate') as HTMLInputElement)?.value ?? ''
                checkDates(start, e.target.value)
              }}
            />
            <FieldError msg={dateError ?? undefined} />
          </div>

          <div>
            <Label text="Primary Line of Business" required />
            <select name="primaryLob" required className={inputCls}>
              <option value="">Select LOB…</option>
              {LOB_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* STAR Connect — yes/no toggle */}
          <div>
            <Label text="STAR Connect Required?" />
            <div className="flex gap-3 mt-1">
              {(['yes', 'no'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setStarConnect(v)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-all ${
                    starConnect === v
                      ? v === 'yes'
                        ? 'border-amber-400 bg-amber-50 text-amber-700'
                        : 'border-slate-300 bg-slate-100 text-slate-700'
                      : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {v === 'yes' ? '⭐ Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated Revenue */}
          <div>
            <Label text="Estimated Revenue ($)" />
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
              <input
                name="estimatedRevenue"
                type="number"
                min={0}
                step={1}
                placeholder="e.g. 500000"
                className={inputCls + ' pl-7'}
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              Used in pipeline if no final pricing exists. Weighted by probability below.
            </p>
          </div>

          {/* Win Probability */}
          <div>
            <Label text="Win Probability (%)" />
            <div className="relative">
              <input
                name="probability"
                type="number"
                min={1}
                max={100}
                step={1}
                placeholder="e.g. 70"
                className={inputCls + ' pr-8'}
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              1 – 100. Multiplied by estimated revenue for pipeline calculation.
            </p>
          </div>
        </div>
      </div>

      {/* Section: Owner (auto-filled) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-slate-500">Owner</h2>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white">
            {ownerName.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{ownerName}</p>
            <p className="text-xs text-slate-400">Automatically set to you</p>
          </div>
        </div>
      </div>

      {/* Section: Notes */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-slate-500">Notes</h2>
        <div>
          <Label text="Notes" />
          <textarea
            name="notes"
            rows={3}
            placeholder="Any additional context…"
            className={inputCls + ' resize-none'}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <a
          href="/dashboard"
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating…
            </>
          ) : 'Create Opportunity'}
        </button>
      </div>
    </form>
  )
}
