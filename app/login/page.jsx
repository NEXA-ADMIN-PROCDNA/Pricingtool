'use client'
// app/login/page.jsx — the Azure SSO sign-in page (client component). Two-panel branded
// layout; the only action is signIn('azure-ad'). Reads ?error to show "not provisioned" /
// "account disabled" messages raised by the auth signIn callback. (Credentials login lives
// at /login2.) PUBLIC — excluded from the proxy.
import { signIn } from 'next-auth/react'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { PROCDNA_LOGO_DATA_URL, NEXA_LOGO_DATA_URL } from './_logo'

const ERROR_MESSAGES = {
  not_provisioned:  'Your account has not been set up in the system. Please contact nexa_admin@procdna.com or shreeraj.deshmukh@procdna.com.',
  account_disabled: 'Your account has been disabled. Please contact nexa_admin@procdna.com or shreeraj.deshmukh@procdna.com. .',
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
      <div style={{ flex: 1.1, background: '#0B1C3D', padding: '48px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 56, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(0,122,255,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -40, width: 240, height: 240, borderRadius: '50%', background: 'rgba(0,122,255,0.05)', pointerEvents: 'none' }} />

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 1 }}>
          {/* White card frames the blue ProcDNA logo against the navy panel so
              it stays high-contrast. The logo is wide, so the card sizes to the
              artwork's aspect ratio rather than a fixed square. */}
          <div style={{
            height: 46, borderRadius: 10,
            background: '#fff',
            display: 'grid', placeItems: 'center',
            padding: '7px 13px',
            boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset',
            flexShrink: 0,
          }}>
            <img src={PROCDNA_LOGO_DATA_URL} alt="ProcDNA" style={{ height: 30, width: 'auto', objectFit: 'contain', display: 'block' }} />
          </div>
          {/* Logo already carries the ProcDNA wordmark, so the text is just the product name. */}
          <span style={{ fontFamily: serif, fontSize: 22, color: '#4D9EFF', letterSpacing: '0.3px' }}>
            NEXA
          </span>
        </div>

        {/* Headline — NEXA acronym expansion, one letter per line. The
            capitals N, E, X, A all sit in the same vertical column; the
            lowercase "e" of eXpense hangs into a small left margin so the
            X stays aligned with the other capitals. */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {(() => {
            const bigStyle = {
              fontSize: '1.55em',
              color: '#4D9EFF',
              fontWeight: 500,
              lineHeight: 1,
            }
            return (
              <h1 style={{
                margin: 0, padding: 0,
                display: 'grid',
                gridTemplateColumns: 'auto auto', // [prefix col][main col w/ capital]
                columnGap: 0,
                rowGap: 8,
                alignItems: 'baseline',
                justifyContent: 'start',
                fontFamily: serif,
                fontSize: 26,
                color: '#fff',
                lineHeight: 1.05,
                fontWeight: 400,
                letterSpacing: '0.3px',
              }}>
                {/* N ew */}
                <span aria-hidden="true" />
                <span><span style={bigStyle}>N</span>ew</span>

                {/* E ngagement and */}
                <span aria-hidden="true" />
                <span><span style={bigStyle}>E</span>ngagement&nbsp;and</span>

                {/* e Xpense — 'e' hangs in the prefix column so the X stays
                    collinear with N / E / A in the main column. */}
                <span style={{ justifySelf: 'end', color: '#fff' }}>e</span>
                <span><span style={bigStyle}>X</span>pense</span>

                {/* A ccruals */}
                <span aria-hidden="true" />
                <span><span style={bigStyle}>A</span>ccruals</span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0B1C3D', letterSpacing: '-0.3px', margin: 0 }}>Welcome to NEXA</h2>
            <img src={NEXA_LOGO_DATA_URL} alt="NEXA" style={{ height: 36, width: 'auto', objectFit: 'contain', display: 'block', borderRadius: 6 }} />
          </div>
          <span style={{ fontSize: 13, color: '#8A93A6', lineHeight: 1.5, display: 'block' }}>
            Sign in with your ProcDNA Microsoft account<br />to access the NEXA approval portal.
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
