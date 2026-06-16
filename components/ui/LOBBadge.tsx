// ui/LOBBadge.tsx — colored pill for a Line of Business (Tech/Analytics/MS/DS/Design/Auxo).
// Maps each LoB enum value to a label + colour classes.
const config: Record<string, { label: string; classes: string }> = {
  TECH:      { label: 'Technology',       classes: 'bg-cyan-50 text-cyan-700'     },
  ANALYTICS: { label: 'Analytics',        classes: 'bg-violet-50 text-violet-700' },
  MS:        { label: 'Managed Services', classes: 'bg-teal-50 text-teal-700'     },
  DS:        { label: 'Data Science',     classes: 'bg-pink-50 text-pink-700'     },
  DESIGN:    { label: 'Design',           classes: 'bg-slate-100 text-slate-600'  },
  AUXO:      { label: 'Auxo',             classes: 'bg-orange-50 text-orange-700' },
}

export function LOBBadge({ lob }: { lob: string | null | undefined }) {
  if (!lob) {
    return (
      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-400 italic">
        Unassigned
      </span>
    )
  }
  const { label, classes } = config[lob] ?? { label: lob, classes: 'bg-slate-100 text-slate-600' }
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  )
}
