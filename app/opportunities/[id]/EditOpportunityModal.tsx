'use client'
import { useState } from 'react'
import { toast } from 'sonner'

const DATE_LOCKED_STAGES = ['APPROVAL_PENDING', 'SOW_REVIEW_PENDING']

function toInputDate(d: string | Date) {
  return new Date(d).toISOString().slice(0, 10)
}

function openPicker(e: React.MouseEvent<HTMLInputElement>) {
  const el = e.currentTarget
  if (typeof el.showPicker === 'function') {
    try { el.showPicker() } catch { /* already open / unsupported */ }
  }
}

export function EditOpportunityModal({
  opportunityId, stage,
  initialBusinessUnit, initialStarConnect, initialStartDate, initialEndDate,
  onClose,
}: {
  opportunityId: string
  stage: string
  initialBusinessUnit: string | null
  initialStarConnect: boolean
  initialStartDate: string | Date
  initialEndDate: string | Date
  onClose: () => void
}) {
  const [businessUnit, setBusinessUnit] = useState(initialBusinessUnit ?? '')
  const [starConnect, setStarConnect]   = useState(initialStarConnect)
  const [startDate, setStartDate]       = useState(toInputDate(initialStartDate))
  const [endDate, setEndDate]           = useState(toInputDate(initialEndDate))
  const [saving, setSaving]             = useState(false)

  const datesLocked  = DATE_LOCKED_STAGES.includes(stage)
  const origStart    = toInputDate(initialStartDate)
  const origEnd      = toInputDate(initialEndDate)
  const datesChanged = startDate !== origStart || endDate !== origEnd
  const invalidDates = !startDate || !endDate || endDate < startDate

  async function save() {
    if (datesChanged && invalidDates) { toast.error('End date must be on or after the start date.'); return }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        businessUnit: businessUnit.trim() || null,
        starConnect,
      }
      if (datesChanged && !datesLocked) {
        payload.startDate = startDate
        payload.endDate   = endDate
      }
      const res = await fetch(`/api/opportunities/${opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        toast.error(b.error ?? 'Failed to save changes')
        return
      }
      toast.success('Opportunity updated')
      // A date change cascades (stage → Price Linked, trimmed weeks, recomputed
      // metrics + LoB), so reload for a fully fresh view.
      window.location.reload()
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const dateInputCls =
    'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg bg-white shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">Edit opportunity details</h2>
            <button onClick={() => !saving && onClose()} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Business Unit */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Client BU</label>
              <input
                type="text"
                value={businessUnit}
                onChange={e => setBusinessUnit(e.target.value)}
                placeholder="e.g. Oncology"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Star Connect */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Star Connect</label>
              <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
                {[{ v: true, t: 'Yes' }, { v: false, t: 'No' }].map(o => (
                  <button
                    key={o.t}
                    type="button"
                    onClick={() => setStarConnect(o.v)}
                    className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
                      starConnect === o.v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {o.t}
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Start Date</label>
                <input type="date" value={startDate} disabled={datesLocked}
                  onClick={openPicker} onChange={e => setStartDate(e.target.value)} className={dateInputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">End Date</label>
                <input type="date" value={endDate} disabled={datesLocked}
                  onClick={openPicker} onChange={e => setEndDate(e.target.value)} className={dateInputCls} />
              </div>
            </div>

            {datesLocked && (
              <p className="text-xs text-slate-500 rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
                Dates are locked while an approval is in progress. Withdraw the pending request to change them.
              </p>
            )}

            {datesChanged && !datesLocked && (
              <div className="text-xs text-amber-800 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 leading-relaxed">
                <strong>Changing the dates resets the pricing.</strong> All staffing hours will be cleared and the
                opportunity returns to “Price Linked” — the pricing must be re-built for the new window and sent for
                approval again from the beginning.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={() => !saving && onClose()}
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || (datesChanged && invalidDates)}
              className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
