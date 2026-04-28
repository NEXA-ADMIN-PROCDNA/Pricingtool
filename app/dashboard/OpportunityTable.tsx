'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { OpportunityRow } from '@/lib/db/opportunities'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StageBadge } from '@/components/ui/StageBadge'
import { LOBBadge } from '@/components/ui/LOBBadge'
import { OpportunityStatus } from '@prisma/client'

const STATUS_FILTERS: { label: string; value: 'ALL' | OpportunityStatus }[] = [
  { label: 'All',       value: 'ALL'      },
  { label: 'Open',      value: 'OPEN'     },
  { label: 'Won',       value: 'WON'      },
  { label: 'Lost',      value: 'LOST'     },
  { label: 'Abandoned', value: 'ABANDONED'},
  { label: 'Archived',  value: 'ARCHIVED' },
]

function fmt(n: number | null | undefined) {
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return '—'
  return `${Number(n).toFixed(1)}%`
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function OpportunityTable({ rows }: { rows: OpportunityRow[] }) {
  const router = useRouter()
  const params  = useSearchParams()
  const active  = (params.get('status') ?? 'ALL') as 'ALL' | OpportunityStatus

  function setFilter(value: string) {
    const q = value === 'ALL' ? '/dashboard' : `/dashboard?status=${value}`
    router.push(q)
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              active === f.value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 ring-1 ring-slate-200'
            }`}
          >
            {f.label}
            {f.value !== 'ALL' && (
              <span className={`ml-1.5 text-xs ${active === f.value ? 'text-indigo-200' : 'text-slate-400'}`}>
                {rows.filter(r => f.value === 'ALL' || r.status === f.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['BD ID','Client','Project Name','LOB','Stage','Owner','Value','Margin','Status','Next Steps','💬'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-slate-400 text-sm">
                    No opportunities found.
                  </td>
                </tr>
              )}
              {rows.map(row => {
                const final = row.pricingVersions[0]
                return (
                  <tr
                    key={row.id}
                    className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                    onClick={() => router.push(`/opportunities/${row.opportunityId}`)}
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <Link
                        href={`/opportunities/${row.opportunityId}`}
                        className="font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        onClick={e => e.stopPropagation()}
                      >
                        {row.opportunityId}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-800 whitespace-nowrap">
                      {row.client.name}
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <p className="truncate text-slate-700">{row.opportunityName}</p>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <LOBBadge lob={row.primaryLob} />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <StageBadge stage={row.stage} />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">
                      {row.owner.name}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap font-medium text-slate-800">
                      {fmt(final ? Number(final.proposedBillings) : null)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {final?.grossMarginPct != null ? (
                        <span className={`font-semibold ${Number(final.grossMarginPct) >= 35 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {fmtPct(Number(final.grossMarginPct))}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <p className="truncate text-slate-500 text-xs">{row.nextSteps ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {row._count.comments > 0 && (
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {row._count.comments}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
          {rows.length} {rows.length === 1 ? 'opportunity' : 'opportunities'}
        </div>
      </div>
    </div>
  )
}
