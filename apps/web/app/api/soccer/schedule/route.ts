import { NextRequest, NextResponse } from 'next/server'
import { scheduleBetween } from '@/lib/soccer-calendar-db'
import { toEasternDateKey } from '@/lib/timezone'

export const dynamic = 'force-dynamic'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

/**
 * GET /api/soccer/schedule?from=&to= — synced practices + games in range.
 * Defaults to today through +45 days. Reads are open, the same way
 * /api/school/calendar's are — this is team logistics, not private data.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const today = toEasternDateKey(new Date())
    const from = searchParams.get('from') ?? today
    const to = searchParams.get('to') ?? addDays(today, 45)

    if (!DAY_RE.test(from) || !DAY_RE.test(to)) {
      return NextResponse.json({ error: 'from/to must be YYYY-MM-DD' }, { status: 400 })
    }

    const { practices, games, lastSyncedAt, synced } = await scheduleBetween(from, to)
    // `synced` separates "no practice this week" from "we have never once
    // talked to PlayMetrics" — an empty list means very different things in
    // those two cases, and the UI has to be able to tell them apart.
    return NextResponse.json({ success: true, from, to, practices, games, lastSyncedAt, synced })
  } catch (err) {
    console.error('[GET /api/soccer/schedule]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
