import type { Metadata } from 'next'
import { Source_Serif_4 } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { AuthSessionProvider } from '@/components/providers/AuthSessionProvider'
import './globals.css'

// Fallback for Anthropic Serif, which is proprietary and cannot be bundled
// (see the @font-face block in globals.css). Source Serif 4 is a variable
// open serif with a close feel and excellent screen legibility, so the app
// looks right whether or not the licensed files are installed.
const serif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  style: ['normal', 'italic'],
})

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
    { media: '(prefers-color-scheme: dark)', color: '#121212' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={serif.variable}>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className="min-h-screen bg-background antialiased font-sans">
        <AuthSessionProvider>
          <ThemeProvider>
            <div className="flex flex-col min-h-screen">{children}</div>
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  )
}
