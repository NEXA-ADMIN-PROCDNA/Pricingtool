import { OpportunityStatus } from '@prisma/client'

const config: Record<OpportunityStatus, { label: string; classes: string; dot: string }> = {
  OPEN:      { label: 'Open',      dot: 'bg-blue-400',    classes: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'      },
  WON:       { label: 'Won',       dot: 'bg-emerald-400', classes: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  LOST:      { label: 'Lost',      dot: 'bg-red-400',     classes: 'bg-red-50 text-red-700 ring-1 ring-red-200'          },
  ABANDONED: { label: 'Abandoned', dot: 'bg-amber-400',   classes: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'    },
  ARCHIVED:  { label: 'Archived',  dot: 'bg-slate-400',   classes: 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'    },
}

export function StatusBadge({ status }: { status: OpportunityStatus }) {
  const { label, classes, dot } = config[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}
