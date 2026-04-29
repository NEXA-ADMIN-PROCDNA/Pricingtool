import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MainLayout } from '@/components/layout/MainLayout'
import { getOpportunityDetail } from '@/lib/db/opportunities'
import { getUsersForSelect } from '@/lib/db/users'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StageBadge } from '@/components/ui/StageBadge'
import { LOBBadge } from '@/components/ui/LOBBadge'
import { OpportunityTabs } from './OpportunityTabs'

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [opp, users] = await Promise.all([
    getOpportunityDetail(id),
    getUsersForSelect(),
  ])
  if (!opp) notFound()

  return (
    <MainLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 shrink-0">
        <Link href="/dashboard" className="hover:text-indigo-600 transition-colors">BD Tracker</Link>
        <span>/</span>
        <span className="font-mono text-indigo-600">{opp.opportunityId}</span>
      </div>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6 shrink-0">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{opp.opportunityName}</h1>
            {opp.starConnect && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                ⭐ Star Connect
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {opp.client.name} · {opp.opportunityId} · Owner: {opp.owner.name}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={opp.status} />
          <StageBadge  stage={opp.stage}   />
          <LOBBadge    lob={opp.primaryLob} />
        </div>
      </div>

      {/* Tab content fills remaining space */}
      <div className="flex-1 overflow-y-auto">
        <OpportunityTabs opp={opp} users={users} />
      </div>
    </MainLayout>
  )
}
