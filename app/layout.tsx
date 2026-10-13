import type { Metadata, Viewport } from 'next'
import { Inter, Caveat } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat',
  display: 'swap',
  weight: ['500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Afterstem.ai | O-1, EB-1A & EB-2 NIW Immigration, Guided by Humans',
  description:
    'Afterstem helps exceptional talent secure O-1A, O-1B, O-2, EB-1A, and EB-2 NIW visas. Strategy, petition building, and end-to-end support for your U.S. journey after STEM.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png', sizes: '192x192' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f5f1e6',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${caveat.variable} bg-background`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
