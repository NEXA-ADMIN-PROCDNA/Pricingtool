'use server'
import { Suspense } from 'react'
import Link from 'next/link'
import { MainLayout } from '@/components/layout/MainLayout'
import { getOpportunities, getDashboardStats } from '@/lib/db/opportunities'
import { OpportunityTable } from './OpportunityTable'
import { OpportunityStatus } from '@prisma/client'
import { Card, CardContent } from '@/components/ui/card'

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function KPICard({
  label, value, sub, iconBg, icon,
}: {
  label: string
  value: string
  sub?: string
  iconBg: string
  icon: React.ReactNode
}) {
  return (
    <Card className="border border-border shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`shrink-0 rounded-lg p-2.5 ${iconBg}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

const VALID_STATUS = new Set<string>(['OPEN','WON','LOST','ABANDONED','ARCHIVED'])

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: rawStatus } = await searchParams
  const status = rawStatus && VALID_STATUS.has(rawStatus)
    ? (rawStatus as OpportunityStatus)
    : undefined

  const [rows, stats] = await Promise.all([
    getOpportunities(status ?? 'ALL'),
    getDashboardStats(),
  ])

  return (
    <MainLayout
      title="BD Tracker"
      action={
        <Link
          href="/opportunities/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Opportunity
        </Link>
      }
    >
      {/* KPI row */}
      <div className="grid shrink-0 grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <KPICard
          label="Pipeline Revenue"
          value={fmt(stats.estimatedRevenue)}
          sub="Final pricing or est. revenue"
          iconBg="bg-indigo-50 text-indigo-600"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <KPICard
          label="Weighted Revenue"
          value={fmt(stats.weightedRevenue)}
          sub="Revenue × win probability"
          iconBg="bg-violet-50 text-violet-600"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          }
        />
        <KPICard
          label="Open Opportunities"
          value={String(stats.open)}
          sub={`of ${stats.total} total`}
          iconBg="bg-sky-50 text-sky-600"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
            </svg>
          }
        />
        <KPICard
          label="Won"
          value={String(stats.won)}
          sub={`${stats.lost} lost · ${stats.total > 0 ? Math.round((stats.won / stats.total) * 100) : 0}% win rate`}
          iconBg="bg-emerald-50 text-emerald-600"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
      </div>

      {/* Table */}
      <Suspense fallback={<div className="flex-1 animate-pulse rounded-xl bg-muted" />}>
        <OpportunityTable rows={rows} />
      </Suspense>
    </MainLayout>
  )
}
