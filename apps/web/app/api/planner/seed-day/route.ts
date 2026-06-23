import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Default daily routine — these items are placed on every day automatically.
// Marked with the reserved tag 'routine' so the UI can render them distinctly
// and so seeding stays idempotent.
const DEFAULT_ROUTINE = [
  { title: 'Duolingo',                 time: '07:30', details: '15 min lesson', tag: 'language' },
  { title: 'Workout — set 1',          time: '08:00', details: '5 min',         tag: 'fitness' },
  { title: '$5 daily investment',      time: '09:00', details: 'Invest $5',     tag: 'investment' },
  { title: 'Workout — set 2',          time: '12:30', details: '5 min',         tag: 'fitness' },
  { title: 'Workout — set 3',          time: '18:00', details: '5 min',         tag: 'fitness' },
  { title: 'Daily mind map',           time: '20:45', details: '1 topic — branch it out', tag: 'mind' },
  { title: 'Reflection / mindfulness', time: '21:00', details: '3 wins · 1 lesson · 1 goal', tag: 'mind' },
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
    const body = (await request.json()) as { date?: string; force?: boolean }
    const anchor = parseDay(body.date ?? '')
    if (!anchor) return NextResponse.json({ error: 'date (YYYY-MM-DD) required' }, { status: 400 })

    const existing = await db.plannerEntry.findMany({
      where: { userId, scope: 'day', date: anchor },
      select: { title: true, tags: true },
    })

    // Auto mode (force=false): seed only when this day has never been seeded,
    // so later deletions on an already-seeded day are respected.
    // Restore mode (force=true): add back any routine item missing by title.
    const existingTitles = new Set(existing.map((e) => e.title))
    const alreadySeeded = existing.some((e) => e.tags.includes('routine'))
    const toCreate = body.force === true
      ? DEFAULT_ROUTINE.filter((r) => !existingTitles.has(r.title))
      : alreadySeeded ? [] : DEFAULT_ROUTINE

    if (toCreate.length > 0) {
      const base = existing.length
      await db.$transaction(
        toCreate.map((r, i) =>
          db.plannerEntry.create({
            data: {
              userId,
              scope: 'day',
              date: anchor,
              title: r.title,
              startTime: r.time,
              details: r.details,
              tags: ['routine', r.tag],
              priority: 'normal',
              sortOrder: base + i,
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
