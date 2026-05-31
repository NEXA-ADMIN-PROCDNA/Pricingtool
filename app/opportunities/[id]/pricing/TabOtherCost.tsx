'use client'
import type { OtherCostRow } from './types'
import { fmt } from './utils'

const LOB_OPTIONS = [
  { value: 'ANALYTICS', label: 'Analytics' },
  { value: 'AUXO',      label: 'Auxo' },
  { value: 'DS',        label: 'Data Science' },
  { value: 'DESIGN',    label: 'Design' },
  { value: 'MS',        label: 'Managed Services' },
  { value: 'TECH',      label: 'Technology' },
]

interface Props {
  otherCosts: OtherCostRow[]
  showAddCost: boolean
  newDesc: string
  newAmount: string
  newMarkup: string
  newLob: string
  editCostCell: { id: string; field: 'markup' | 'billed' } | null
  editCostVal: string
  setShowAddCost: (v: boolean) => void
  setNewDesc: (v: string) => void
  setNewAmount: (v: string) => void
  setNewMarkup: (v: string) => void
  setNewLob: (v: string) => void
  setEditCostCell: (v: { id: string; field: 'markup' | 'billed' } | null) => void
  setEditCostVal: (v: string) => void
  addOtherCost: () => void
  removeOtherCost: (costId: string) => void
  toggleBillable: (costId: string, billable: boolean) => void
  updateLob: (costId: string, lob: string | null) => void
  commitMarkup: (costId: string, val: string) => void
  commitBilled: (costId: string, val: string) => void
  readOnly?: boolean
}

export function TabOtherCost({
  otherCosts, showAddCost, newDesc, newAmount, newMarkup, newLob, editCostCell, editCostVal,
  setShowAddCost, setNewDesc, setNewAmount, setNewMarkup, setNewLob, setEditCostCell, setEditCostVal,
  addOtherCost, removeOtherCost, toggleBillable, updateLob, commitMarkup, commitBilled,
  readOnly = false,
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-2 py-3 w-10 text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">Bill</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nature of Expense</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-28">Line of Business</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 w-36">Cost</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-indigo-400 w-28">Markup %</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-indigo-400 w-36">Billed</th>
            <th className="px-2 py-3 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {otherCosts.map(oc => {
            const billed = oc.isBillable ? oc.amount * (1 + (oc.markupPct ?? 0) / 100) : 0
            const isEditingMarkup = editCostCell?.id === oc.id && editCostCell?.field === 'markup'
            const isEditingBilled = editCostCell?.id === oc.id && editCostCell?.field === 'billed'
            return (
              <tr key={oc.id} className={`group transition-colors ${!oc.isBillable ? 'opacity-40' : 'hover:bg-slate-50/50'}`}>
                {/* Billable checkbox */}
                <td className="px-2 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={oc.isBillable}
                    disabled={readOnly}
                    onChange={e => !readOnly && toggleBillable(oc.id, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </td>
                {/* Description */}
                <td className="px-4 py-3 text-slate-800">{oc.description}</td>
                {/* Line of Business */}
                <td className="px-3 py-2">
                  <select
                    value={oc.lineOfBusiness ?? ''}
                    disabled={readOnly}
                    onChange={e => !readOnly && updateLob(oc.id, e.target.value || null)}
                    className="w-full text-xs rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">—</option>
                    {LOB_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </td>
                {/* Cost */}
                <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(oc.amount)}</td>
                {/* Markup % */}
                <td className="px-2 py-2 text-right">
                  {isEditingMarkup && !readOnly ? (
                    <input
                      autoFocus type="number" step={0.1} placeholder="0"
                      value={editCostVal}
                      onChange={e => setEditCostVal(e.target.value)}
                      onBlur={() => commitMarkup(oc.id, editCostVal)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditCostCell(null) }}
                      className="w-20 text-right text-xs rounded-lg border border-indigo-400 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  ) : (
                    <span
                      onClick={() => { if (readOnly) return; setEditCostCell({ id: oc.id, field: 'markup' }); setEditCostVal(oc.markupPct != null ? String(oc.markupPct) : '') }}
                      className={`rounded px-2 py-1 text-xs font-semibold text-slate-600 ${readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-indigo-50 hover:text-indigo-700'}`}
                    >
                      {oc.markupPct != null ? `${oc.markupPct.toFixed(1)}%` : <span className="text-slate-300">0%</span>}
                    </span>
                  )}
                </td>
                {/* Billed */}
                <td className="px-2 py-2 text-right">
                  {isEditingBilled && !readOnly ? (
                    <input
                      autoFocus type="number" min={0} step={1} placeholder="0"
                      value={editCostVal}
                      onChange={e => setEditCostVal(e.target.value)}
                      onBlur={() => commitBilled(oc.id, editCostVal)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditCostCell(null) }}
                      className="w-24 text-right text-xs rounded-lg border border-indigo-400 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  ) : (
                    <span
                      onClick={() => { if (readOnly || !oc.isBillable) return; setEditCostCell({ id: oc.id, field: 'billed' }); setEditCostVal(billed.toFixed(0)) }}
                      className={`rounded px-2 py-1 text-xs font-semibold ${!readOnly && oc.isBillable ? 'cursor-pointer text-indigo-700 hover:bg-indigo-50' : 'text-slate-400 cursor-default'}`}
                    >
                      {fmt(billed)}
                    </span>
                  )}
                </td>
                {/* Delete */}
                <td className="px-2 py-3">
                  {!readOnly && (
                    <button
                      onClick={() => removeOtherCost(oc.id)}
                      title="Remove"
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                      </svg>
                    </button>
                  )}
                </td>
              </tr>
            )
          })}

          {/* Total row — billable rows only */}
          {otherCosts.length > 0 && (
            <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
              <td />
              <td className="px-4 py-3 text-slate-800">Total</td>
              <td />
              <td className="px-4 py-3 text-right text-slate-700">
                {fmt(otherCosts.filter(oc => oc.isBillable).reduce((s, oc) => s + oc.amount, 0))}
              </td>
              <td />
              <td className="px-4 py-3 text-right text-indigo-700">
                {fmt(otherCosts.filter(oc => oc.isBillable).reduce((s, oc) => s + oc.amount * (1 + (oc.markupPct ?? 0) / 100), 0))}
              </td>
              <td />
            </tr>
          )}

          {/* Add row */}
          {!readOnly && <tr className="border-t border-dashed border-slate-200 bg-white">
            {showAddCost ? (
              <>
                <td />
                <td className="px-3 py-2.5">
                  <input
                    autoFocus
                    type="text"
                    placeholder="e.g. Travel — client site visits"
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addOtherCost(); if (e.key === 'Escape') setShowAddCost(false) }}
                    className="w-full text-xs rounded-lg border border-indigo-300 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <select
                    value={newLob}
                    onChange={e => setNewLob(e.target.value)}
                    className="w-full text-xs rounded-lg border border-indigo-300 px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">—</option>
                    {LOB_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2.5">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="0"
                    value={newAmount}
                    onChange={e => setNewAmount(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addOtherCost(); if (e.key === 'Escape') setShowAddCost(false) }}
                    className="w-full text-xs text-right rounded-lg border border-indigo-300 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <input
                    type="number"
                    step={0.1}
                    placeholder="0%"
                    value={newMarkup}
                    onChange={e => setNewMarkup(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addOtherCost(); if (e.key === 'Escape') setShowAddCost(false) }}
                    className="w-20 text-xs text-right rounded-lg border border-indigo-300 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </td>
                <td />
                <td className="px-2 py-2.5">
                  <div className="flex gap-1">
                    <button
                      onClick={addOtherCost}
                      disabled={!newDesc.trim() || !newAmount}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                      title="Add"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => { setShowAddCost(false); setNewDesc(''); setNewAmount(''); setNewMarkup(''); setNewLob('') }}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:bg-slate-100 transition-colors"
                      title="Cancel"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </td>
              </>
            ) : (
              <td colSpan={7} className="px-4 py-2.5">
                <button
                  onClick={() => setShowAddCost(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-indigo-300 text-indigo-400 text-sm font-bold leading-none">+</span>
                  Add Cost
                </button>
              </td>
            )}
          </tr>}
        </tbody>
      </table>
    </div>
  )
}
