import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/notes/subjects — returns [{ subject, count }] sorted by count desc
export async function GET(_request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID

    const grouped = await db.note.groupBy({
      by: ['subject'],
      where: { userId },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
    })

    const data = grouped
      .filter((g) => g.subject !== null)
      .map((g) => ({ subject: g.subject as string, count: g._count._all }))

    // Also include total count (no subject filter)
    const total = await db.note.count({ where: { userId } })

    return NextResponse.json({ success: true, data, total })
  } catch (err) {
    console.error('[GET /api/notes/subjects]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
