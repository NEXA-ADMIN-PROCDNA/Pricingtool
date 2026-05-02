import { getClients } from '@/lib/db/clients'
import { Sidebar } from '@/components/layout/Sidebar'
import { AddClientModal } from './AddClientModal'
import { AdminRequestsPanel } from './AdminRequestsPanel'

function initial(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

const INDUSTRY_COLORS: Record<string, string> = {
  Pharmaceuticals:     'from-blue-400 to-blue-600',
  'Financial Services':'from-emerald-400 to-emerald-600',
  Biotechnology:       'from-violet-400 to-violet-600',
  Technology:          'from-cyan-400 to-cyan-600',
  Healthcare:          'from-pink-400 to-pink-600',
}

function getGradient(industry?: string | null) {
  return (industry && INDUSTRY_COLORS[industry]) ?? 'from-indigo-400 to-indigo-600'
}

export default async function ClientsPage() {
  const clients = await getClients()

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      {/* Right panel — header fixed, content scrolls */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* Sticky header */}
        <header className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
          <h1 className="text-xl font-bold text-slate-900">Client Master</h1>
          <AddClientModal />
        </header>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">

          {/* Admin pending requests */}
          <AdminRequestsPanel />

          {/* Stats strip */}
          <div className="mb-6 flex flex-wrap items-center gap-4">
            {[
              {
                label: 'Total Clients',
                value: clients.length,
                color: 'bg-indigo-50',
                stroke: '#6366f1',
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />,
              },
              {
                label: 'Total Opportunities',
                value: clients.reduce((s, c) => s + c._count.opportunities, 0),
                color: 'bg-emerald-50',
                stroke: '#10b981',
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />,
              },
              {
                label: 'POC Contacts',
                value: clients.reduce((s, c) => s + c.pocs.length, 0),
                color: 'bg-blue-50',
                stroke: '#3b82f6',
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />,
              },
            ].map(({ label, value, color, stroke, icon }) => (
              <div key={label} className="rounded-xl bg-white border border-slate-200 px-5 py-3 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg ${color} flex items-center justify-center`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.8} className="w-5 h-5">
                    {icon}
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Client cards grid */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {clients.map(client => (
              <div
                key={client.id}
                className="group relative rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden"
              >
                <div className={`h-1.5 w-full bg-gradient-to-r ${getGradient(client.industry)}`} />
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${getGradient(client.industry)} text-white font-bold text-sm shadow-md`}>
                      {initial(client.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">{client.name}</p>
                      <p className="text-xs text-indigo-600 font-mono">{client.clientId}</p>
                      {client.industry && (
                        <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                          {client.industry}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                      <p className="text-xl font-bold text-slate-900">{client._count.opportunities}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">Deals</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                      <p className="text-xl font-bold text-slate-900">{client.pocs.length}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">Contacts</p>
                    </div>
                  </div>

                  {client.pocs.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {client.pocs.slice(0, 2).map(poc => (
                        <div key={poc.id} className="flex items-center gap-2 text-xs text-slate-500">
                          <div className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0">
                            {initial(poc.name)}
                          </div>
                          <span className="truncate">{poc.name}</span>
                          {poc.jobTitle && <span className="text-slate-400">· {poc.jobTitle}</span>}
                        </div>
                      ))}
                      {client.pocs.length > 2 && (
                        <p className="text-[10px] text-slate-400 pl-7">+{client.pocs.length - 2} more</p>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-3 text-[10px] text-slate-400 uppercase tracking-wide">
                    {client.region && <span>🌐 {client.region}</span>}
                    {client.businessUnit && <span>· {client.businessUnit}</span>}
                  </div>
                </div>
              </div>
            ))}

            {clients.length === 0 && (
              <div className="col-span-3 py-20 text-center text-slate-400">
                No clients yet. Submit a request using the button above.
              </div>
            )}
          </div>

          {/* Bottom padding so last card isn't flush against viewport edge */}
          <div className="h-8" />
        </div>
      </div>
    </div>
  )
}
