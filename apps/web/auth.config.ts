import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'

// Edge-safe subset of the Auth.js config — imported by `middleware.ts`.
//
// Next.js middleware runs on the Edge runtime, which cannot load
// `@prisma/client` (native engine) or the Prisma adapter. This file must
// stay free of any import that pulls in Prisma, directly or transitively.
// The real `authorize()` implementation (which needs the DB) lives in the
// full config in `auth.ts`, used only by the Node-runtime API route handler.
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  providers: [
    // No `authorize` here — middleware only decodes the existing JWT, it
    // never calls a provider's authorize function.
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
    }),
    Google({
      clientId: process.env['GOOGLE_CLIENT_ID'],
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
    }),
  ],
  callbacks: {},
}
