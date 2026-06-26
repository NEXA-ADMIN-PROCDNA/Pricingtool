'use client'
import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { PROCDNA_LOGO_DATA_URL } from '../login/_logo'

const sans = "'DM Sans', system-ui, sans-serif"

function Login2Form() {
  const params  = useSearchParams()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(
    params.get('error') ? 'Invalid email or password.' : null
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await signIn('credentials', {
      email,
      password,
      callbackUrl: '/dashboard',
      redirect: false,
    })
    if (res?.error || !res?.ok) {
      setError('Invalid email or password.')
      setLoading(false)
    } else {
      window.location.href = res.url ?? '/dashboard'
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F9', fontFamily: sans }}>
      <div style={{ width: 400, background: '#fff', borderRadius: 16, boxShadow: '0 4px 40px rgba(11,28,61,0.10)', padding: '40px 36px' }}>

        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <img src={PROCDNA_LOGO_DATA_URL} alt="ProcDNA" style={{ height: 32, width: 'auto', objectFit: 'contain', display: 'block' }} />
            <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: '#0B1C3D', letterSpacing: '0.2px' }}>
              ProcDNA <span style={{ color: '#1A6EFF' }}>NEXA</span>
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#8A93A6' }}>Sign in with your email address.</p>
        </div>

        {error && (
          <div style={{ marginBottom: 18, padding: '10px 14px', background: '#FFF1F2', borderRadius: 8, border: '0.5px solid #FCA5A5' }}>
            <p style={{ margin: 0, fontSize: 12, color: '#DC2626' }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#0B1C3D', marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@procdna.com"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #D6DCE8', borderRadius: 8, fontSize: 13, color: '#0B1C3D', outline: 'none', fontFamily: sans }}
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#0B1C3D', marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #D6DCE8', borderRadius: 8, fontSize: 13, color: '#0B1C3D', outline: 'none', fontFamily: sans }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '12px 0', background: '#0B1C3D', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1, fontFamily: sans }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Login2Page() {
  return (
    <Suspense>
      <Login2Form />
    </Suspense>
  )
}
