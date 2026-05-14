'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { OpportunityRow } from '@/lib/db/opportunities'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { OpportunityStatus } from '@prisma/client'
import { STAGE_NEXT_STEPS } from '@/lib/stageNextSteps'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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

function fmtRevenue(row: OpportunityRow) {
  const n = row.pricingVersions[0]?.proposedBillings != null
    ? Number(row.pricingVersions[0].proposedBillings)
    : Number(row.estimatedRevenue ?? 0)
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function hasFinalPricing(row: OpportunityRow) {
  return row.pricingVersions.length > 0 && row.pricingVersions[0]?.proposedBillings != null
}

export function OpportunityTable({ rows }: { rows: OpportunityRow[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const active = (params.get('status') ?? 'ALL') as 'ALL' | OpportunityStatus

  function setFilter(value: string) {
    router.push(value === 'ALL' ? '/dashboard' : `/dashboard?status=${value}`)
  }

  const visible = active === 'ALL' ? rows : rows.filter(r => r.status === active)

  return (
    <div className="flex flex-1 flex-col gap-0 min-h-0">
      {/* Tab-style filter strip */}
      <div className="flex border-b border-border shrink-0 bg-white">
        {STATUS_FILTERS.map(f => {
          const count = f.value === 'ALL'
            ? rows.length
            : rows.filter(r => r.status === f.value).length
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                active === f.value
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {f.label}
              <span className={`ml-1.5 text-xs tabular-nums ${
                active === f.value ? 'text-indigo-400' : 'text-muted-foreground'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Table card */}
      <div className="flex flex-1 flex-col rounded-b-xl border border-t-0 border-border bg-white shadow-sm overflow-hidden min-h-0">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-24">ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Comments</TableHead>
                <TableHead>Next Steps</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-16 text-center text-muted-foreground">
                    No opportunities found.
                  </TableCell>
                </TableRow>
              )}
              {visible.map(row => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/opportunities/${row.opportunityId}`)}
                >
                  {/* ID */}
                  <TableCell>
                    <Link
                      href={`/opportunities/${row.opportunityId}`}
                      className="font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      onClick={e => e.stopPropagation()}
                    >
                      {row.opportunityId}
                    </Link>
                  </TableCell>

                  {/* Client */}
                  <TableCell className="font-medium text-foreground whitespace-nowrap">
                    {row.client.name}
                  </TableCell>

                  {/* Project */}
                  <TableCell className="max-w-[180px]">
                    <p className="truncate text-sm text-foreground">{row.opportunityName}</p>
                  </TableCell>

                  {/* Owner */}
                  <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                    {row.owner.name}
                  </TableCell>

                  {/* Revenue */}
                  <TableCell className="whitespace-nowrap tabular-nums text-sm font-medium">
                    <span className={hasFinalPricing(row) ? 'text-emerald-700' : 'text-foreground'}>
                      {fmtRevenue(row)}
                    </span>
                    {hasFinalPricing(row) && (
                      <span className="ml-1.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded px-1 py-0.5">
                        FINAL
                      </span>
                    )}
                  </TableCell>

                  {/* Start */}
                  <TableCell className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
                    {fmtDate(row.startDate)}
                  </TableCell>

                  {/* End */}
                  <TableCell className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
                    {fmtDate(row.endDate)}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="whitespace-nowrap">
                    <StatusBadge status={row.status} />
                  </TableCell>

                  {/* Comments */}
                  <TableCell className="text-center">
                    {row._count.comments > 0 ? (
                      <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-muted text-xs font-semibold text-muted-foreground px-1.5">
                        {row._count.comments}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/30 text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Next Steps */}
                  <TableCell className="max-w-[160px]">
                    <p className="truncate text-muted-foreground text-xs">
                      {STAGE_NEXT_STEPS[row.stage]}
                    </p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground shrink-0">
          {visible.length} {visible.length === 1 ? 'opportunity' : 'opportunities'}
          {active !== 'ALL' && ` · filtered by ${active.toLowerCase()}`}
        </div>
      </div>
    </div>
  )
}
