'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'

const INDUSTRIES = [
  'Pharmaceuticals', 'Financial Services', 'Biotechnology',
  'Technology', 'Healthcare', 'Manufacturing', 'Retail', 'Other',
]
const REGIONS = ['North America', 'Europe', 'Asia Pacific', 'Middle East', 'India', 'Other']

export function AddClientModal() {
  const { data: session } = useSession()
  const userId = (session?.user as any)?.id as string | undefined

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: '', businessUnit: '', industry: '', region: '', notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  function close() {
    setOpen(false)
    setDone(false)
    setError('')
    setForm({ name: '', businessUnit: '', industry: '', region: '', notes: '' })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    if (!userId) {
      setError('Session not ready — please refresh the page and try again.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/client-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, requestedById: userId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Request failed')
      }
      setDone(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Client
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm" onClick={close} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Request New Client</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Your request will be reviewed by an admin before being added to the master list.
                  </p>
                </div>
                <button
                  onClick={close}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {done ? (
                <div className="px-6 py-12 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.5} className="w-7 h-7">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 mb-1">Request Submitted</h3>
                  <p className="text-sm text-slate-500 mb-6">
                    An admin will review your request and add the client to the master list.
                  </p>
                  <button
                    onClick={close}
                    className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} className="px-6 py-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                      Client Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Pfizer Inc."
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Industry</label>
                      <select
                        value={form.industry}
                        onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 bg-white"
                      >
                        <option value="">Select…</option>
                        {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Region</label>
                      <select
                        value={form.region}
                        onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 bg-white"
                      >
                        <option value="">Select…</option>
                        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Business Unit</label>
                    <input
                      type="text"
                      placeholder="e.g. Oncology"
                      value={form.businessUnit}
                      onChange={e => setForm(f => ({ ...f, businessUnit: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                      Notes <span className="text-slate-300 normal-case font-normal">(why are we adding this client?)</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Context for the admin…"
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 resize-none"
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-red-500 rounded-lg bg-red-50 border border-red-100 px-3 py-2">{error}</p>
                  )}

                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !form.name.trim()}
                      className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Submitting…' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
