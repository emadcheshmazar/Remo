import type { Metadata } from 'next'
import { IBM_Plex_Sans, Sora } from 'next/font/google'
import { AppVersion } from '@/components/AppVersion'
import { Providers } from './providers'
import './globals.css'

const display = Sora({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'remo',
  description: 'کارتیمی از هر جایی',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fa" className={`${display.variable} ${sans.variable}`}>
      <body>
        <Providers>{children}</Providers>
        <AppVersion />
      </body>
    </html>
  )
}
