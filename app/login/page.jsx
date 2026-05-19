'use client'
import { signIn } from 'next-auth/react'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const ERROR_MESSAGES = {
  not_provisioned:  'Your account has not been set up in the system. Contact your admin.',
  account_disabled: 'Your account has been disabled. Contact your admin.',
  CredentialsSignin: 'Invalid email or password.',
}

function LoginForm() {
  const [loading, setLoading]         = useState(false)
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [credError, setCredError]     = useState(null)
  const [showCredForm, setShowCred]   = useState(false)
  const params = useSearchParams()
  const errorKey = params.get('error')
  const errorMsg = ERROR_MESSAGES[errorKey] ?? null

  async function handleMicrosoft() {
    setLoading(true)
    await signIn('azure-ad', { callbackUrl: '/dashboard' })
  }

  async function handleCredentials(e) {
    e.preventDefault()
    setCredError(null)
    setLoading(true)
    const result = await signIn('credentials', {
      email,
      password,
      callbackUrl: '/dashboard',
      redirect: false,
    })
    if (result?.error) {
      setCredError('Invalid email or password.')
      setLoading(false)
    } else if (result?.url) {
      window.location.href = result.url
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 w-full max-w-sm space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-slate-900">ProcDNA</h1>
        <p className="text-slate-500 text-sm mt-1">BD Tracker &amp; Pricing Tool</p>
      </div>

      {(errorMsg || credError) && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {credError ?? errorMsg}
        </div>
      )}

      {/* Microsoft SSO */}
      <button
        onClick={handleMicrosoft}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
          <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
          <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
          <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
          <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
        </svg>
        {loading ? 'Redirecting…' : 'Sign in with Microsoft'}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400">or</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Credentials toggle / form */}
      {!showCredForm ? (
        <div className="space-y-3">
          <button
            onClick={() => setShowCred(true)}
            className="w-full text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2 transition-colors"
          >
            Sign in with email &amp; password
          </button>
          <p className="text-center text-xs text-slate-400">
            SEL and above — use <span className="font-medium text-slate-500">Sign in with Microsoft</span>
          </p>
        </div>
      ) : (
        <form onSubmit={handleCredentials} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className={`w-full rounded-xl border px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
              credError
                ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
            }`}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className={`w-full rounded-xl border px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
              credError
                ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
            }`}
          />
          {credError && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <span>⚠</span> Incorrect ID or password.
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={() => { setShowCred(false); setCredError(null) }}
            className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            ← Back
          </button>
        </form>
      )}

    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
