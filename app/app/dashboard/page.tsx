import { Suspense } from 'react'
import Link from 'next/link'
import { MainLayout } from '@/components/layout/MainLayout'
import { getOpportunities, getDashboardStats } from '@/lib/db/opportunities'
import { OpportunityTable } from './OpportunityTable'
import { OpportunityStatus } from '@prisma/client'

function KPICard({
  label, value, sub, gradient, icon,
}: {
  label: string
  value: string
  sub?: string
  gradient: string
  icon: React.ReactNode
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-lg ${gradient}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{label}</p>
          <p className="mt-1.5 text-3xl font-bold tracking-tight">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-white/60">{sub}</p>}
        </div>
        <div className="rounded-xl bg-white/15 p-2.5">{icon}</div>
      </div>
      {/* decorative circle */}
      <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/10" />
    </div>
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

  function fmt(n: number) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
    return `$${n}`
  }

  return (
    <MainLayout
      title="BD Tracker"
      action={
        <Link
          href="/opportunities/new"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Opportunity
        </Link>
      }
    >
      {/* KPI row */}
      <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <KPICard
          label="Estimated Revenue"
          value={fmt(stats.estimatedRevenue)}
          sub="final pricing · or est. × probability"
          gradient="bg-gradient-to-br from-indigo-500 to-indigo-700"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <KPICard
          label="Open"
          value={String(stats.open)}
          sub={`of ${stats.total} total opportunities`}
          gradient="bg-gradient-to-br from-blue-500 to-blue-700"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
            </svg>
          }
        />
        <KPICard
          label="Won"
          value={String(stats.won)}
          sub={`${stats.lost} lost this period`}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
      </div>

      {/* Table — grows to fill remaining height */}
      <Suspense fallback={<div className="flex-1 animate-pulse rounded-2xl bg-slate-100" />}>
        <OpportunityTable rows={rows} />
      </Suspense>
    </MainLayout>
  )
}
