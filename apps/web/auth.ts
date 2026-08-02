import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { authConfig } from './auth.config'
import { DANIEL_USER_ID, SHARED_ACCOUNT_EMAILS } from '@/lib/user'

// Full Auth.js (NextAuth v5) configuration -- Node.js runtime only (used by
// `app/api/auth/[...nextauth]/route.ts`). See `auth.config.ts` for the
// Edge-safe subset middleware actually runs.
//
// Session strategy is JWT (not database sessions) so the edge middleware can
// read `role`/`userId` off the token without a DB round-trip on every
// request. The Prisma adapter is still wired in because it's required for
// Google account linking (writes to the `Account` table on first sign-in).
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email
        const password = credentials?.password
        if (typeof email !== 'string' || typeof password !== 'string') return null

        const user = await db.user.findUnique({ where: { email: email.toLowerCase() } })
        if (!user?.passwordHash) return null // no password set -> Google-only account

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
    Google({
      clientId: process.env['GOOGLE_CLIENT_ID'],
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
      // Google verifies email ownership, so it's safe to link a Google
      // sign-in to an existing password-based account with the same email
      // (e.g. Daniel's seeded 'daniel@cognibloom.app' row) instead of
      // erroring with OAuthAccountNotLinked and stranding his existing data.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // NOTE: for a brand-new sign-in, Auth.js calls this callback *before*
      // the adapter has created the User/Account rows -- `user.id` here is
      // just the raw OAuth subject id, not a database id. Don't attempt any
      // write here that assumes a matching row exists; that's what the
      // `.catch()` below is for, and why the shared-account linking logic
      // lives in the `jwt` callback instead (it runs after those rows exist).
      if (account?.provider === 'google' && user.id) {
        await db.user
          .update({ where: { id: user.id }, data: { emailVerified: true } })
          .catch(() => {
            // Non-fatal: don't block sign-in if this side-effect write fails.
          })
      }
      return true
    },
    async jwt({ token, user, account }) {
      // `user`/`account` are only populated on the initial sign-in call;
      // persist the fields we need onto the token for every subsequent
      // request (the `else` branch below).
      if (user) {
        const email = user.email?.toLowerCase()
        const isShared = !!email && SHARED_ACCOUNT_EMAILS.includes(email)

        if (isShared && account?.provider === 'google' && user.id !== DANIEL_USER_ID) {
          // First-ever Google sign-in for a household email: by this point
          // (unlike in `signIn`) the adapter has already created a real
          // User + Account row for it -- re-point the Account to the shared
          // account instead, then discard the throwaway User row. Order
          // matters: Account.userId must move off the throwaway id *before*
          // that row is deleted, since Account has `onDelete: Cascade`.
          // Every step is defensive -- worst case on failure is the user
          // stays logged in as the throwaway (empty) account rather than
          // sign-in breaking outright.
          const throwawayId = user.id
          const repointed = await db.account
            .update({
              where: {
                provider_providerAccountId: {
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                },
              },
              data: { userId: DANIEL_USER_ID },
            })
            .then(() => true)
            .catch(() => false)
          if (repointed) {
            await db.user.delete({ where: { id: throwawayId } }).catch(() => {})
            await db.user
              .update({ where: { id: DANIEL_USER_ID }, data: { emailVerified: true } })
              .catch(() => {})
          }
        }

        // Only claim the shared identity if a live DB read just confirmed it
        // exists -- if the repoint above failed for some reason, fall back
        // to whatever row this sign-in actually resolved to rather than
        // stamping the token with an id that doesn't match reality.
        const shared = isShared
          ? await db.user
              .findUnique({ where: { id: DANIEL_USER_ID }, select: { role: true } })
              .catch(() => null)
          : null

        if (shared) {
          token['id'] = DANIEL_USER_ID
          token['role'] = shared.role
        } else {
          token['id'] = user.id
          token['role'] = (user as { role?: string }).role ?? 'STUDENT'
        }
      } else if (token['id'] && !token['role']) {
        // Backfill role for tokens issued before this field existed.
        const dbUser = await db.user.findUnique({
          where: { id: token['id'] as string },
          select: { role: true },
        })
        if (dbUser) token['role'] = dbUser.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token['id'] as string
        ;(session.user as { role?: string }).role = token['role'] as string
      }
      return session
    },
  },
  events: {
    async createUser({ user }) {
      // New Google sign-ups land here on first login (adapter auto-creates
      // the row). Everyone starts as STUDENT; promote manually via
      // `prisma studio` or a direct SQL update if a second admin is needed.
      if (user.id) {
        await db.user.update({ where: { id: user.id }, data: { role: 'STUDENT' } }).catch(() => {})
      }
    },
  },
})
