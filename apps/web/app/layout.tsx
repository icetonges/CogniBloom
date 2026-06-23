import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Sora } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

// Display font — punchy geometric headings for a modern, teen-friendly feel
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
  weight: ['500', '600', '700', '800'],
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
    { media: '(prefers-color-scheme: dark)', color: '#0f1623' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${sora.variable}`}>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className="min-h-screen bg-background antialiased font-sans">
        <ThemeProvider>
          <div className="flex flex-col min-h-screen">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  )
}
