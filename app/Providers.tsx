'use client'
// Providers — global client context wrapper mounted once in the root layout: NextAuth
// SessionProvider (so useSession works everywhere) + the Sonner <Toaster> for toasts.
import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster position="top-right" richColors />
    </SessionProvider>
  )
}
