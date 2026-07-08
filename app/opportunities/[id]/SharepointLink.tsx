'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'

interface Props {
  opportunityId: string   // BD-NNN (used as PATCH key)
  ownerId:       string
  coOwnerId?:    string | null
  initialUrl?:   string | null
}

export function SharepointLink({ opportunityId, ownerId, coOwnerId, initialUrl }: Props) {
  const { data: session } = useSession()
  const sessionUser = session?.user as { id?: string; role?: string } | undefined
  const userId  = sessionUser?.id
  const isAdmin = sessionUser?.role === 'ADMIN'
  const canEdit = isAdmin || userId === ownerId || (!!coOwnerId && userId === coOwnerId)

  const [url, setUrl]       = useState(initialUrl ?? '')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]   = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/opportunities/${opportunityId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sharepointUrl: draft.trim() || null }),
    })
    if (res.ok) {
      setUrl(draft.trim())
      setEditing(false)
    }
    setSaving(false)
  }

  function openEdit() {
    setDraft(url)
    setEditing(true)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <input
          autoFocus
          type="url"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          placeholder="Paste SharePoint folder URL…"
          className="text-xs border border-slate-300 rounded px-2 py-0.5 w-72 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <button
          onClick={save}
          disabled={saving}
          className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-0.5 rounded disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
        {url && (
          <button
            onClick={() => { setDraft(''); save() }}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Remove
          </button>
        )}
      </div>
    )
  }

  if (url) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded px-2.5 py-1 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 7a4 4 0 014-4h4a4 4 0 014 4v1h2a4 4 0 014 4v6a4 4 0 01-4 4H7a4 4 0 01-4-4v-6a4 4 0 014-4h2V7z" />
          </svg>
          Open Project Folder
        </a>
        {canEdit && (
          <button onClick={openEdit} className="text-xs text-slate-400 hover:text-slate-600 underline">
            Edit
          </button>
        )}
      </div>
    )
  }

  if (!canEdit) return null

  return (
    <button
      onClick={openEdit}
      className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      Add SharePoint folder
    </button>
  )
}
