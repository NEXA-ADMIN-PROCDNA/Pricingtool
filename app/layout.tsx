import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { Providers } from './Providers'

const geistSans = GeistSans
const geistMono = GeistMono

export const metadata: Metadata = {
  title: 'ProcDNA BD Tracker',
  description: 'Business Development & Pricing Tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="h-full antialiased"><Providers>{children}</Providers></body>
    </html>
  )
}
