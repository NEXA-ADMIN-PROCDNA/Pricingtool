const config: Record<string, { label: string; classes: string }> = {
  LEAD:                  { label: 'Lead',              classes: 'bg-slate-100 text-slate-600'   },
  PRICE_LINKING_PENDING: { label: 'Price Linking',     classes: 'bg-blue-50 text-blue-700'      },
  PRICE_LINKED:          { label: 'Price Linked',      classes: 'bg-indigo-50 text-indigo-700'  },
  APPROVAL_PENDING:      { label: 'Approval Pending',  classes: 'bg-amber-50 text-amber-700'    },
  SOW_PENDING:           { label: 'SOW Pending',       classes: 'bg-orange-50 text-orange-700'  },
  SOW_SUBMITTED:         { label: 'SOW Submitted',     classes: 'bg-violet-50 text-violet-700'  },
  SOW_REVIEW_PENDING:    { label: 'SOW Under Review',  classes: 'bg-purple-50 text-purple-700'  },
  TO_BE_ARCHIVED:        { label: 'Archiving',         classes: 'bg-emerald-50 text-emerald-700'},
}

export function StageBadge({ stage }: { stage: string }) {
  const cfg = config[stage] ?? { label: stage, classes: 'bg-slate-100 text-slate-500' }
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${cfg.classes}`}>
      {cfg.label}
    </span>
  )
}

export const STAGE_ORDER = [
  'LEAD',
  'PRICE_LINKING_PENDING',
  'PRICE_LINKED',
  'APPROVAL_PENDING',
  'SOW_PENDING',
  'SOW_SUBMITTED',
  'SOW_REVIEW_PENDING',
  'TO_BE_ARCHIVED',
]

export function StageProgress({ stage }: { stage: string }) {
  const idx = STAGE_ORDER.indexOf(stage)
  const pct = idx === -1 ? 0 : Math.round(((idx + 1) / STAGE_ORDER.length) * 100)
  const cfg = config[stage] ?? { label: stage, classes: '' }
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{cfg.label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
