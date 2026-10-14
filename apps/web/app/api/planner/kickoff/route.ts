import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { easternMidnight, toEasternDateKey, utcInstantToEasternTime } from '@/lib/timezone'
import { buildKickoff, summarizePlanner } from '@/lib/kickoff'
import { isParentEmail } from '@/lib/user'

export const dynamic = 'force-dynamic'

// GET /api/planner/kickoff — today's greeting, planner nudge and joke/spark.
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id

    const now = new Date()
    const dateKey = toEasternDateKey(now)
    const [y, m, d] = dateKey.split('-').map(Number)
    // Day entries are anchored at UTC midnight of the Eastern date (see /api/planner).
    const anchor = new Date(Date.UTC(y, m - 1, d))
    const startOfToday = easternMidnight(now)
    const hour = Number(utcInstantToEasternTime(now).hhmm.slice(0, 2))
    const weekday = anchor.getUTCDay()

    const [rows, user] = await Promise.all([
      db.plannerEntry.findMany({
        where: { userId, scope: 'day', date: anchor, NOT: { status: 'cancelled' } },
        select: { tags: true, status: true, completedAt: true, createdAt: true, updatedAt: true },
      }),
      db.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ])

    const planner = summarizePlanner(rows, startOfToday)
    const name = (user?.name ?? '').trim().split(/\s+/)[0] ?? ''
    const kickoff = buildKickoff({ name, dateKey, time: { hour, weekday }, planner })

    return NextResponse.json({
      success: true,
      data: {
        dateKey,
        planner,
        ...kickoff,
        // The household shares one account; a parent sees the card as a preview.
        audience: isParentEmail(session.user.email) ? 'parent' : 'student',
      },
    })
  } catch (err) {
    console.error('[GET /api/planner/kickoff]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
