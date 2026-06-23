'use client'
// ─────────────────────────────────────────────────────────────────────────────
// PricingDrawer — the pricing editor (client component, the app's most complex screen).
//
// Big picture: a slide-over with five sub-tabs (Basic Details / Efforts / Other Cost /
// Financial / Schedule of Payments) for ONE pricing version. It loads the version's
// staffing into local StaffRow state, lets the user edit weekly hours / rates /
// utilisation, and recomputes all metrics LIVE via pricing/utils (computeFromRows, etc.)
// before persisting through the /pricing-versions/[pvId]/staffing routes.
//
// `locked` = version.isFinal AND currentStage ∈ LOCKED_STAGES — once an approval is in
// flight the final version is read-only. NOTE it uses currentStage (the live prop), not
// the stale page-load opp.stage, so the lock reflects reality.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import type { OpportunityDetail } from '@/lib/db/opportunities'
import type { StaffRow, RateCardItem, OtherCostRow, ComputedMetrics } from './pricing/types'
import { computeFromRows, computeFte, getWeekColumns, weekKey, proratedWeekHours, workingDaysInWindow } from './pricing/utils'
import { TabBasicDetails } from './pricing/TabBasicDetails'
import { TabEfforts }      from './pricing/TabEfforts'
import { TabOtherCost }    from './pricing/TabOtherCost'
import { TabSoP }          from './pricing/TabSoP'
import { TabFinancial }    from './pricing/TabFinancial'

type Version = OpportunityDetail['pricingVersions'][number]

const SUB_TABS = [
  'Basic Details',
  'Efforts',
  'Other Cost',
  'Financial',
  'Schedule of Payments',
] as const
type SubTab = typeof SUB_TABS[number]

// Visually de-emphasised tabs (work-in-progress) — still clickable
const DIMMED: Set<SubTab> = new Set<SubTab>()

const LOCKED_STAGES = new Set(['APPROVAL_PENDING', 'SOW_PENDING', 'SOW_SUBMITTED', 'SOW_REVIEW_PENDING', 'TO_BE_ARCHIVED'])

export function PricingDrawer({
  version,
  opp,
  currentStage,
  onClose,
  onOtherCostsChanged,
}: {
  version: Version
  opp: OpportunityDetail
  currentStage: string
  onClose: () => void
  onOtherCostsChanged?: () => void
}) {
  const locked = version.isFinal && LOCKED_STAGES.has(currentStage)
  const [sub, setSub] = useState<SubTab>('Basic Details')

  // ── Efforts state ────────────────────────────────────────────────
  const toStaffRow = (sr: any): StaffRow => ({
    id: sr.id,
    rateCardId: sr.rateCardId ?? null,
    resourceDesignation: sr.resourceDesignation,
    potMem: sr.potMem ?? null,
    location: sr.location,
    domain: sr.domain ?? null,
    utilization: sr.utilization != null ? Number(sr.utilization) : null,
    costRatePerHour: sr.costRatePerHour != null ? Number(sr.costRatePerHour) : null,
    systemBillRatePerHour: sr.systemBillRatePerHour != null ? Number(sr.systemBillRatePerHour) : null,
    effectiveBillRate: sr.effectiveBillRate != null ? Number(sr.effectiveBillRate) : null,
    isActive: sr.isActive ?? true,
    isBillable: sr.isBillable ?? true,
    weeklyHours: (sr.weeklyHours ?? []).map((w: any) => ({
      weekStartDate: new Date(w.weekStartDate).toISOString().slice(0, 10),
      hours: Number(w.hours),
    })),
  })

  const [staffRows, setStaffRows]           = useState<StaffRow[]>(() => version.staffingResources.map(toStaffRow))
  const [allRateCards, setAllRateCards]     = useState<RateCardItem[]>([])
  const [showAddRow, setShowAddRow]         = useState(false)
  const [editCell, setEditCell]             = useState<{ srId: string; wk: string } | null>(null)
  const [editVal, setEditVal]               = useState('')
  const [editRateCell, setEditRateCell]     = useState<{ srId: string; field: 'eff' | 'dp' } | null>(null)
  const [editRateVal, setEditRateVal]       = useState('')

  // ── Other Costs state ────────────────────────────────────────────
  const [otherCosts, setOtherCosts]     = useState<OtherCostRow[]>(() =>
    ((opp as any).otherCosts ?? []).map((oc: any) => ({
      id: oc.id,
      description: oc.description,
      amount: Number(oc.amount),
      markupPct: oc.markupPct != null ? Number(oc.markupPct) : null,
      isBillable: oc.isBillable ?? true,
      lineOfBusiness: oc.lineOfBusiness ?? null,
    }))
  )
  const [showAddCost, setShowAddCost]   = useState(false)
  const [newDesc, setNewDesc]           = useState('')
  const [newAmount, setNewAmount]       = useState('')
  const [newMarkup, setNewMarkup]       = useState('')
  const [newLob, setNewLob]             = useState<string>('')
  const [newBillable, setNewBillable]   = useState(true)
  const [editCostCell, setEditCostCell] = useState<{ id: string; field: 'markup' | 'billed' } | null>(null)
  const [editCostVal, setEditCostVal]   = useState('')

  // ── Dirty tracking — all edits stay local until Save & Close ────
  // tmp_ prefixed IDs are client-only; on save they get POSTed and assigned
  // real DB cuids. Existing rows that were edited go into the dirty Sets.
  const [dirtyStaffIds,   setDirtyStaffIds]   = useState<Set<string>>(() => new Set())
  const [deletedStaffIds, setDeletedStaffIds] = useState<Set<string>>(() => new Set())
  const [dirtyCostIds,    setDirtyCostIds]    = useState<Set<string>>(() => new Set())
  const [deletedCostIds,  setDeletedCostIds]  = useState<Set<string>>(() => new Set())
  const [saving,          setSaving]          = useState(false)
  const [discardConfirm,  setDiscardConfirm]  = useState(false)
  // 'block' = approval in progress, can't mark final. 'warn' = a prior pricing
  // is already approved (SOW_PENDING / SOW_SUBMITTED) — confirm overrides.
  const [markFinalConfirm, setMarkFinalConfirm] = useState<'block' | 'warn' | null>(null)

  // Version metrics recomputed from current local staffRows.
  const versionMetrics: ComputedMetrics = useMemo(() => computeFromRows(staffRows), [staffRows])

  const isDirty =
    staffRows.some(r => r.id.startsWith('tmp_')) ||
    otherCosts.some(c => c.id.startsWith('tmp_')) ||
    dirtyStaffIds.size > 0  || deletedStaffIds.size > 0 ||
    dirtyCostIds.size > 0   || deletedCostIds.size > 0

  useEffect(() => {
    if (sub === 'Efforts' && allRateCards.length === 0) {
      fetch('/api/rate-cards').then(r => r.json()).then(setAllRateCards).catch(() => {})
    }
  }, [sub, allRateCards.length])

  const weeks = useMemo(
    () => getWeekColumns(opp.startDate, opp.endDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [String(opp.startDate), String(opp.endDate)]
  )

  // ── All mutations below are LOCAL-ONLY until handleSaveAndClose runs ──
  // No fetches during editing — fixes the 5s interactive-tx timeout and lets
  // the user undo by closing without saving.

  function newTempId() { return `tmp_${crypto.randomUUID()}` }

  // ── Staffing callbacks (local) ───────────────────────────────────
  const addRow = useCallback((rc: RateCardItem) => {
    const id = newTempId()
    const fullWeek = 40 // default 100% utilization (5 days × 8h); edges prorated by in-window days
    const weekEntries  = weeks.map(w => ({ weekStartDate: weekKey(w), hours: proratedWeekHours(w, opp.startDate, opp.endDate, fullWeek) }))
    const newRow: StaffRow = {
      id,
      rateCardId: rc.id,
      resourceDesignation: rc.jobRole,
      potMem: null,
      location: rc.location,
      costRatePerHour: rc.costRatePerHour,
      systemBillRatePerHour: rc.billRatePerHour,
      domain: rc.domain ?? null,
      utilization: 100,
      effectiveBillRate: rc.billRatePerHour,
      isActive: true,
      isBillable: true,
      weeklyHours: weekEntries,
    }
    setStaffRows(prev => [...prev, newRow])
  }, [weeks])

  const removeRow = useCallback((srId: string) => {
    setStaffRows(prev => prev.filter(r => r.id !== srId))
    if (srId.startsWith('tmp_')) return
    setDeletedStaffIds(prev => new Set(prev).add(srId))
    setDirtyStaffIds(prev => {
      if (!prev.has(srId)) return prev
      const n = new Set(prev); n.delete(srId); return n
    })
  }, [])

  const commitHours = useCallback((srId: string, wk: string, val: string) => {
    const hours = Math.max(0, parseFloat(val) || 0)
    const workingDays = workingDaysInWindow(opp.startDate, opp.endDate)
    setStaffRows(prev => prev.map(r => {
      if (r.id !== srId) return r
      const existing = r.weeklyHours.find(w => w.weekStartDate === wk)
      const weeklyHours = existing
        ? r.weeklyHours.map(w => w.weekStartDate === wk ? { ...w, hours } : w)
        : [...r.weeklyHours, { weekStartDate: wk, hours }]
      // Reverse link: derive utilization from the manually-entered hours so the
      // Util % column stays in sync. util% = Σ hours / (workingDays × 8) × 100.
      const totalHrs = weeklyHours.reduce((s, w) => s + (w.hours || 0), 0)
      const utilization = workingDays > 0
        ? Math.round((totalHrs / (workingDays * 8)) * 100 * 100) / 100
        : null
      return { ...r, weeklyHours, utilization }
    }))
    setEditCell(null)
    if (!srId.startsWith('tmp_')) {
      setDirtyStaffIds(prev => prev.has(srId) ? prev : new Set(prev).add(srId))
    }
  }, [opp.startDate, opp.endDate])

  const commitEffectiveRate = useCallback((srId: string, val: string) => {
    setEditRateCell(null)
    const eff = parseFloat(val)
    if (isNaN(eff) || eff < 0) return
    setStaffRows(prev => prev.map(r => r.id === srId ? { ...r, effectiveBillRate: eff } : r))
    if (!srId.startsWith('tmp_')) {
      setDirtyStaffIds(prev => prev.has(srId) ? prev : new Set(prev).add(srId))
    }
  }, [])

  const commitDP = useCallback((srId: string, val: string) => {
    setEditRateCell(null)
    const dp = parseFloat(val)
    if (isNaN(dp)) return
    setStaffRows(prev => {
      const row = prev.find(r => r.id === srId)
      if (!row) return prev
      const sysRate = row.systemBillRatePerHour ?? 0
      const eff = sysRate * (1 + dp / 100)
      return prev.map(r => r.id === srId ? { ...r, effectiveBillRate: eff } : r)
    })
    if (!srId.startsWith('tmp_')) {
      setDirtyStaffIds(prev => prev.has(srId) ? prev : new Set(prev).add(srId))
    }
  }, [])

  const toggleRow = useCallback((srId: string, isActive: boolean) => {
    setStaffRows(prev => prev.map(r => r.id === srId ? { ...r, isActive } : r))
    if (!srId.startsWith('tmp_')) {
      setDirtyStaffIds(prev => prev.has(srId) ? prev : new Set(prev).add(srId))
    }
  }, [])

  const toggleStaffBillable = useCallback((srId: string, isBillable: boolean) => {
    setStaffRows(prev => prev.map(r => r.id === srId ? { ...r, isBillable } : r))
    if (!srId.startsWith('tmp_')) {
      setDirtyStaffIds(prev => prev.has(srId) ? prev : new Set(prev).add(srId))
    }
  }, [])

  const applyUtilization = useCallback((srId: string, util: number | null) => {
    const fullWeek = util != null ? (util / 100) * 40 : 0
    setStaffRows(prev => prev.map(r => {
      if (r.id !== srId) return r
      return {
        ...r,
        utilization: util,
        weeklyHours: util != null
          ? weeks.map(w => ({ weekStartDate: weekKey(w), hours: proratedWeekHours(w, opp.startDate, opp.endDate, fullWeek) }))
          : r.weeklyHours,
      }
    }))
    if (!srId.startsWith('tmp_')) {
      setDirtyStaffIds(prev => prev.has(srId) ? prev : new Set(prev).add(srId))
    }
  }, [weeks, opp.startDate, opp.endDate])

  // ── Other Cost callbacks (local) ─────────────────────────────────
  const addOtherCost = useCallback(() => {
    const amt = parseFloat(newAmount)
    if (!newDesc.trim() || isNaN(amt)) return
    const markupVal = newMarkup !== '' ? parseFloat(newMarkup) : null
    const id = newTempId()
    setOtherCosts(prev => [...prev, {
      id,
      description: newDesc.trim(),
      amount: amt,
      markupPct: markupVal,
      isBillable: newBillable,
      lineOfBusiness: newLob || null,
    }])
    setNewDesc('')
    setNewAmount('')
    setNewMarkup('')
    setNewLob('')
    setNewBillable(true)
    setShowAddCost(false)
  }, [newDesc, newAmount, newMarkup, newLob, newBillable])

  const toggleBillable = useCallback((costId: string, billable: boolean) => {
    setOtherCosts(prev => prev.map(oc => oc.id === costId ? { ...oc, isBillable: billable } : oc))
    if (!costId.startsWith('tmp_')) {
      setDirtyCostIds(prev => prev.has(costId) ? prev : new Set(prev).add(costId))
    }
  }, [])

  const commitMarkup = useCallback((costId: string, val: string) => {
    setEditCostCell(null)
    const pct = val === '' ? null : parseFloat(val)
    if (pct !== null && isNaN(pct)) return
    setOtherCosts(prev => prev.map(oc => oc.id === costId ? { ...oc, markupPct: pct } : oc))
    if (!costId.startsWith('tmp_')) {
      setDirtyCostIds(prev => prev.has(costId) ? prev : new Set(prev).add(costId))
    }
  }, [])

  const commitBilled = useCallback((costId: string, val: string) => {
    setEditCostCell(null)
    const billed = parseFloat(val)
    if (isNaN(billed)) return
    setOtherCosts(prev => {
      const oc = prev.find(r => r.id === costId)
      if (!oc || oc.amount === 0) return prev
      const pct = ((billed / oc.amount) - 1) * 100
      return prev.map(r => r.id === costId ? { ...r, markupPct: pct } : r)
    })
    if (!costId.startsWith('tmp_')) {
      setDirtyCostIds(prev => prev.has(costId) ? prev : new Set(prev).add(costId))
    }
  }, [])

  const removeOtherCost = useCallback((costId: string) => {
    setOtherCosts(prev => prev.filter(oc => oc.id !== costId))
    if (costId.startsWith('tmp_')) return
    setDeletedCostIds(prev => new Set(prev).add(costId))
    setDirtyCostIds(prev => {
      if (!prev.has(costId)) return prev
      const n = new Set(prev); n.delete(costId); return n
    })
  }, [])

  const updateLob = useCallback((costId: string, lineOfBusiness: string | null) => {
    setOtherCosts(prev => prev.map(oc => oc.id === costId ? { ...oc, lineOfBusiness } : oc))
    if (!costId.startsWith('tmp_')) {
      setDirtyCostIds(prev => prev.has(costId) ? prev : new Set(prev).add(costId))
    }
  }, [])

  // ── Aggregate flush to server ────────────────────────────────────
  // markFinal: also flip this version to isFinal:true in the final metrics PATCH.
  const handleSaveAndClose = useCallback(async (markFinal: boolean = false) => {
    if (saving || locked) return
    setSaving(true)
    try {
      // 1. DELETEs (parallel — no inter-dependency)
      const delOps: Promise<Response>[] = []
      deletedStaffIds.forEach(id =>
        delOps.push(fetch(`/api/pricing-versions/${version.id}/staffing/${id}`, { method: 'DELETE' })))
      deletedCostIds.forEach(id =>
        delOps.push(fetch(`/api/opportunities/${opp.opportunityId}/other-costs/${id}`, { method: 'DELETE' })))

      // 2. PATCHes for dirty existing rows (parallel)
      const patchOps: Promise<Response>[] = []
      dirtyStaffIds.forEach(id => {
        const row = staffRows.find(r => r.id === id)
        if (!row) return
        patchOps.push(fetch(`/api/pricing-versions/${version.id}/staffing/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            utilization:       row.utilization,
            effectiveBillRate: row.effectiveBillRate,
            isActive:          row.isActive,
            isBillable:        row.isBillable,
            potMem:            row.potMem,
            weekEntries:       row.weeklyHours,
          }),
        }))
      })
      dirtyCostIds.forEach(id => {
        const cost = otherCosts.find(c => c.id === id)
        if (!cost) return
        patchOps.push(fetch(`/api/opportunities/${opp.opportunityId}/other-costs/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isBillable:     cost.isBillable,
            markupPct:      cost.markupPct,
            lineOfBusiness: cost.lineOfBusiness,
          }),
        }))
      })

      await Promise.all([...delOps, ...patchOps])

      // 3. POSTs for new staffing rows (each is POST + PATCH; sequential to
      //    keep clear error attribution per row).
      for (const row of staffRows.filter(r => r.id.startsWith('tmp_'))) {
        if (!row.rateCardId) continue
        const post = await fetch(`/api/pricing-versions/${version.id}/staffing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rateCardId: row.rateCardId }),
        })
        if (!post.ok) throw new Error('Failed to add a staffing resource')
        const sr = await post.json()
        await fetch(`/api/pricing-versions/${version.id}/staffing/${sr.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            utilization:       row.utilization,
            effectiveBillRate: row.effectiveBillRate,
            isActive:          row.isActive,
            isBillable:        row.isBillable,
            potMem:            row.potMem,
            weekEntries:       row.weeklyHours,
          }),
        })
      }

      // 4. POSTs for new other costs (parallel — independent)
      await Promise.all(
        otherCosts.filter(c => c.id.startsWith('tmp_')).map(cost =>
          fetch(`/api/opportunities/${opp.opportunityId}/other-costs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description:    cost.description,
              amount:         cost.amount,
              markupPct:      cost.markupPct,
              lineOfBusiness: cost.lineOfBusiness,
            }),
          })
        )
      )

      // 5. PATCH the version with re-computed metrics
      const res = await fetch(`/api/pricing-versions/${version.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalHours:           versionMetrics.totalHours,
          totalCost:            versionMetrics.totalCost,
          proposedBillings:     versionMetrics.proposedBillings,
          grossMarginPct:       versionMetrics.grossMarginPct,
          offshorePct:          versionMetrics.offshorePct,
          effectiveRatePerHour: versionMetrics.effectiveRatePerHour,
          discountPremiumPct:   versionMetrics.discountPremiumPct,
          fte:                  computeFte(versionMetrics.totalHours, opp.startDate, opp.endDate),
          ...(markFinal ? { isFinal: true } : {}),
        }),
      })
      if (!res.ok) throw new Error('Failed to save pricing metrics')

      toast.success(markFinal ? 'Saved & marked as Final' : 'Saved')
      // Other costs are opportunity-level (not in the version GET the parent does
      // on close). Only when they actually changed do we ask the parent to re-sync
      // server data — this keeps the Efforts-only save/close path unchanged.
      const otherCostsChanged =
        deletedCostIds.size > 0 || dirtyCostIds.size > 0 || otherCosts.some(c => c.id.startsWith('tmp_'))
      if (otherCostsChanged) onOtherCostsChanged?.()
      onClose()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Save failed — please retry')
    } finally {
      setSaving(false)
    }
  }, [saving, locked, version.id, opp.opportunityId, deletedStaffIds, deletedCostIds, dirtyStaffIds, dirtyCostIds, staffRows, otherCosts, versionMetrics, onClose, onOtherCostsChanged])

  // ── Save & Mark Final — gated by stage ───────────────────────────
  const handleSaveAndMarkFinal = useCallback(() => {
    if (saving) return
    // Stages where the final pricing version is immutable:
    //  • APPROVAL_PENDING / SOW_REVIEW_PENDING — an approval is mid-flight
    //  • TO_BE_ARCHIVED — pricing AND SOW verification are both approved; the
    //    pricing is sealed and can no longer be changed.
    if (
      currentStage === 'APPROVAL_PENDING' ||
      currentStage === 'SOW_REVIEW_PENDING' ||
      currentStage === 'TO_BE_ARCHIVED'
    ) {
      setMarkFinalConfirm('block')
      return
    }
    if (currentStage === 'SOW_PENDING' || currentStage === 'SOW_SUBMITTED') {
      setMarkFinalConfirm('warn')
      return
    }
    // LEAD / PRICE_LINKING_PENDING / PRICE_LINKED — no prior approval to invalidate
    handleSaveAndClose(true)
  }, [saving, currentStage, handleSaveAndClose])

  // ── Close — prompt for confirmation if there are unsaved changes ──
  const requestClose = useCallback(() => {
    if (isDirty) setDiscardConfirm(true)
    else onClose()
  }, [isDirty, onClose])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') requestClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestClose])

  // ── Render ───────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
        onClick={requestClose}
      />

      {/* Top-anchored modal — leaves room below for native dropdown menus */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 px-4 sm:pt-8 sm:px-8">
        <div className="w-full max-w-6xl max-h-[80vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Modal header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                version.isFinal ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                P{version.versionNumber}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Pricing V{version.versionNumber}
                  {version.isFinal && (
                    <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      Final
                    </span>
                  )}
                </h2>
                {version.label && <p className="text-xs text-slate-400 italic">{version.label}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {locked && (
                <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                  </svg>
                  Approved · Read-only
                </span>
              )}
              {!locked && (
                <>
                  <button
                    onClick={() => handleSaveAndClose(false)}
                    disabled={!isDirty || saving}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-30" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                    {saving ? 'Saving…' : 'Save & Close'}
                  </button>
                  {!version.isFinal && (
                    <button
                      onClick={handleSaveAndMarkFinal}
                      disabled={saving}
                      title="Save current edits and mark this version as the final pricing"
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21z" />
                      </svg>
                      Save &amp; Mark as Final
                    </button>
                  )}
                </>
              )}
              <button
                onClick={requestClose}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Sub-tab bar */}
          <div className="flex border-b border-slate-200 px-6 shrink-0 overflow-x-auto">
            {SUB_TABS.map(t => {
              const dim = DIMMED.has(t)
              return (
                <button
                  key={t}
                  onClick={() => setSub(t)}
                  className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
                    sub === t
                      ? 'border-indigo-600 text-indigo-700 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  } ${dim ? 'opacity-30' : ''}`}
                >
                  {t}
                  {t === 'Efforts' && staffRows.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5">
                      {staffRows.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {sub === 'Basic Details' && (
              <TabBasicDetails
                version={version}
                opp={opp}
                versionMetrics={versionMetrics}
                otherCosts={otherCosts}
              />
            )}

            {sub === 'Efforts' && (
              <TabEfforts
                staffRows={staffRows}
                versionMetrics={versionMetrics}
                weeks={weeks}
                allRateCards={allRateCards}
                showAddRow={showAddRow}
                editCell={editCell}
                editVal={editVal}
                editRateCell={editRateCell}
                editRateVal={editRateVal}
                setShowAddRow={setShowAddRow}
                setEditCell={setEditCell}
                setEditVal={setEditVal}
                setEditRateCell={setEditRateCell}
                setEditRateVal={setEditRateVal}
                setStaffRows={setStaffRows}
                addRow={addRow}
                removeRow={removeRow}
                commitHours={commitHours}
                commitEffectiveRate={commitEffectiveRate}
                commitDP={commitDP}
                toggleRow={toggleRow}
                toggleStaffBillable={toggleStaffBillable}
                applyUtilization={applyUtilization}
                readOnly={locked}
              />
            )}

            {sub === 'Other Cost' && (
              <TabOtherCost
                otherCosts={otherCosts}
                showAddCost={showAddCost}
                newDesc={newDesc}
                newAmount={newAmount}
                newMarkup={newMarkup}
                newLob={newLob}
                newBillable={newBillable}
                editCostCell={editCostCell}
                editCostVal={editCostVal}
                setShowAddCost={setShowAddCost}
                setNewDesc={setNewDesc}
                setNewAmount={setNewAmount}
                setNewMarkup={setNewMarkup}
                setNewLob={setNewLob}
                setNewBillable={setNewBillable}
                setEditCostCell={setEditCostCell}
                setEditCostVal={setEditCostVal}
                addOtherCost={addOtherCost}
                removeOtherCost={removeOtherCost}
                toggleBillable={toggleBillable}
                updateLob={updateLob}
                commitMarkup={commitMarkup}
                commitBilled={commitBilled}
                readOnly={locked}
              />
            )}

            {sub === 'Financial' && (
              <TabFinancial
                staffRows={staffRows}
                otherCosts={otherCosts}
                opp={opp}
                version={version}
              />
            )}

            {sub === 'Schedule of Payments' && (
              <TabSoP
                staffRows={staffRows}
                otherCosts={otherCosts}
                opp={opp}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Save in-flight overlay (always visible during save) ── */}
      {saving && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 70,
          background: 'rgba(10,31,68,0.55)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', padding: '24px 32px',
            border: '1px solid #D6DCE8', borderRadius: 4,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            minWidth: 240,
          }}>
            <svg className="animate-spin" viewBox="0 0 24 24" width={26} height={26} style={{ color: '#005CD9' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} fill="none" strokeDasharray="40 100" strokeLinecap="round" />
            </svg>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 5, height: 5, background: '#005CD9', display: 'inline-block', transform: 'rotate(45deg)' }} />
              <span style={{
                fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
                fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase',
                color: '#001E96', fontWeight: 600,
              }}>Saving Pricing</span>
            </div>
            <p style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 12, color: '#7B7C7F', textAlign: 'center',
              lineHeight: 1.5, margin: 0, maxWidth: 260,
            }}>
              It may take a couple of seconds depending upon the size of the opportunity / time window.
            </p>
          </div>
        </div>
      )}

      {/* Mark-as-Final confirmation (block or warn) */}
      {markFinalConfirm === 'block' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {currentStage === 'TO_BE_ARCHIVED' ? 'Pricing is locked' : 'Approval in progress'}
              </h3>
            </div>
            <p className="text-sm text-slate-500">
              {currentStage === 'TO_BE_ARCHIVED'
                ? 'This engagement’s pricing and SOW have both been approved. The pricing version can no longer be changed.'
                : 'You can’t mark a different version as final while an approval is pending. Wait for the approver to decide, or withdraw the existing request first.'}
            </p>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setMarkFinalConfirm(null)}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      {markFinalConfirm === 'warn' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900">Reset pricing approval?</h3>
            </div>
            <p className="text-sm text-slate-500">
              A previous pricing version has already been approved. Marking this version as final will invalidate that approval — the requester will need to submit a fresh approval request.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setMarkFinalConfirm(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setMarkFinalConfirm(null); handleSaveAndClose(true) }}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
              >
                Yes, mark final
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard-changes confirm */}
      {discardConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-base font-bold text-slate-900">Discard unsaved changes?</h3>
            <p className="mt-2 text-sm text-slate-500">
              You have edits that haven&apos;t been saved. Closing will discard them.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setDiscardConfirm(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Keep editing
              </button>
              <button
                onClick={() => { setDiscardConfirm(false); onClose() }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
