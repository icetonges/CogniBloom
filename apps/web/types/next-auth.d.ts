import type { DefaultSession } from 'next-auth'

// Module augmentation so `session.user.id` / `session.user.role` (set in the
// `session()` callback in auth.ts) type-check. Without this, `id`/`role`
// don't exist on the default next-auth `Session`/`User`/`JWT` shapes and
// `tsc --noEmit` fails with TS2339 (property does not exist on type).
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
    } & DefaultSession['user']
  }

  interface User {
    role?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: string
  }
}
