'use client'
// TabSoW — opportunity ▸ "SOW / PO" tab. Big picture: the document area — upload (browser
// → Supabase via a signed URL, then /confirm), list with download links, and soft-delete,
// for both SOW and PO docs. Also surfaces the pre-contract-agreed toggle that gates the
// SOW_PENDING → SOW_SUBMITTED transition.
import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { SearchableSelect } from '@/components/ui/SearchableSelect'

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
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'
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
  title, description, apiPath, onDocCountChange, disabled = false,
}: {
  title: string
  description: string
  apiPath: string
  onDocCountChange: (count: number) => void
  disabled?: boolean
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
    if (file.size > 49 * 1024 * 1024) {
      setError('File exceeds the 49 MB limit.')
      toast.error('File exceeds the 49 MB limit.')
      return
    }
    const ALLOWED = new Set(['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/png','image/jpeg'])
    if (!ALLOWED.has(file.type)) {
      setError('Only PDF, Word, Excel, PNG, and JPEG files are allowed.')
      toast.error('Only PDF, Word, Excel, PNG, and JPEG files are allowed.')
      return
    }
    setError(null)
    setUploading(true)
    try {
      // Step 1 — get presigned upload URL
      const presignRes = await fetch(apiPath, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type }),
      })
      if (!presignRes.ok) {
        const body = await presignRes.json().catch(() => ({})) as { error?: string }
        setError(body.error ?? 'Upload failed')
        toast.error(body.error ?? 'Upload failed')
        setUploading(false)
        return
      }
      const { uploadUrl, storagePath } = await presignRes.json() as { uploadUrl: string; storagePath: string }

      // Step 2 — upload directly to Supabase (bypasses Vercel)
      const uploadRes = await fetch(uploadUrl, {
        method:  'PUT',
        headers: {
          'Content-Type': file.type,
          'apikey':        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
        },
        body: file,
      })
      if (!uploadRes.ok) {
        setError('Upload failed. Please try again.')
        toast.error('Upload failed. Please try again.')
        setUploading(false)
        return
      }

      // Step 3 — confirm and create DB record
      const confirmRes = await fetch(`${apiPath}/confirm`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ storagePath, fileName: file.name, fileSize: file.size, mimeType: file.type }),
      })
      if (!confirmRes.ok) {
        const body = await confirmRes.json().catch(() => ({})) as { error?: string }
        setError(body.error ?? 'Upload failed')
        toast.error(body.error ?? 'Upload failed')
        setUploading(false)
        return
      }
      const doc = await confirmRes.json() as Doc
      setDocs(prev => {
        const next = [doc, ...(prev ?? [])]
        onDocCountChange(next.length)
        return next
      })
    } catch {
      setError('Upload failed. Please try again.')
      toast.error('Upload failed. Please try again.')
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
    } else {
      toast.error('Failed to delete document')
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  return (
    <div>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#001E96', letterSpacing: '-0.01em' }}>{title}</p>
      <p style={{ fontSize: 12, color: '#7B7C7F', marginTop: 2 }}>{description}</p>

      <div
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => { if (!disabled && !uploading) inputRef.current?.click() }}
        style={{
          marginTop: 16,
          border: `2px dashed ${disabled ? '#E2E6EE' : dragOver ? '#005CD9' : '#D6DCE8'}`,
          borderRadius: 10, padding: '28px 24px', textAlign: 'center',
          cursor: disabled || uploading ? 'not-allowed' : 'pointer',
          background: disabled ? '#F4F6FB' : dragOver ? '#EBF2FF' : '#F9FAFB',
          transition: 'all 150ms', opacity: disabled ? 0.6 : uploading ? 0.6 : 1,
        }}
      >
        <input ref={inputRef} type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }}
          disabled={uploading || disabled}
        />
        {disabled ? (
          <p style={{ fontSize: 12.5, color: '#7B7C7F', lineHeight: 1.5 }}>
            Disabled — uncheck <strong>“Proceed with pre-contract agreement”</strong> to upload SoW / PO documents.
          </p>
        ) : uploading ? (
          <p style={{ fontSize: 13, color: '#7B7C7F' }}>Uploading…</p>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="#A5A7AA" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
              style={{ width: 32, height: 32, margin: '0 auto 10px' }}>
              <path d="M12 16V4m0 0L8 8m4-4 4 4M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
            </svg>
            <p style={{ fontSize: 13, color: '#3A4A6A', fontWeight: 500 }}>
              Drop file here or <span style={{ color: '#005CD9' }}>browse</span>
            </p>
            <p style={{ fontSize: 11, color: '#A5A7AA', marginTop: 4 }}>PDF · DOC · DOCX · XLS · XLSX · PNG · JPG</p>
          </>
        )}
      </div>

      {error && <p style={{ fontSize: 12, color: '#D6454A', marginTop: 10 }}>{error}</p>}

      {docs && docs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#A5A7AA', marginBottom: 10 }}>
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
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#001E96', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.fileName}
                  </p>
                  <p style={{ fontSize: 11, color: '#A5A7AA', marginTop: 2 }}>
                    v{doc.version} · {fmtSize(doc.fileSizeBytes)} · {fmtDate(doc.uploadedAt)}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {doc.signedUrl && (
                    <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" style={{
                      fontSize: 12, color: '#005CD9', fontWeight: 500,
                      textDecoration: 'none', padding: '4px 10px',
                      border: '1px solid #DCE7F5', borderRadius: 4, background: '#F0F5FF',
                    }}>Download</a>
                  )}
                  <button onClick={() => deleteDoc(doc.id)} title="Remove" style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#D6454A', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center',
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
        <p style={{ fontSize: 12, color: '#A5A7AA', marginTop: 16, textAlign: 'center' }}>
          No documents uploaded yet.
        </p>
      )}
    </div>
  )
}

export function TabSoW({
  opportunityId,
  opportunityName,
  initialPreContractAgreed = false,
  existingVerification = null,
}: {
  opportunityId: string
  opportunityName: string
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

  // Pre-contract agreement and SoW/PO documents are mutually exclusive routes:
  // either the deal proceeds on a pre-contract agreement, OR it has SoW/PO docs —
  // never both. (SoW + PO together is fine.)
  const hasDocs = sowCount > 0 || poCount > 0
  const anyCondition = precontract || hasDocs
  // A WITHDRAWN verification is one that was auto-invalidated when the pricing
  // approval was rejected/withdrawn — like a rejection, it re-opens resubmission.
  const canSubmit = anyCondition && (!verification || verification.status === 'REJECTED' || verification.status === 'WITHDRAWN')

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.ok ? r.json() : [])
      .then(setUsers)
  }, [])

  async function togglePreContract(checked: boolean) {
    // Block enabling pre-contract while SoW/PO docs exist (mutually exclusive).
    if (checked && hasDocs) {
      toast.error('Remove uploaded SoW / PO documents before choosing pre-contract agreement.')
      return
    }
    setPrecontract(checked)
    setSaving(true)
    const res = await fetch(`/api/opportunities/${opportunityId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preContractAgreed: checked }),
    })
    if (!res.ok) toast.error('Failed to save pre-contract status')
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
      toast.error(body.error ?? 'Failed to submit verification request')
    }
    setSubmitting(false)
  }

  const approverName = users.find(u => u.id === approverId)?.name ?? 'the selected approver'

  return (
    <div style={{ padding: '28px 32px', maxWidth: 680 }}>

      {/* ── Approved banner ── */}
      {verification?.status === 'APPROVED' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px', borderRadius: 10, marginBottom: 28,
          background: '#F0FDF4', border: '1.5px solid #86EFAC',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#15803D' }}>
              SOW &amp; PO Verification Approved
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#166534' }}>
              Approved by <strong>{verification.approver.name}</strong> — this opportunity is cleared for project code generation.
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#166534', opacity: 0.75 }}>
              SoW / PO / PCA has been approved, there is no work to do here.
            </p>
          </div>
        </div>
      )}

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
            <div style={{ marginBottom: 18 }}>
              {/* Editorial eyebrow */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontFamily: "var(--font-plex-mono), 'Courier New', monospace",
                fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
                color: '#7B7C7F', fontWeight: 500, marginBottom: 14,
              }}>
                <span style={{ width: 5, height: 5, background: '#005CD9', display: 'inline-block', transform: 'rotate(45deg)' }} />
                NEXA · Confirmation
              </div>

              <h3 style={{
                fontSize: 18, fontWeight: 600, color: '#001E96',
                margin: '0 0 10px', letterSpacing: '-0.01em', lineHeight: 1.25,
              }}>
                Submit SoW &amp; PO verification request
              </h3>

              <p style={{ fontSize: 13, color: '#3A4A6A', lineHeight: 1.6, margin: 0 }}>
                A verification request for <strong style={{ color: '#001E96' }}>{opportunityName}</strong>
                {' '}
                (<span style={{ fontFamily: "var(--font-plex-mono), 'Courier New', monospace", color: '#7B7C7F', fontSize: 12 }}>{opportunityId}</span>)
                {' '}will be issued to <strong style={{ color: '#001E96' }}>{approverName}</strong> for review.
              </p>

              <p style={{ fontSize: 12.5, color: '#7B7C7F', lineHeight: 1.55, margin: '8px 0 0' }}>
                On approval, the opportunity advances to project code generation.
                If returned, supporting documents may be updated and the request resubmitted.
              </p>
            </div>
            {submitError && (
              <p style={{ fontSize: 12, color: '#D6454A', marginBottom: 12 }}>{submitError}</p>
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
                  background: submitting ? '#E2E6EE' : '#005CD9', color: submitting ? '#A5A7AA' : '#fff',
                  border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── 1. Pre-contract agreement ── */}
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px', borderRadius: 8,
        border: `1.5px solid ${precontract ? '#005CD9' : '#D6DCE8'}`,
        background: precontract ? '#F0F5FF' : '#F9FAFB',
        cursor: saving || hasDocs ? 'not-allowed' : 'pointer',
        transition: 'all 150ms', marginBottom: hasDocs ? 8 : 28,
        userSelect: 'none', opacity: saving ? 0.7 : hasDocs ? 0.55 : 1,
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
          border: `2px solid ${precontract ? '#005CD9' : '#A5A7AA'}`,
          background: precontract ? '#005CD9' : '#fff',
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
          disabled={saving || hasDocs} style={{ display: 'none' }}
        />
        <span style={{ fontSize: 13, fontWeight: 500, color: precontract ? '#1A3E8A' : '#3A4A6A' }}>
          Proceed with pre-contract agreement
        </span>
        {saving && <span style={{ fontSize: 11, color: '#A5A7AA', marginLeft: 'auto' }}>Saving…</span>}
      </label>

      {hasDocs && (
        <p style={{ fontSize: 11.5, color: '#7B7C7F', lineHeight: 1.5, margin: '0 0 28px' }}>
          Unavailable while SoW / PO documents are uploaded — pre-contract agreement and SoW / PO are mutually exclusive.
        </p>
      )}

      {/* ── 2. SoW upload ── */}
      <DocUploadSection
        title="Statement of Work"
        description="Upload the signed SoW document after pricing approval. PDF, Word, and Excel files accepted · max 49 MB."
        apiPath={`/api/opportunities/${opportunityId}/sow`}
        onDocCountChange={setSowCount}
        disabled={precontract}
      />

      <div style={{ borderTop: '1px solid #E8ECF4', margin: '32px 0' }} />

      {/* ── 3. PO upload ── */}
      <DocUploadSection
        title="Purchase Order"
        description="Upload the PO received from the client. PDF, Word, and Excel files accepted · max 49 MB."
        apiPath={`/api/opportunities/${opportunityId}/po`}
        onDocCountChange={setPoCount}
        disabled={precontract}
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

          {/* Auto-invalidated (pricing approval was reset) — allow resubmit */}
          {verification?.status === 'WITHDRAWN' && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 16,
              background: '#FFFBEB', border: '1px solid #FDE68A',
            }}>
              <span style={{ fontSize: 12, color: '#92400E', fontWeight: 500 }}>
                The previous verification was invalidated because the pricing approval was reset. Submit again once the pricing is re-approved.
              </span>
            </div>
          )}

          {/* Submit form — show when no pending verification */}
          {canSubmit && (
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#001E96', marginBottom: 4 }}>
                Submit for Verification
              </p>
              <p style={{ fontSize: 12, color: '#7B7C7F', marginBottom: 14 }}>
                One or more conditions are met. Select an approver to verify.
              </p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#7B7C7F', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Approver
                  </label>
                  <SearchableSelect
                    options={users.map(u => ({ value: u.id, label: u.name, sub: u.role }))}
                    value={approverId}
                    onChange={setApproverId}
                    placeholder="Search approver…"
                    emptyMessage="No matching users found."
                  />
                </div>
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={!approverId || submitting}
                  style={{
                    padding: '9px 20px', borderRadius: 8, fontSize: 13,
                    fontWeight: 600, cursor: !approverId || submitting ? 'not-allowed' : 'pointer',
                    background: !approverId || submitting ? '#E2E6EE' : '#005CD9',
                    color: !approverId || submitting ? '#A5A7AA' : '#fff',
                    border: 'none', transition: 'all 150ms', whiteSpace: 'nowrap',
                  }}
                >
                  Submit for Verification
                </button>
              </div>
              {submitError && (
                <p style={{ fontSize: 12, color: '#D6454A', marginTop: 8 }}>{submitError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
