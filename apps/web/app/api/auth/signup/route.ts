import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { SHARED_ACCOUNT_EMAILS } from '@/lib/user'

export const dynamic = 'force-dynamic'

const SignupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
})

// POST /api/auth/signup
// Creates a new STUDENT account with a bcrypt-hashed password. Does NOT log
// the user in itself — the client calls signIn('credentials', ...) with the
// same email/password immediately after this returns 200, which is what
// gives the "auto-login after signup" behavior. Kept as a separate step
// (rather than doing it inside the Credentials `authorize` callback) so
// signup validation errors (duplicate email, weak password) are reported
// clearly instead of surfacing as a generic failed-login.
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = SignupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }
  const { name, email, password } = parsed.data

  if (SHARED_ACCOUNT_EMAILS.includes(email)) {
    // Password-based signup can't prove ownership of a typed email the way a
    // completed Google OAuth round-trip can, so this shared household
    // address gets a clear redirect instead of a new, disconnected account.
    return NextResponse.json(
      { error: 'This email uses shared sign-in — please use "Sign in with Google" instead of creating a password.' },
      { status: 409 }
    )
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await db.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: 'STUDENT',
      emailVerified: false,
    },
    select: { id: true, email: true, name: true },
  })

  return NextResponse.json({ success: true, data: user })
}
