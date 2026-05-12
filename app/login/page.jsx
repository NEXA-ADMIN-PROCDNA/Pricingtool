'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

const ERROR_MESSAGES = {
  not_provisioned:  'Your account has not been set up in the system. Contact your admin.',
  account_disabled: 'Your account has been disabled. Contact your admin.',
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const params = useSearchParams()
  const errorKey = params.get('error')
  const errorMsg = ERROR_MESSAGES[errorKey] ?? null

  async function handleSignIn() {
    setLoading(true)
    await signIn('azure-ad', { callbackUrl: '/dashboard' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 w-full max-w-sm space-y-8">

        <div>
          <h1 className="text-2xl font-bold text-slate-900">ProcDNA</h1>
          <p className="text-slate-500 text-sm mt-1">BD Tracker &amp; Pricing Tool</p>
        </div>

        {errorMsg && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {/* Microsoft logo */}
          <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
            <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
            <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
            <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
            <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
          </svg>
          {loading ? 'Redirecting…' : 'Sign in with Microsoft'}
        </button>

        <p className="text-center text-xs text-slate-400">
          Use your ProcDNA company account
        </p>

      </div>
    </div>
  )
}
