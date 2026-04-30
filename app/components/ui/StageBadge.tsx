import { OpportunityStage } from '@prisma/client'

const config: Record<OpportunityStage, { label: string; classes: string }> = {
  LEAD:          { label: 'Lead',          classes: 'bg-slate-100 text-slate-600'    },
  QUALIFICATION: { label: 'Qualification', classes: 'bg-yellow-50 text-yellow-700'  },
  PROPOSAL:      { label: 'Proposal',      classes: 'bg-blue-50 text-blue-700'      },
  SOW_SUBMITTED: { label: 'SOW Submitted', classes: 'bg-orange-50 text-orange-700'  },
  SOW_SIGNED:    { label: 'SOW Signed',    classes: 'bg-purple-50 text-purple-700'  },
  PO_RECEIVED:   { label: 'PO Received',   classes: 'bg-indigo-50 text-indigo-700'  },
  CLOSED_WON:    { label: 'Closed Won',    classes: 'bg-emerald-50 text-emerald-700'},
  CLOSED_LOST:   { label: 'Closed Lost',   classes: 'bg-red-50 text-red-600'        },
}

export function StageBadge({ stage }: { stage: OpportunityStage }) {
  const { label, classes } = config[stage]
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  )
}

// Ordered stages for progress bar
export const STAGE_ORDER: OpportunityStage[] = [
  'LEAD', 'QUALIFICATION', 'PROPOSAL', 'SOW_SUBMITTED',
  'SOW_SIGNED', 'PO_RECEIVED', 'CLOSED_WON',
]

export function StageProgress({ stage }: { stage: OpportunityStage }) {
  if (stage === 'CLOSED_LOST') {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-red-200" />
        <span className="text-xs text-red-600 font-medium">Closed Lost</span>
      </div>
    )
  }
  const idx = STAGE_ORDER.indexOf(stage)
  const pct = idx === -1 ? 0 : Math.round(((idx + 1) / STAGE_ORDER.length) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{config[stage]?.label}</span>
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
