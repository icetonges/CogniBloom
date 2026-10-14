import type { Metadata } from 'next'
import { Inter, Source_Serif_4 } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { AuthSessionProvider } from '@/components/providers/AuthSessionProvider'
import './globals.css'

// Claude's pairing: a sans for the interface (buttons, labels, navigation)
// and a serif for reading (notes, AI answers, page titles). Anthropic Sans and
// Anthropic Serif are proprietary and cannot be bundled (see the @font-face
// slots in globals.css), so these open fonts stand in until the licensed
// files are installed: Inter for the interface, Source Serif 4 for reading.
const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

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
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${serif.variable}`}>
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
