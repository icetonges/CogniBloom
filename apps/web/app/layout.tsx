import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
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
    url: 'https://cognibleom.com',
    siteName: 'CogniBloom',
    title: 'CogniBloom - AI Learning Companion',
    description: 'Your personal AI tutor for K-12 learning, journaling, and growth.',
    images: [
      {
        url: 'https://cognibleom.com/og-image.png',
        width: 1200,
        height: 630,
        alt: 'CogniBloom',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CogniBloom - AI Learning Companion',
    description: 'Your personal AI tutor for K-12 learning, journaling, and growth.',
    creator: '@cognibleom',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta httpEquiv="x-ua-compatible" content="ie=edge" />
        </head>
        <body className="min-h-screen bg-background antialiased">
          <div className="flex flex-col min-h-screen">
            {children}
          </div>
        </body>
      </html>
    </ClerkProvider>
  )
}
