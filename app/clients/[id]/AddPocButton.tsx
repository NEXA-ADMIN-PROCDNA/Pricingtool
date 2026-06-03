'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const C = {
  ink: '#001E96', accent: '#005CD9',
  rule: '#D6DCE8', inkSoft: '#3A4A6A', inkMuted: '#7B7C7F',
}
const SANS: React.CSSProperties = { fontFamily: "var(--font-geist-sans), 'Inter', system-ui, sans-serif" }
const MONO: React.CSSProperties = { fontFamily: "var(--font-plex-mono), 'Courier New', monospace" }

const inputStyle: React.CSSProperties = {
  ...SANS, width: '100%', boxSizing: 'border-box',
  border: `1px solid ${C.rule}`, borderRadius: 6, padding: '9px 11px',
  fontSize: 13, color: C.ink, outline: 'none', background: '#fff',
}

const empty = { name: '', jobTitle: '', email: '', phone: '' }

export function AddPocButton({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState(empty)

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))
  const close = () => { if (!saving) { setOpen(false); setForm(empty) } }

  async function submit() {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/client-pocs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, ...form }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? 'Failed to add contact')
        return
      }
      toast.success('Contact added')
      setOpen(false); setForm(empty)
      router.refresh()
    } catch {
      toast.error('Failed to add contact')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          ...MONO, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: C.accent, background: '#fff', border: `1px solid ${C.rule}`,
          borderRadius: 4, padding: '5px 11px', cursor: 'pointer', fontWeight: 600,
        }}
      >+ Add</button>

      {open && (
        <div
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(10,31,68,0.45)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 10, width: 420, maxWidth: '100%',
              boxShadow: '0 20px 60px rgba(10,31,68,0.18)', padding: '24px 26px',
            }}
          >
            <div style={{
              ...MONO, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: C.inkMuted, fontWeight: 500, marginBottom: 10,
            }}>NEXA · Add Contact</div>
            <h3 style={{ ...SANS, fontSize: 18, fontWeight: 600, color: C.ink, margin: '0 0 16px' }}>
              New point of contact
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Name *">
                <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" autoFocus />
              </Field>
              <Field label="Job Title">
                <input style={inputStyle} value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} placeholder="e.g. Procurement Lead" />
              </Field>
              <Field label="Email">
                <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@company.com" />
              </Field>
              <Field label="Phone">
                <input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 555 000 0000" />
              </Field>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                onClick={close} disabled={saving}
                style={{
                  ...MONO, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                  padding: '9px 14px', background: '#fff', color: C.inkMuted,
                  border: `1px solid ${C.rule}`, borderRadius: 4, fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >Cancel</button>
              <button
                onClick={submit} disabled={saving}
                style={{
                  ...MONO, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                  padding: '9px 16px', background: C.ink, color: '#fff',
                  border: `1px solid ${C.ink}`, borderRadius: 4, fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
                }}
              >{saving ? 'Adding…' : 'Add Contact'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        ...MONO, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: C.inkMuted, fontWeight: 600, display: 'block', marginBottom: 5,
      }}>{label}</label>
      {children}
    </div>
  )
}
