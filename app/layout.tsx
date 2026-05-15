import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { Providers } from './Providers'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'NEXA · Business Development',
  description: 'Business Development & Pricing Tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn('h-full', GeistSans.variable, GeistMono.variable)}>
      <body className="h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
