// app/opportunities/[id]/page.tsx — opportunity DETAIL page (server component).
// Big picture: server-side it loads the session, fetches the RBAC-scoped opportunity
// detail (getOpportunityDetail applies the owner filter) + the user list, 404s if it's
// not found/visible, and hands everything to the client <OpportunityTabs>. force-dynamic
// so it never statically caches per-user data.
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MainLayout } from '@/components/layout/MainLayout'

export const dynamic = 'force-dynamic'
import { getOpportunityDetail } from '@/lib/db/opportunities'
import { getUsersForSelect } from '@/lib/db/users'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StageBadge } from '@/components/ui/StageBadge'
import { OpportunityTabs } from './OpportunityTabs'
import { SharepointLink } from './SharepointLink'

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session     = await getServerSession(authOptions)
  const sessionUser = session?.user as { id?: string; role?: string } | undefined
  const auth        = sessionUser?.id && sessionUser?.role
    ? { userId: sessionUser.id, role: sessionUser.role }
    : undefined

  const [opp, users] = await Promise.all([
    getOpportunityDetail(id, auth),
    getUsersForSelect(),
  ])
  if (!opp) notFound()

  return (
    <MainLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 shrink-0">
        <Link href="/dashboard" className="hover:text-indigo-600 transition-colors">Nexa</Link>
        <span>/</span>
        <span className="font-mono text-indigo-600">{opp.opportunityId}</span>
      </div>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6 shrink-0">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{opp.opportunityName}</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {opp.client.name} · {opp.opportunityId} · Owner: {opp.owner.name}
          </p>
          <SharepointLink
            opportunityId={opp.opportunityId}
            ownerId={opp.owner.id}
            coOwnerId={(opp as any).coOwnerId}
            initialUrl={(opp as any).sharepointUrl}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={opp.status} />
          <StageBadge  stage={opp.stage}   />
        </div>
      </div>

      {/* Tab content fills remaining space */}
      <div className="flex-1 overflow-y-auto">
        <OpportunityTabs opp={opp} users={users} />
      </div>
    </MainLayout>
  )
}
