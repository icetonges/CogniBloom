import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * The soccer log.
 *
 * It rides on PlannerEntry rather than a table of its own: one row per day,
 * titled "⚽ Soccer log", tagged ['soccer','log']. The numbers live in
 * `details` as a line a human can read —
 *
 *     820 touches · juggling 46 · ladder 148s · practice ✓
 *
 * — so the row is useful in the planner as well as parseable here. That keeps
 * a year of training history in the database without a migration, which
 * matters: this data is exactly the kind that must not evaporate.
 */

const TITLE = '⚽ Soccer log'

export interface SoccerLog {
  date: string
  touches: number
  juggling: number
  ladderSeconds: number
  practice: boolean
}

function parseAnchor(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

function keyOf(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function render(log: Omit<SoccerLog, 'date'>): string {
  const bits = [`${log.touches} touches`]
  if (log.juggling > 0) bits.push(`juggling ${log.juggling}`)
  if (log.ladderSeconds > 0) bits.push(`ladder ${log.ladderSeconds}s`)
  bits.push(log.practice ? 'practice ✓' : 'no practice')
  return bits.join(' · ')
}

function parse(details: string | null): Omit<SoccerLog, 'date'> {
  const d = details ?? ''
  const num = (re: RegExp) => {
    const m = re.exec(d)
    return m?.[1] ? Number(m[1]) : 0
  }
  return {
    touches: num(/(\d+)\s*touches/i),
    juggling: num(/juggling\s+(\d+)/i),
    ladderSeconds: num(/ladder\s+(\d+)\s*s/i),
    practice: /practice ✓/.test(d),
  }
}

/** GET /api/soccer/log?date=YYYY-MM-DD&days=28 — that day plus the window behind it. */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id

    const { searchParams } = new URL(request.url)
    const anchor = parseAnchor(searchParams.get('date') ?? '')
    if (!anchor) return NextResponse.json({ error: 'date (YYYY-MM-DD) required' }, { status: 400 })
    const days = Math.min(120, Math.max(1, Number(searchParams.get('days') ?? '28')))

    const from = new Date(anchor)
    from.setUTCDate(from.getUTCDate() - (days - 1))

    const rows = await db.plannerEntry.findMany({
      where: {
        userId, scope: 'day', title: TITLE,
        date: { gte: from, lte: anchor },
      },
      select: { date: true, details: true },
      orderBy: { date: 'asc' },
    })

    const logs: SoccerLog[] = rows.map((r) => ({ date: keyOf(r.date), ...parse(r.details) }))
    const streak = countStreak(logs, keyOf(anchor))

    return NextResponse.json({
      success: true,
      logs,
      today: logs.find((l) => l.date === keyOf(anchor)) ?? null,
      totals: {
        touches: logs.reduce((n, l) => n + l.touches, 0),
        practices: logs.filter((l) => l.practice).length,
        bestJuggling: logs.reduce((n, l) => Math.max(n, l.juggling), 0),
        bestLadder: logs.filter((l) => l.ladderSeconds > 0)
          .reduce((n, l) => (n === 0 ? l.ladderSeconds : Math.min(n, l.ladderSeconds)), 0),
        days: logs.length,
      },
      streak,
    })
  } catch (err) {
    console.error('[GET /api/soccer/log]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/soccer/log — set today's numbers.
 *   { date, touches?, juggling?, ladderSeconds?, practice? }
 * Anything omitted keeps its stored value, so the +50 button can send touches
 * alone without wiping the juggling record.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id

    const body = (await request.json()) as Partial<SoccerLog> & { date?: string }
    const anchor = parseAnchor(body.date ?? '')
    if (!anchor) return NextResponse.json({ error: 'date (YYYY-MM-DD) required' }, { status: 400 })

    const row = await db.plannerEntry.findFirst({
      where: { userId, scope: 'day', date: anchor, title: TITLE },
      select: { id: true, details: true },
    })

    const current = parse(row?.details ?? null)
    const next = {
      touches: clamp(body.touches ?? current.touches, 0, 20000),
      juggling: clamp(body.juggling ?? current.juggling, 0, 5000),
      ladderSeconds: clamp(body.ladderSeconds ?? current.ladderSeconds, 0, 3600),
      practice: typeof body.practice === 'boolean' ? body.practice : current.practice,
    }

    const details = render(next)
    const done = next.touches >= 1000

    if (row) {
      await db.plannerEntry.update({
        where: { id: row.id },
        data: { details, status: done ? 'done' : 'pending', completedAt: done ? new Date() : null },
      })
    } else {
      const last = await db.plannerEntry.findFirst({
        where: { userId, scope: 'day', date: anchor },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      })
      await db.plannerEntry.create({
        data: {
          userId, scope: 'day', date: anchor,
          title: TITLE, details, startTime: null,
          tags: ['soccer', 'log'],
          status: done ? 'done' : 'pending',
          completedAt: done ? new Date() : null,
          sortOrder: (last?.sortOrder ?? -1) + 1,
        },
      })
    }

    return NextResponse.json({ success: true, log: { date: body.date, ...next } })
  } catch (err) {
    console.error('[PATCH /api/soccer/log]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(Number.isFinite(n) ? n : 0)))
}

/** Consecutive days back from `today` that hit the touch goal. */
function countStreak(logs: SoccerLog[], today: string): number {
  const hit = new Set(logs.filter((l) => l.touches >= 1000).map((l) => l.date))
  let n = 0
  const d = new Date(`${today}T00:00:00Z`)
  // Today not being done yet must not break a streak that is otherwise alive,
  // so start counting from yesterday when today is still empty.
  if (!hit.has(today)) d.setUTCDate(d.getUTCDate() - 1)
  for (;;) {
    const k = d.toISOString().slice(0, 10)
    if (!hit.has(k)) break
    n += 1
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return n
}
