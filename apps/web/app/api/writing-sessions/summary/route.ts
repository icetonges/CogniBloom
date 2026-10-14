import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { summarizeSessions, isValidTimeZone } from '@/lib/writing-session-summary'

const WINDOW_DAYS = 14

// GET /api/writing-sessions/summary?tz=America/New_York
// The signed-in student's last 14 days of writing time, compared with themself.
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tzParam = request.nextUrl.searchParams.get('tz') ?? 'America/New_York'
    const timeZone = isValidTimeZone(tzParam) ? tzParam : 'America/New_York'

    // One extra day of margin so time-zone edges don't drop the oldest day.
    const since = new Date(Date.now() - (WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000)
    const rows = await db.noteWritingSession.findMany({
      where: { startedAt: { gte: since }, note: { userId: session.user.id } },
      select: {
        startedAt: true, focusMs: true, activeMs: true, writeMs: true, thinkMs: true,
        referenceMs: true, breakMs: true, wordsStart: true, wordsEnd: true,
        blocksCompleted: true, selfRating: true,
      },
    })

    return NextResponse.json({ success: true, data: summarizeSessions(rows, timeZone, new Date(), WINDOW_DAYS) })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
