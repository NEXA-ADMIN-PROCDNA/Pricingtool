'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LineOfBusiness, OpportunityStage } from '@prisma/client'

type POC    = { id: string; name: string; email: string | null; jobTitle: string | null }
type Client = {
  id: string; name: string; clientId: string
  businessUnit: string | null; industry: string | null; region: string | null
  pocs: POC[]
}
type User = { id: string; name: string; role: string }

const LOB_OPTIONS: { value: LineOfBusiness; label: string }[] = [
  { value: 'TECH',      label: 'Technology'       },
  { value: 'ANALYTICS', label: 'Analytics'         },
  { value: 'DS',        label: 'Data Science'      },
  { value: 'MS',        label: 'Managed Services'  },
  { value: 'OTHERS',    label: 'Others'            },
]

const STAGE_OPTIONS: { value: OpportunityStage; label: string }[] = [
  { value: 'LEAD',          label: 'Lead'          },
  { value: 'QUALIFICATION', label: 'Qualification' },
  { value: 'PROPOSAL',      label: 'Proposal'      },
  { value: 'SOW_SUBMITTED', label: 'SOW Submitted' },
  { value: 'SOW_SIGNED',    label: 'SOW Signed'    },
  { value: 'PO_RECEIVED',   label: 'PO Received'   },
]

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-slate-700 mb-1">
      {text} {required && <span className="text-red-500">*</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition'

const disabledCls =
  'w-full rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500 shadow-sm cursor-default'

export function NewOpportunityForm({ clients, users }: { clients: Client[]; users: User[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError]   = useState<string | null>(null)
  const [clientId, setClientId]     = useState('')
  const [starConnect, setStarConnect] = useState<'yes' | 'no'>('no')

  const selectedClient = clients.find(c => c.id === clientId) ?? null

  async function handleSubmit(e: { preventDefault(): void; currentTarget: HTMLFormElement }) {
    e.preventDefault()
    setError(null)
    const data = Object.fromEntries(new FormData(e.currentTarget))
    data.starConnect = starConnect === 'yes' ? 'true' : 'false'

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

          {/* Client Name (dropdown — hidden clientId sent via name="clientId") */}
          <div>
            <Label text="Client Name" required />
            <select
              name="clientId"
              required
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className={inputCls}
            >
              <option value="">Select client…</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.clientId})</option>
              ))}
            </select>
            {selectedClient && (
              <p className="mt-1 text-[10px] text-slate-400 font-mono">{selectedClient.clientId}</p>
            )}
          </div>

          {/* Client BU — autofilled, greyed out */}
          <div>
            <Label text="Client Business Unit" />
            <div className={disabledCls}>
              {selectedClient?.businessUnit ?? <span className="text-slate-300 italic">Select a client first</span>}
            </div>
          </div>

          {/* Client POCs — displayed when client selected */}
          {selectedClient && selectedClient.pocs.length > 0 && (
            <div className="col-span-full">
              <Label text="Client POCs (from master)" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {selectedClient.pocs.map(poc => (
                  <div key={poc.id} className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-700">
                      {poc.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{poc.name}</p>
                      {poc.jobTitle && <p className="text-[10px] text-slate-400">{poc.jobTitle}</p>}
                      {poc.email    && <p className="text-[10px] text-indigo-500 truncate">{poc.email}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {selectedClient && selectedClient.pocs.length === 0 && (
            <div className="col-span-full">
              <Label text="Client POCs" />
              <p className="text-xs text-slate-400 italic mt-1">No POCs on file for this client.</p>
            </div>
          )}
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
            <input name="endDate" type="date" className={inputCls} />
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

          <div>
            <Label text="Stage" />
            <select name="stage" className={inputCls}>
              {STAGE_OPTIONS.map(o => (
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
        </div>
      </div>

      {/* Section: Team */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-slate-500">Team</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <Label text="Owner" required />
            <select name="ownerId" required className={inputCls}>
              <option value="">Select owner…</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
          <div>
            <Label text="Co-Owner" />
            <select name="coOwnerId" className={inputCls}>
              <option value="">None</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Section: Notes */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-slate-500">Notes</h2>
        <div className="space-y-4">
          <div>
            <Label text="Next Steps" />
            <textarea
              name="nextSteps"
              rows={2}
              placeholder="What needs to happen next?"
              className={inputCls + ' resize-none'}
            />
          </div>
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
