import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { IBM_Plex_Mono, Instrument_Serif, Playfair_Display } from 'next/font/google'
import './globals.css'
import { Providers } from './Providers'
import { cn } from '@/lib/utils'

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
})

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-playfair',
})

export const metadata: Metadata = {
  title: 'NEXA · Business Development',
  description: 'Business Development & Pricing Tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(
      'h-full',
      GeistSans.variable,
      GeistMono.variable,
      ibmPlexMono.variable,
      instrumentSerif.variable,
      playfairDisplay.variable,
    )}>
      <body className="h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
