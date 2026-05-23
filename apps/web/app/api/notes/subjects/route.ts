import { NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/notes/subjects — return unique subject values for the current user
export async function GET() {
  try {
    const userId = DANIEL_USER_ID

    const notes = await db.note.findMany({
      where: { userId, subject: { not: null } },
      select: { subject: true },
      distinct: ['subject'],
      orderBy: { subject: 'asc' },
    })

    const subjects = notes
      .map((n) => n.subject)
      .filter((s): s is string => !!s)
      .sort()

    return NextResponse.json({ success: true, data: subjects })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
