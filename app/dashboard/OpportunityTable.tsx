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

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

const HEADERS = [
  'ID', 'Client', 'Project Name', 'Creator', 'Co-owner',
  'Start', 'End', 'Status', 'Others', '💬Comments', 'Next Steps',
]

export function OpportunityTable({ rows }: { rows: OpportunityRow[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const active = (params.get('status') ?? 'ALL') as 'ALL' | OpportunityStatus

  function setFilter(value: string) {
    router.push(value === 'ALL' ? '/dashboard' : `/dashboard?status=${value}`)
  }

  const visible = active === 'ALL' ? rows : rows.filter(r => r.status === active)

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0">
      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {STATUS_FILTERS.map(f => {
          const count = f.value === 'ALL'
            ? rows.length
            : rows.filter(r => r.status === f.value).length
          return (
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
              <span className={`ml-1.5 text-xs ${active === f.value ? 'text-indigo-200' : 'text-slate-400'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Table card */}
      <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-0">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {HEADERS.map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={HEADERS.length} className="py-16 text-center text-slate-400 text-sm">
                    No opportunities found.
                  </td>
                </tr>
              )}
              {visible.map(row => (
                <tr
                  key={row.id}
                  className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                  onClick={() => router.push(`/opportunities/${row.opportunityId}`)}
                >
                  {/* ID */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <Link
                      href={`/opportunities/${row.opportunityId}`}
                      className="font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      onClick={e => e.stopPropagation()}
                    >
                      {row.opportunityId}
                    </Link>
                  </td>

                  {/* Client */}
                  <td className="px-4 py-3.5 font-medium text-slate-800 whitespace-nowrap">
                    {row.client.name}
                  </td>

                  {/* Project Name */}
                  <td className="px-4 py-3.5 max-w-[180px]">
                    <p className="truncate text-slate-700">{row.opportunityName}</p>
                  </td>

                  {/* Creator (owner) */}
                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 text-sm">
                    {row.owner.name}
                  </td>

                  {/* Co-owner */}
                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-500 text-sm">
                    {row.coOwner?.name ?? <span className="text-slate-300">—</span>}
                  </td>

                  {/* Start date */}
                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-500 text-xs tabular-nums">
                    {fmtDate(row.startDate)}
                  </td>

                  {/* End date */}
                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-500 text-xs tabular-nums">
                    {fmtDate(row.endDate)}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <StatusBadge status={row.status} />
                  </td>

                  {/* Others — Stage + LOB at a glance */}
                  <td className="px-4 py-3.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <div className="flex flex-col gap-1">
                      <StageBadge stage={row.stage} />
                      <LOBBadge   lob={row.primaryLob} />
                    </div>
                  </td>

                  {/* Comments */}
                  <td className="px-4 py-3.5 text-center">
                    {row._count.comments > 0 ? (
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {row._count.comments}
                      </span>
                    ) : (
                      <span className="text-slate-200 text-xs">—</span>
                    )}
                  </td>

                  {/* Next Steps */}
                  <td className="px-4 py-3.5 max-w-[160px]">
                    <p className="truncate text-slate-500 text-xs">{row.nextSteps ?? '—'}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-500 shrink-0">
          {visible.length} {visible.length === 1 ? 'opportunity' : 'opportunities'}
          {active !== 'ALL' && ` · filtered by ${active}`}
        </div>
      </div>
    </div>
  )
}
