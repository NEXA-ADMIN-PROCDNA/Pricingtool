'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LineOfBusiness, OpportunityStage, OpportunityType } from '@prisma/client'

type Client = { id: string; name: string; clientId: string }
type User   = { id: string; name: string; role: string }

const LOB_OPTIONS: { value: LineOfBusiness; label: string }[] = [
  { value: 'ANALYTICS', label: 'Analytics' },
  { value: 'TECH',      label: 'Technology' },
  { value: 'DS',        label: 'Data Science' },
  { value: 'MS',        label: 'Managed Services' },
  { value: 'OTHERS',    label: 'Others' },
]

const STAGE_OPTIONS: { value: OpportunityStage; label: string }[] = [
  { value: 'LEAD',          label: 'Lead'          },
  { value: 'QUALIFICATION', label: 'Qualification' },
  { value: 'PROPOSAL',      label: 'Proposal'      },
  { value: 'SOW_SUBMITTED', label: 'SOW Submitted' },
  { value: 'SOW_SIGNED',    label: 'SOW Signed'    },
  { value: 'PO_RECEIVED',   label: 'PO Received'   },
]

function InputField({
  label, name, type = 'text', required, placeholder, children,
}: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string; children?: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children ?? (
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
        />
      )}
    </div>
  )
}

function SelectField({
  label, name, required, children,
}: {
  label: string; name: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        name={name}
        required={required}
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
      >
        {children}
      </select>
    </div>
  )
}

export function NewOpportunityForm({ clients, users }: { clients: Client[]; users: User[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const data = Object.fromEntries(new FormData(e.currentTarget))

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
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Section: Core details */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-sm font-semibold text-slate-700 uppercase tracking-wide">Core Details</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField label="Client" name="clientId" required>
            <option value="">Select client…</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.clientId})</option>
            ))}
          </SelectField>

          <InputField label="Opportunity Name" name="opportunityName" required placeholder="e.g. Data Analytics Transformation" />

          <SelectField label="Type" name="opportunityType" required>
            <option value="NEW">New Business</option>
            <option value="EXISTING">Existing Client</option>
          </SelectField>

          <SelectField label="Line of Business" name="primaryLob" required>
            <option value="">Select LOB…</option>
            {LOB_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </SelectField>

          <SelectField label="Stage" name="stage">
            {STAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </SelectField>

          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              name="starConnect"
              id="starConnect"
              value="true"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="starConnect" className="text-sm font-medium text-slate-700">
              ⭐ Star Connect deal
            </label>
          </div>
        </div>
      </div>

      {/* Section: Team */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-sm font-semibold text-slate-700 uppercase tracking-wide">Team</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField label="Owner" name="ownerId" required>
            <option value="">Select owner…</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </SelectField>
          <SelectField label="Co-Owner" name="coOwnerId">
            <option value="">None</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </SelectField>
        </div>
      </div>

      {/* Section: Timeline */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-sm font-semibold text-slate-700 uppercase tracking-wide">Timeline</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <InputField label="Start Date" name="startDate" type="date" required />
          <InputField label="End Date"   name="endDate"   type="date" />
        </div>
      </div>

      {/* Section: Notes */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-sm font-semibold text-slate-700 uppercase tracking-wide">Notes</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Next Steps</label>
            <textarea
              name="nextSteps"
              rows={2}
              placeholder="What needs to happen next?"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              name="notes"
              rows={3}
              placeholder="Any additional context…"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition resize-none"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
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
