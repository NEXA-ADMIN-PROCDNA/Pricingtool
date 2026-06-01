'use client'
import { signIn } from 'next-auth/react'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { PROCDNA_LOGO_DATA_URL } from './_logo'

const ERROR_MESSAGES = {
  not_provisioned:  'Your account has not been set up in the system. Contact your admin.',
  account_disabled: 'Your account has been disabled. Contact your admin.',
}

const serif  = "'DM Serif Display', Georgia, serif"
const sans   = "'DM Sans', system-ui, sans-serif"

function LoginForm() {
  const [loading, setLoading] = useState(false)
  const params   = useSearchParams()
  const errorMsg = ERROR_MESSAGES[params.get('error')] ?? null

  async function handleMicrosoft() {
    setLoading(true)
    await signIn('azure-ad', { callbackUrl: '/dashboard' })
  }

  return (
    <div style={{ display: 'flex', width: 860, minHeight: 520, borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 40px rgba(11,28,61,0.12)' }}>

      {/* ── Left panel ── */}
      <div style={{ flex: 1.1, background: '#0B1C3D', padding: '48px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(0,122,255,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -40, width: 240, height: 240, borderRadius: '50%', background: 'rgba(0,122,255,0.05)', pointerEvents: 'none' }} />

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
          {/* The source PNG has an off-white grid background, so we frame it as
              a white logo card on the navy panel — reads as an intentional
              brand mark instead of a tiny half-blended square. */}
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: '#fff',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset',
            flexShrink: 0,
          }}>
            <img src={PROCDNA_LOGO_DATA_URL} alt="ProcDNA" style={{ width: 36, height: 36, objectFit: 'contain', display: 'block' }} />
          </div>
          <span style={{ fontFamily: serif, fontSize: 22, color: '#fff', letterSpacing: '0.3px' }}>
            ProcDNA <span style={{ color: '#4D9EFF' }}>NEXA</span>
          </span>
        </div>

        {/* Headline — NEXA acronym expansion, one letter per line. The
            capital that opens each word is bumped to ~1.5× and tinted to the
            brand highlight; the rest of the word follows on the same row in
            the regular white serif. */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {(() => {
            const rowStyle = {
              fontFamily: serif,
              fontSize: 26,
              color: '#fff',
              lineHeight: 1.05,
              fontWeight: 400,
              letterSpacing: '0.3px',
              display: 'flex',
              alignItems: 'baseline',
              gap: 4,
            }
            const bigStyle = {
              fontSize: '1.55em',
              color: '#4D9EFF',
              fontWeight: 500,
              lineHeight: 1,
            }
            const tail = '#fff'
            return (
              <h1 style={{ margin: 0, padding: 0 }}>
                <span style={{ ...rowStyle, display: 'block', marginBottom: 6 }}>
                  <span style={bigStyle}>N</span><span style={{ color: tail }}>ew</span>
                </span>
                <span style={{ ...rowStyle, display: 'block', marginBottom: 6 }}>
                  <span style={bigStyle}>E</span><span style={{ color: tail }}>ngagement&nbsp;and</span>
                </span>
                <span style={{ ...rowStyle, display: 'block', marginBottom: 6 }}>
                  <span style={{ color: tail }}>e</span><span style={bigStyle}>X</span><span style={{ color: tail }}>pense</span>
                </span>
                <span style={{ ...rowStyle, display: 'block' }}>
                  <span style={bigStyle}>A</span><span style={{ color: tail }}>ccruals</span>
                </span>
              </h1>
            )
          })()}
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, maxWidth: 280, marginTop: 22 }}>
            Request, review, and approve engagement expenses with full visibility at every step.
          </p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, background: '#fff', padding: '48px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>

        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0B1C3D', letterSpacing: '-0.3px', marginBottom: 4 }}>Welcome to NEXA</h2>
          <span style={{ fontSize: 13, color: '#8A93A6', lineHeight: 1.5, display: 'block' }}>
            Sign in with your ProcDNA Microsoft account<br />to access the approval portal.
          </span>
        </div>

        {errorMsg && (
          <div style={{ marginBottom: 20, padding: '12px 14px', background: '#FFF1F2', borderRadius: 8, border: '0.5px solid #FCA5A5' }}>
            <p style={{ fontSize: 12, color: '#DC2626', lineHeight: 1.6 }}>{errorMsg}</p>
          </div>
        )}

        {/* Microsoft SSO button */}
        <button
          onClick={handleMicrosoft}
          disabled={loading}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '14px 20px', border: 'none', borderRadius: 9, background: '#0B1C3D', fontSize: 14, fontWeight: 600, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1, fontFamily: sans, letterSpacing: '0.2px', transition: 'background 0.15s' }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#1A3060' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#0B1C3D' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5, width: 18, height: 18, flexShrink: 0 }}>
            <div style={{ background: '#F25022' }} />
            <div style={{ background: '#7FBA00' }} />
            <div style={{ background: '#00A4EF' }} />
            <div style={{ background: '#FFB900' }} />
          </div>
          {loading ? 'Redirecting…' : 'Sign in with Microsoft'}
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 20px' }}>
          <div style={{ flex: 1, height: 0.5, background: '#E4E8F0' }} />
          <span style={{ fontSize: 11, color: '#B0B8C8', fontWeight: 500, letterSpacing: '0.5px' }}>need help?</span>
          <div style={{ flex: 1, height: 0.5, background: '#E4E8F0' }} />
        </div>

        <p style={{ fontSize: 12, color: '#8A93A6', textAlign: 'center', lineHeight: 1.6 }}>
          Having trouble signing in? Contact your<br />
          IT administrator or{' '}
          <a href="mailto:nexa_admin@procdna.com" style={{ color: '#1A6EFF', textDecoration: 'none', fontWeight: 500 }}>
            nexa_admin@procdna.com
          </a>
        </p>

      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F9', fontFamily: sans }}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
