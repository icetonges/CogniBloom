import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { fmt12, LUNCH_ROOM, type SchoolDay } from '@/lib/school'
import { schoolDayFor } from '@/lib/school-db'

export const dynamic = 'force-dynamic'

// Default daily routine — these items are placed on every day automatically.
// Marked with the reserved tag 'routine' so the UI can render them distinctly
// and so seeding stays idempotent. Items flagged `optional: true` additionally
// get the reserved 'optional' tag, which the UI renders in a lighter, dashed
// style and excludes from being treated as a hard commitment.
const DEFAULT_ROUTINE = [
  { title: 'Workout — set 1',             time: '07:30', details: '5 min',                       tag: 'fitness'    },
  { title: 'Duolingo',                    time: '07:40', details: '5 min',                       tag: 'language'   },
  { title: 'Study Session 1',             time: '07:45', details: '40 min',                      tag: 'study'      },
  { title: 'Workout — set 2',             time: '16:00', details: '5 min',                       tag: 'fitness'    },
  { title: 'Music',                       time: '16:07', details: '7 min',                       tag: 'music'      },
  { title: 'Study Session 2',             time: '17:00', details: '40 min',                      tag: 'study'      },
  { title: 'Workout — set 3',             time: '17:45', details: '5 min',                       tag: 'fitness'    },
  { title: '$5 daily investment',         time: '18:00', details: '15 min',                      tag: 'investment' },
  { title: 'Study Session 3',             time: '19:00', details: '30 min',                      tag: 'study',     optional: true },
  { title: 'Daily Reflection',            time: '20:00', details: '3 wins · 1 lesson · 1 goal', tag: 'mind'       },
  { title: 'Daily mind map + Close Out',  time: '20:30', details: '1 topic — branch it out',    tag: 'mind'       },
  { title: 'Catch up',                    time: '21:00', details: 'Loose ends from today',      tag: 'catchup',   optional: true },
] satisfies { title: string; time: string; details: string; tag: string; optional?: boolean }[]

/** Reserved tag marking an entry as generated from the Frost class schedule. */
const SCHOOL_TAG = 'school'
/** Reserved tag telling the planner UI this row is not freely editable. */
const LOCKED_TAG = 'locked'

function parseDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

interface SeedItem {
  title: string
  time: string
  details: string
  tags: string[]
}

/**
 * The school band for a date: one entry per timed period, plus lunch.
 * Returns [] whenever the resolved day is closed — weekend, FCPS holiday,
 * teacher workday, or a manual snow-day override — so classes are never
 * invented on a day Frost is shut.
 */
function schoolItems(day: SchoolDay): SeedItem[] {
  if (!day.isSchoolDay) return []

  const items: SeedItem[] = []
  for (const p of day.periods) {
    // A lunch sits at the front of the 5th/6th double block, so it gets its
    // own row ahead of the class it shares the block with.
    if (p.lunch?.first) {
      items.push({
        title: `${p.lunch.slot} Lunch`,
        time: p.lunch.start,
        details: `${LUNCH_ROOM} · ${fmt12(p.lunch.start)}–${fmt12(p.lunch.end)}`,
        tags: [SCHOOL_TAG, LOCKED_TAG, 'lunch'],
      })
    }

    const walk = p.routeIn
      ? ` · ${Math.round(p.routeIn.seconds)}s walk from ${p.routeIn.from.label}${p.tight ? ' ⚠ tight' : ''}`
      : ''
    items.push({
      title: `P${p.period} · ${p.course.name}`,
      time: p.start,
      details: `${p.course.room} · ${p.course.teacher} · ${fmt12(p.start)}–${fmt12(p.end)}${walk}`,
      tags: [SCHOOL_TAG, LOCKED_TAG, p.course.id, p.course.subject.toLowerCase()],
    })

    if (p.lunch && !p.lunch.first) {
      items.push({
        title: `${p.lunch.slot} Lunch`,
        time: p.lunch.start,
        details: `${LUNCH_ROOM} · ${fmt12(p.lunch.start)}–${fmt12(p.lunch.end)}`,
        tags: [SCHOOL_TAG, LOCKED_TAG, 'lunch'],
      })
    }
  }
  return items
}

// POST /api/planner/seed-day — ensure the day's routine + class schedule exist
// (idempotent) and return all of that day's entries. Body: { date, force? }
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id
    const body = (await request.json()) as { date?: string; force?: boolean }
    const dateKey = body.date ?? ''
    const anchor = parseDay(dateKey)
    if (!anchor) return NextResponse.json({ error: 'date (YYYY-MM-DD) required' }, { status: 400 })

    // Resolve the day through override → FCPS calendar → rotation before
    // deciding anything, so a closure is honoured at seed time.
    const day = await schoolDayFor(dateKey)

    const existing = await db.plannerEntry.findMany({
      where: { userId, scope: 'day', date: anchor },
      select: { id: true, title: true, tags: true, startTime: true, details: true },
    })

    const existingTitles = new Set(existing.map((e) => e.title))
    const force = body.force === true

    // ── routine ──
    // Auto mode: seed only when this day has never been seeded, so later
    // deletions on an already-seeded day are respected.
    // Restore mode (force): add back any routine item missing by title.
    const routineSeeded = existing.some((e) => e.tags.includes('routine'))
    const routineToCreate = force
      ? DEFAULT_ROUTINE.filter((r) => !existingTitles.has(r.title))
      : routineSeeded ? [] : DEFAULT_ROUTINE

    // ── school band ──
    // The class schedule is authoritative rather than personal, so unlike the
    // routine it is reconciled every time: rows missing by title are added, and
    // rows whose time or room drifted from the schedule are corrected. A day
    // Frost is closed produces nothing at all.
    const school = schoolItems(day)
    const existingSchool = existing.filter((e) => e.tags.includes(SCHOOL_TAG))
    const schoolByTitle = new Map(existingSchool.map((e) => [e.title, e]))

    // A day that is closed (or was reclassified as closed) must not keep class
    // rows from an earlier seed. Personal items — routine, habits, anything
    // typed by hand — are never touched.
    const staleSchool = existingSchool
      .filter((e) => !school.some((s) => s.title === e.title))
      .map((e) => e.id)
    const schoolToCreate = school.filter((s) => !schoolByTitle.has(s.title))
    const schoolToFix = school
      .map((s) => {
        const row = schoolByTitle.get(s.title)
        if (!row) return null
        if (row.startTime === s.time && row.details === s.details) return null
        return { id: row.id, time: s.time, details: s.details }
      })
      .filter((x): x is { id: string; time: string; details: string } => x !== null)

    const ops = []
    let order = existing.length

    if (staleSchool.length > 0) {
      ops.push(db.plannerEntry.deleteMany({ where: { id: { in: staleSchool }, userId } }))
    }

    for (const s of schoolToCreate) {
      ops.push(
        db.plannerEntry.create({
          data: {
            userId, scope: 'day', date: anchor,
            title: s.title, startTime: s.time, details: s.details,
            tags: s.tags, priority: 'normal', sortOrder: order++,
          },
        })
      )
    }
    for (const f of schoolToFix) {
      ops.push(db.plannerEntry.update({ where: { id: f.id }, data: { startTime: f.time, details: f.details } }))
    }
    for (const r of routineToCreate) {
      ops.push(
        db.plannerEntry.create({
          data: {
            userId, scope: 'day', date: anchor,
            title: r.title, startTime: r.time, details: r.details,
            tags: r.optional ? ['routine', r.tag, 'optional'] : ['routine', r.tag],
            priority: 'normal', sortOrder: order++,
          },
        })
      )
    }

    if (ops.length > 0) await db.$transaction(ops)

    const entries = await db.plannerEntry.findMany({
      where: { userId, scope: 'day', date: anchor },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    const all = await db.plannerEntry.findMany({ where: { userId }, select: { tags: true } })
    const tagSet = new Set<string>()
    all.forEach((e) => e.tags.forEach((t) => { if (t !== 'routine' && t !== LOCKED_TAG) tagSet.add(t) }))

    return NextResponse.json({
      success: true,
      data: entries,
      tags: Array.from(tagSet).sort(),
      removedSchoolRows: staleSchool.length,
      school: {
        type: day.type,
        label: day.label,
        isSchoolDay: day.isSchoolDay,
        quarter: day.quarter,
        earlyRelease: day.earlyRelease,
        closureReason: day.closureReason,
        closureSource: day.closureSource,
        observance: day.observance,
        totalWalkMetres: day.totalWalkMetres,
      },
    })
  } catch (err) {
    console.error('[POST /api/planner/seed-day]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
