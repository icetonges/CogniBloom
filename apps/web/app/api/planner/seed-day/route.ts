import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Default daily routine — these items are placed on every day automatically.
// Marked with the reserved tag 'routine' so the UI can render them distinctly
// and so seeding stays idempotent.
const DEFAULT_ROUTINE = [
  { title: 'Duolingo',                 time: '07:30', minutes: 15, tag: 'language' },
  { title: 'Ball touches — set 1',     time: '08:00', minutes: 5,  tag: 'skill' },
  { title: 'Investment review',        time: '12:30', minutes: 10, tag: 'investment' },
  { title: 'Ball touches — set 2',     time: '15:00', minutes: 5,  tag: 'skill' },
  { title: 'Ball touches — set 3',     time: '18:00', minutes: 5,  tag: 'skill' },
  { title: 'Reflection / mindfulness', time: '21:00', minutes: 10, tag: 'mind' },
]

function parseDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

// POST /api/planner/seed-day — ensure the day's routine items exist (idempotent)
// and return all of that day's entries. Body: { date: "YYYY-MM-DD" }
export async function POST(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const body = (await request.json()) as { date?: string }
    const anchor = parseDay(body.date ?? '')
    if (!anchor) return NextResponse.json({ error: 'date (YYYY-MM-DD) required' }, { status: 400 })

    const existing = await db.plannerEntry.findMany({
      where: { userId, scope: 'day', date: anchor },
      select: { tags: true },
    })

    // Seed only when this day has never been seeded (no routine-tagged entry yet),
    // so the user's later deletions on an already-seeded day are respected.
    const alreadySeeded = existing.some((e) => e.tags.includes('routine'))
    if (!alreadySeeded) {
      await db.$transaction(
        DEFAULT_ROUTINE.map((r, i) =>
          db.plannerEntry.create({
            data: {
              userId,
              scope: 'day',
              date: anchor,
              title: r.title,
              startTime: r.time,
              details: `${r.minutes} min`,
              tags: ['routine', r.tag],
              priority: 'normal',
              sortOrder: i,
            },
          })
        )
      )
    }

    const entries = await db.plannerEntry.findMany({
      where: { userId, scope: 'day', date: anchor },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    const all = await db.plannerEntry.findMany({ where: { userId }, select: { tags: true } })
    const tagSet = new Set<string>()
    all.forEach((e) => e.tags.forEach((t) => { if (t !== 'routine') tagSet.add(t) }))

    return NextResponse.json({ success: true, data: entries, tags: Array.from(tagSet).sort() })
  } catch (err) {
    console.error('[POST /api/planner/seed-day]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
