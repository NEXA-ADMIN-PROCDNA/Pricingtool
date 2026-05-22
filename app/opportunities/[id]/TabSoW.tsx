'use client'
import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'

type Doc = {
  id: string
  fileName: string
  fileSizeBytes: number | null
  mimeType: string | null
  version: number
  uploadedAt: string
  signedUrl: string | null
}

type Verification = {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approver: { name: string }
}

type User = { id: string; name: string; role: string }

function fmtSize(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000)     return `${(bytes / 1_000).toFixed(0)} KB`
  return `${bytes} B`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function FileIcon({ mime }: { mime: string | null }) {
  const isPdf  = mime === 'application/pdf'
  const isWord = mime?.includes('word') || mime?.includes('document')
  const isImg  = mime?.startsWith('image/')
  const color  = isPdf ? '#E53935' : isWord ? '#1565C0' : isImg ? '#558B2F' : '#546E7A'
  const label  = isPdf ? 'PDF' : isWord ? 'DOC' : isImg ? 'IMG' : 'FILE'
  return (
    <div style={{
      width: 38, height: 44, borderRadius: 4, background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em' }}>{label}</span>
    </div>
  )
}

function DocUploadSection({
  title, description, apiPath, onDocCountChange,
}: {
  title: string
  description: string
  apiPath: string
  onDocCountChange: (count: number) => void
}) {
  const [docs, setDocs]           = useState<Doc[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver]   = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const inputRef                  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(apiPath)
      .then(r => r.ok ? r.json() : [])
      .then((d: Doc[]) => { setDocs(d); onDocCountChange(d.length) })
  }, [apiPath])

  async function uploadFile(file: File) {
    setError(null)
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(apiPath, { method: 'POST', body: form })
    if (res.ok) {
      const doc = await res.json() as Doc
      setDocs(prev => {
        const next = [doc, ...(prev ?? [])]
        onDocCountChange(next.length)
        return next
      })
    } else {
      const body = await res.json().catch(() => ({})) as { error?: string }
      setError(body.error ?? 'Upload failed')
    }
    setUploading(false)
  }

  async function deleteDoc(docId: string) {
    const res = await fetch(apiPath, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId }),
    })
    if (res.ok) {
      setDocs(prev => {
        const next = (prev ?? []).filter(d => d.id !== docId)
        onDocCountChange(next.length)
        return next
      })
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  return (
    <div>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#0A1F44', letterSpacing: '-0.01em' }}>{title}</p>
      <p style={{ fontSize: 12, color: '#6B7591', marginTop: 2 }}>{description}</p>

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          marginTop: 16,
          border: `2px dashed ${dragOver ? '#2563EB' : '#D6DCE8'}`,
          borderRadius: 10, padding: '28px 24px', textAlign: 'center',
          cursor: uploading ? 'not-allowed' : 'pointer',
          background: dragOver ? '#EBF2FF' : '#F9FAFB',
          transition: 'all 150ms', opacity: uploading ? 0.6 : 1,
        }}
      >
        <input ref={inputRef} type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }}
          disabled={uploading}
        />
        {uploading ? (
          <p style={{ fontSize: 13, color: '#6B7591' }}>Uploading…</p>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="#9AA3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
              style={{ width: 32, height: 32, margin: '0 auto 10px' }}>
              <path d="M12 16V4m0 0L8 8m4-4 4 4M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
            </svg>
            <p style={{ fontSize: 13, color: '#3A4A6A', fontWeight: 500 }}>
              Drop file here or <span style={{ color: '#2563EB' }}>browse</span>
            </p>
            <p style={{ fontSize: 11, color: '#9AA3B8', marginTop: 4 }}>PDF · DOC · DOCX · XLS · XLSX · PNG · JPG</p>
          </>
        )}
      </div>

      {error && <p style={{ fontSize: 12, color: '#C6432F', marginTop: 10 }}>{error}</p>}

      {docs && docs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9AA3B8', marginBottom: 10 }}>
            Uploaded Documents
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {docs.map(doc => (
              <div key={doc.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 14px', borderRadius: 8,
                border: '1px solid #E2E6EE', background: '#ffffff',
              }}>
                <FileIcon mime={doc.mimeType} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#0A1F44', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.fileName}
                  </p>
                  <p style={{ fontSize: 11, color: '#9AA3B8', marginTop: 2 }}>
                    v{doc.version} · {fmtSize(doc.fileSizeBytes)} · {fmtDate(doc.uploadedAt)}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {doc.signedUrl && (
                    <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" style={{
                      fontSize: 12, color: '#2563EB', fontWeight: 500,
                      textDecoration: 'none', padding: '4px 10px',
                      border: '1px solid #DCE7F5', borderRadius: 4, background: '#F0F5FF',
                    }}>Download</a>
                  )}
                  <button onClick={() => deleteDoc(doc.id)} title="Remove" style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#C6432F', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center',
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {docs && docs.length === 0 && (
        <p style={{ fontSize: 12, color: '#9AA3B8', marginTop: 16, textAlign: 'center' }}>
          No documents uploaded yet.
        </p>
      )}
    </div>
  )
}

export function TabSoW({
  opportunityId,
  initialPreContractAgreed = false,
  existingVerification = null,
}: {
  opportunityId: string
  initialPreContractAgreed?: boolean
  existingVerification?: Verification | null
}) {
  const { data: session } = useSession()
  const currentUserId = (session?.user as { id?: string })?.id ?? ''

  const [precontract, setPrecontract]   = useState(initialPreContractAgreed)
  const [saving, setSaving]             = useState(false)
  const [sowCount, setSowCount]         = useState(0)
  const [poCount, setPoCount]           = useState(0)
  const [verification, setVerification] = useState<Verification | null>(existingVerification)
  const [users, setUsers]               = useState<User[]>([])
  const [approverId, setApproverId]     = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [submitError, setSubmitError]   = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen]   = useState(false)

  const anyCondition = precontract || sowCount > 0 || poCount > 0
  const canSubmit = anyCondition && (!verification || verification.status === 'REJECTED')

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.ok ? r.json() : [])
      .then(setUsers)
  }, [])

  async function togglePreContract(checked: boolean) {
    setPrecontract(checked)
    setSaving(true)
    await fetch(`/api/opportunities/${opportunityId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preContractAgreed: checked }),
    })
    setSaving(false)
  }

  async function submitVerification() {
    if (!approverId || !currentUserId) return
    setSubmitting(true)
    setSubmitError(null)
    const res = await fetch(`/api/opportunities/${opportunityId}/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approverId,
        requestedById: currentUserId,
        approvalType: 'SOW_VERIFICATION',
      }),
    })
    if (res.ok) {
      const data = await res.json() as { id: string; approver: { name: string } }
      setVerification({ id: data.id, status: 'PENDING', approver: data.approver })
      setApproverId('')
      setConfirmOpen(false)
    } else {
      const body = await res.json().catch(() => ({})) as { error?: string }
      setSubmitError(body.error ?? 'Failed to submit')
    }
    setSubmitting(false)
  }

  const approverName = users.find(u => u.id === approverId)?.name ?? 'the selected approver'

  return (
    <div style={{ padding: '28px 32px', maxWidth: 680 }}>

      {/* ── Confirm modal ── */}
      {confirmOpen && (
        <>
          <div
            onClick={() => setConfirmOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(10,31,68,0.45)', backdropFilter: 'blur(2px)',
            }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', zIndex: 201,
            transform: 'translate(-50%,-50%)',
            background: '#fff', borderRadius: 14, padding: '28px 28px 24px',
            boxShadow: '0 20px 60px rgba(10,31,68,0.18)',
            width: 400, maxWidth: 'calc(100vw - 32px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#EA8C00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#0A1F44', marginBottom: 6 }}>
                  Submit for verification?
                </p>
                <p style={{ fontSize: 13, color: '#3A4A6A', lineHeight: 1.55 }}>
                  This will send a verification request mail to <strong style={{ color: '#0A1F44' }}>{approverName}</strong>.
                  Once submitted, <strong style={{ color: '#0A1F44' }}>this request cannot be undone</strong>.
                </p>
              </div>
            </div>
            {submitError && (
              <p style={{ fontSize: 12, color: '#C6432F', marginBottom: 12 }}>{submitError}</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => { setConfirmOpen(false); setSubmitError(null) }}
                disabled={submitting}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: '#F4F6FB', color: '#3A4A6A',
                  border: '1px solid #D6DCE8', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitVerification}
                disabled={submitting}
                style={{
                  padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: submitting ? '#E2E6EE' : '#2563EB', color: submitting ? '#9AA3B8' : '#fff',
                  border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Submitting…' : 'Yes, submit'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Won banner */}
      {verification?.status === 'APPROVED' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 8, marginBottom: 24,
          background: '#F0FDF4', border: '1px solid #BBF7D0',
        }}>
          <svg viewBox="0 0 20 20" fill="#16A34A" style={{ width: 16, height: 16, flexShrink: 0 }}>
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#15803D' }}>
            Verification approved — opportunity marked as <strong>Won</strong>
          </span>
        </div>
      )}

      {/* ── 1. Pre-contract agreement ── */}
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px', borderRadius: 8,
        border: `1.5px solid ${precontract ? '#2563EB' : '#D6DCE8'}`,
        background: precontract ? '#F0F5FF' : '#F9FAFB',
        cursor: saving ? 'not-allowed' : 'pointer',
        transition: 'all 150ms', marginBottom: 28,
        userSelect: 'none', opacity: saving ? 0.7 : 1,
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
          border: `2px solid ${precontract ? '#2563EB' : '#9AA3B8'}`,
          background: precontract ? '#2563EB' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 150ms',
        }}>
          {precontract && (
            <svg viewBox="0 0 12 10" fill="none" style={{ width: 10, height: 8 }}>
              <path d="M1 5l3.5 3.5L11 1" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <input type="checkbox" checked={precontract}
          onChange={e => togglePreContract(e.target.checked)}
          disabled={saving} style={{ display: 'none' }}
        />
        <span style={{ fontSize: 13, fontWeight: 500, color: precontract ? '#1A3E8A' : '#3A4A6A' }}>
          Proceed with pre-contract agreement
        </span>
        {saving && <span style={{ fontSize: 11, color: '#9AA3B8', marginLeft: 'auto' }}>Saving…</span>}
      </label>

      {/* ── 2. SoW upload ── */}
      <DocUploadSection
        title="Statement of Work"
        description="Upload the signed SoW document after pricing approval. PDF, Word, and Excel files accepted · max 20 MB."
        apiPath={`/api/opportunities/${opportunityId}/sow`}
        onDocCountChange={setSowCount}
      />

      <div style={{ borderTop: '1px solid #E8ECF4', margin: '32px 0' }} />

      {/* ── 3. PO upload ── */}
      <DocUploadSection
        title="Purchase Order"
        description="Upload the PO received from the client. PDF, Word, and Excel files accepted · max 20 MB."
        apiPath={`/api/opportunities/${opportunityId}/po`}
        onDocCountChange={setPoCount}
      />

      {/* ── Submit for verification ── */}
      {anyCondition && (
        <div style={{ marginTop: 32, borderTop: '1px solid #E8ECF4', paddingTop: 28 }}>

          {/* Pending badge */}
          {verification?.status === 'PENDING' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 16px', borderRadius: 8,
              background: '#FFFBEB', border: '1px solid #FDE68A',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', flexShrink: 0, display: 'inline-block' }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#92400E' }}>
                Verification pending approval from <strong>{verification.approver.name}</strong>
              </span>
            </div>
          )}

          {/* Rejected — allow resubmit */}
          {verification?.status === 'REJECTED' && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 16,
              background: '#FFF1F2', border: '1px solid #FECDD3',
            }}>
              <span style={{ fontSize: 12, color: '#BE123C', fontWeight: 500 }}>
                Previous verification was rejected. You can submit again.
              </span>
            </div>
          )}

          {/* Submit form — show when no pending verification */}
          {canSubmit && (
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#0A1F44', marginBottom: 4 }}>
                Submit for Verification
              </p>
              <p style={{ fontSize: 12, color: '#6B7591', marginBottom: 14 }}>
                One or more conditions are met. Select an approver to verify and mark this opportunity as Won.
              </p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7591', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Approver
                  </label>
                  <select
                    value={approverId}
                    onChange={e => setApproverId(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      border: '1px solid #D6DCE8', fontSize: 13, color: '#0A1F44',
                      background: '#fff', outline: 'none', cursor: 'pointer',
                    }}
                  >
                    <option value="">Select approver…</option>
                    {users
                      .filter(u => u.id !== currentUserId)
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))
                    }
                  </select>
                </div>
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={!approverId || submitting}
                  style={{
                    padding: '9px 20px', borderRadius: 8, fontSize: 13,
                    fontWeight: 600, cursor: !approverId || submitting ? 'not-allowed' : 'pointer',
                    background: !approverId || submitting ? '#E2E6EE' : '#2563EB',
                    color: !approverId || submitting ? '#9AA3B8' : '#fff',
                    border: 'none', transition: 'all 150ms', whiteSpace: 'nowrap',
                  }}
                >
                  Submit for Verification
                </button>
              </div>
              {submitError && (
                <p style={{ fontSize: 12, color: '#C6432F', marginTop: 8 }}>{submitError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
