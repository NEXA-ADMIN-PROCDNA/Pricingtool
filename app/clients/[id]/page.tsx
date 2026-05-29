import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getClientDetail } from '@/lib/db/clients'
import { Sidebar } from '@/components/layout/Sidebar'

export const dynamic = 'force-dynamic'

const INDUSTRY_COLORS: Record<string, { gradient: string; badge: string; text: string }> = {
  Pharmaceuticals:      { gradient: 'from-blue-400 to-blue-600',    badge: 'bg-blue-50',    text: 'text-blue-700'    },
  'Financial Services': { gradient: 'from-emerald-400 to-emerald-600', badge: 'bg-emerald-50', text: 'text-emerald-700' },
  Biotechnology:        { gradient: 'from-violet-400 to-violet-600', badge: 'bg-violet-50',  text: 'text-violet-700'  },
  Technology:           { gradient: 'from-cyan-400 to-cyan-600',     badge: 'bg-cyan-50',    text: 'text-cyan-700'    },
  Healthcare:           { gradient: 'from-pink-400 to-pink-600',     badge: 'bg-pink-50',    text: 'text-pink-700'    },
}

function getColors(industry?: string | null) {
  return (industry && INDUSTRY_COLORS[industry]) || { gradient: 'from-indigo-400 to-indigo-600', badge: 'bg-indigo-50', text: 'text-indigo-700' }
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function fmtRevenue(billings: number | null | undefined, estimated: number | null | undefined) {
  const n = billings ?? estimated ?? 0
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  OPEN:      { bg: 'bg-blue-50',   text: 'text-blue-800',   dot: 'bg-blue-500'   },
  WON:       { bg: 'bg-green-50',  text: 'text-green-800',  dot: 'bg-green-500'  },
  LOST:      { bg: 'bg-red-50',    text: 'text-red-800',    dot: 'bg-red-500'    },
  ABANDONED: { bg: 'bg-slate-100', text: 'text-slate-600',  dot: 'bg-slate-400'  },
  ARCHIVED:  { bg: 'bg-slate-100', text: 'text-slate-600',  dot: 'bg-slate-400'  },
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const client = await getClientDetail(id)
  if (!client) notFound()

  const colors  = getColors(client.industry)
  const open    = client.opportunities.filter(o => o.status === 'OPEN').length
  const won     = client.opportunities.filter(o => o.status === 'WON').length
  const totalRev = client.opportunities.reduce((sum, o) => {
    const n = o.pricingVersions[0]?.proposedBillings ?? o.estimatedRevenue ?? 0
    return sum + Number(n)
  }, 0)

  function fmtTotal(n: number) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
    return n ? `$${n}` : '—'
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 flex-col min-w-0">

        {/* Header */}
        <header className="shrink-0 border-b border-slate-200 bg-white px-8 py-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-3 font-mono">
            <Link href="/clients" className="hover:text-indigo-600 transition-colors">Client Master</Link>
            <span>/</span>
            <span className="text-indigo-600">{client.clientId}</span>
          </div>

          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colors.gradient} text-white font-bold text-lg shadow-md`}>
              {initials(client.name)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
                <span className="font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{client.clientId}</span>
                {client.industry && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full uppercase tracking-wide ${colors.badge} ${colors.text}`}>
                    {client.industry}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                {client.region && <span>🌐 {client.region}</span>}
                {client.businessUnit && <span>· {client.businessUnit}</span>}
              </div>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-6">

          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Total Deals',   value: client.opportunities.length },
              { label: 'Open',          value: open },
              { label: 'Won',           value: won  },
              { label: 'Pipeline Rev.', value: fmtTotal(totalRev) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-white border border-slate-200 px-5 py-4">
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-xs text-slate-500 uppercase tracking-wide mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

            {/* Opportunities table — takes 2/3 width */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Opportunities</h2>
                <span className="text-xs text-slate-400 font-mono">{client.opportunities.length} total</span>
              </div>

              {client.opportunities.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">No opportunities yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['BD ID', 'Name', 'Owner', 'Revenue', 'Status'].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {client.opportunities.map(opp => {
                        const ss = STATUS_STYLE[opp.status] ?? STATUS_STYLE.OPEN
                        const rev = fmtRevenue(
                          opp.pricingVersions[0]?.proposedBillings != null
                            ? Number(opp.pricingVersions[0].proposedBillings)
                            : null,
                          opp.estimatedRevenue != null ? Number(opp.estimatedRevenue) : null,
                        )
                        return (
                          <tr
                            key={opp.id}
                            className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-5 py-3 whitespace-nowrap">
                              <Link
                                href={`/opportunities/${opp.opportunityId}`}
                                className="font-mono text-xs text-indigo-600 hover:underline"
                              >
                                {opp.opportunityId}
                              </Link>
                            </td>
                            <td className="px-5 py-3 max-w-[200px]">
                              <Link
                                href={`/opportunities/${opp.opportunityId}`}
                                className="text-slate-800 font-medium hover:text-indigo-600 transition-colors truncate block"
                              >
                                {opp.opportunityName}
                              </Link>
                            </td>
                            <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{opp.owner.name}</td>
                            <td className="px-5 py-3 font-mono text-slate-700 whitespace-nowrap">{rev}</td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${ss.bg} ${ss.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />
                                {opp.status.charAt(0) + opp.status.slice(1).toLowerCase()}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* POCs — takes 1/3 width */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Contacts</h2>
                <span className="text-xs text-slate-400 font-mono">{client.pocs.length} POC{client.pocs.length !== 1 ? 's' : ''}</span>
              </div>

              {client.pocs.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">No contacts on file.</div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {client.pocs.map(poc => (
                    <div key={poc.id} className="px-6 py-4 flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold text-xs">
                        {initials(poc.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-800 text-sm">{poc.name}</p>
                        {poc.jobTitle && (
                          <p className="text-xs text-slate-400 mt-0.5">{poc.jobTitle}</p>
                        )}
                        {poc.email && (
                          <a href={`mailto:${poc.email}`} className="text-xs text-indigo-500 hover:underline mt-0.5 block truncate">
                            {poc.email}
                          </a>
                        )}
                        {poc.phone && (
                          <p className="text-xs text-slate-400 mt-0.5">{poc.phone}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
