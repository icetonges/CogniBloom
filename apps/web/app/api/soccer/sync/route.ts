import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { syncSoccerCalendar } from '@/lib/soccer-calendar-db'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST /api/soccer/sync — pull the latest PlayMetrics calendar into
 * `SoccerEvent`.
 *
 * Two ways in, same as /api/email/daily-summary: a logged-in session (the
 * Soccer dashboard page's "Sync now" button), or the shared `CRON_SECRET`
 * header so a GitHub Actions schedule can trigger it with nobody signed in.
 */
export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-cron-secret')
    if (secret !== null) {
      if (secret !== process.env['CRON_SECRET']) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      const session = await auth()
      if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await syncSoccerCalendar()
    return NextResponse.json(result, { status: result.ok ? 200 : 502 })
  } catch (err) {
    console.error('[POST /api/soccer/sync]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
