import { LineOfBusiness } from '@prisma/client'

const config: Record<LineOfBusiness, { label: string; classes: string }> = {
  TECH:      { label: 'Tech',      classes: 'bg-cyan-50 text-cyan-700'     },
  ANALYTICS: { label: 'Analytics', classes: 'bg-violet-50 text-violet-700' },
  MS:        { label: 'MS',        classes: 'bg-teal-50 text-teal-700'     },
  DS:        { label: 'DS',        classes: 'bg-pink-50 text-pink-700'     },
  OTHERS:    { label: 'Others',    classes: 'bg-slate-100 text-slate-600'  },
}

export function LOBBadge({ lob }: { lob: LineOfBusiness }) {
  const { label, classes } = config[lob]
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  )
}
