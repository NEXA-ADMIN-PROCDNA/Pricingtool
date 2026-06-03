'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const INDUSTRIES = [
  'Pharmaceuticals', 'Financial Services', 'Biotechnology',
  'Technology', 'Healthcare', 'Manufacturing', 'Retail', 'Other',
]
const REGIONS = ['North America', 'Europe', 'Asia Pacific', 'Middle East', 'India', 'Other']

type EditableClient = {
  id: string
  clientId: string
  name: string
  businessUnit: string | null
  industry: string | null
  region: string | null
}

export function EditClientModal({
  client, onClose,
}: {
  client: EditableClient | null
  onClose: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', businessUnit: '', industry: '', region: '' })
  const [customIndustry, setCustomIndustry] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Re-seed the form whenever a different client is opened.
  useEffect(() => {
    if (!client) return
    const known = !!client.industry && INDUSTRIES.includes(client.industry)
    setForm({
      name:         client.name ?? '',
      businessUnit: client.businessUnit ?? '',
      industry:     client.industry ? (known ? client.industry : 'Other') : '',
      region:       client.region ?? '',
    })
    setCustomIndustry(known ? '' : (client.industry ?? ''))
    setError('')
  }, [client])

  if (!client) return null

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!client) return
    if (!form.name.trim()) return
    const industry = form.industry === 'Other' ? customIndustry.trim() : form.industry
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          businessUnit: form.businessUnit,
          industry,
          region: form.region,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Save failed')
      }
      toast.success('Client updated')
      onClose()
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
      toast.error(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Edit Client</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Changes are saved directly to <span className="font-mono">{client.clientId}</span> — references stay intact.
              </p>
            </div>
            <button
              onClick={() => !saving && onClose()}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={save} className="px-6 py-5 space-y-4">
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
                  onChange={e => { setForm(f => ({ ...f, industry: e.target.value })); if (e.target.value !== 'Other') setCustomIndustry('') }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 bg-white"
                >
                  <option value="">Select…</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                {form.industry === 'Other' && (
                  <input
                    type="text"
                    placeholder="Specify industry…"
                    value={customIndustry}
                    onChange={e => setCustomIndustry(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                    autoFocus
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Region</label>
                <select
                  value={form.region}
                  onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 bg-white"
                >
                  <option value="">Select…</option>
                  {/* Keep the client's existing region selectable even if it isn't in the preset list */}
                  {form.region && !REGIONS.includes(form.region) && <option value={form.region}>{form.region}</option>}
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

            {error && (
              <p className="text-xs text-red-500 rounded-lg bg-red-50 border border-red-100 px-3 py-2">{error}</p>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => !saving && onClose()}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
