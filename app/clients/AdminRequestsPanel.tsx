'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

type ClientRequest = {
  id: string
  name: string
  businessUnit: string | null
  industry: string | null
  region: string | null
  notes: string | null
  createdAt: string
  requestedBy: { id: string; name: string; email: string }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(diff / 86400000)
  if (d > 0) return `${d}d ago`
  const h = Math.floor(diff / 3600000)
  if (h > 0) return `${h}h ago`
  return 'just now'
}

export function AdminRequestsPanel() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string | undefined
  const adminId = (session?.user as any)?.id as string | undefined

  const [requests, setRequests] = useState<ClientRequest[]>([])
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    if (role !== 'ADMIN') return
    fetch('/api/client-requests')
      .then(r => r.json())
      .then(setRequests)
      .catch(() => {})
  }, [role])

  if (role !== 'ADMIN' || requests.length === 0) return null

  async function handleAction(reqId: string, action: 'approve' | 'reject') {
    setActing(reqId)
    try {
      await fetch(`/api/client-requests/${reqId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerId: adminId }),
      })
      setRequests(prev => prev.filter(r => r.id !== reqId))
      if (action === 'approve') window.location.reload()
    } catch {
      // keep the card visible on error
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-sm font-semibold text-slate-700">Pending Client Requests</h2>
        <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5">
          {requests.length}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {requests.map(req => (
          <div
            key={req.id}
            className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900 text-sm">{req.name}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {req.industry && (
                    <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                      {req.industry}
                    </span>
                  )}
                  {req.region && (
                    <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      {req.region}
                    </span>
                  )}
                  {req.businessUnit && (
                    <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      {req.businessUnit}
                    </span>
                  )}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Pending
              </span>
            </div>

            {req.notes && (
              <p className="text-xs text-slate-500 italic leading-relaxed bg-white rounded-xl border border-slate-100 px-3 py-2">
                &ldquo;{req.notes}&rdquo;
              </p>
            )}

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-100">
              <div className="text-[10px] text-slate-400">
                <span className="font-medium text-slate-500">{req.requestedBy.name}</span>
                {' · '}{timeAgo(req.createdAt)}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={acting === req.id}
                  onClick={() => handleAction(req.id, 'reject')}
                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all disabled:opacity-40"
                >
                  Reject
                </button>
                <button
                  disabled={acting === req.id}
                  onClick={() => handleAction(req.id, 'approve')}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-40"
                >
                  {acting === req.id ? '…' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
