import type { Metadata } from 'next'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'CogniBloom - AI Learning Companion',
  description: 'Your personal AI tutor for K-12 learning, journaling, and growth.',
  generator: 'Next.js',
  applicationName: 'CogniBloom',
  keywords: ['education', 'AI tutor', 'learning', 'K-12', 'tutoring'],
  creator: 'CogniBloom Team',
  publisher: 'CogniBloom',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://cognibloom.vercel.app',
    siteName: 'CogniBloom',
    title: 'CogniBloom - AI Learning Companion',
    description: 'Your personal AI tutor for K-12 learning, journaling, and growth.',
  },
  icons: {
    icon: '/favicon.svg',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f6fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1623' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className="min-h-screen bg-background antialiased">
        <ThemeProvider>
          <div className="flex flex-col min-h-screen">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  )
}
