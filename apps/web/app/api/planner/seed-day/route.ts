import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { fmt12, LUNCH_ROOM, type SchoolDay } from '@/lib/school'
import { schoolDayFor } from '@/lib/school-db'
import { profileFor, routineFor } from '@/lib/daily-routine'

export const dynamic = 'force-dynamic'

// The daily routine is no longer one fixed list: a Monday with practice at
// Woodson, a Tuesday at GMU and a Wednesday at home are genuinely different
// days, and the old defaults put the morning workout at 07:30 — inside first
// period. lib/daily-routine builds the right shape for the date. Items are
// still tagged 'routine' so seeding stays idempotent, and 'optional' items
// still render dashed.

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
    // Reload mode (force): make the day match the profile exactly — add what is
    // missing, re-time what has drifted, and drop generated rows the profile no
    // longer contains. Only rows tagged 'routine' are ever touched, so anything
    // typed by hand survives. This is what "load defaults" means after the
    // routine itself changes shape.
    const profile = profileFor(anchor, day.isSchoolDay)
    const routine = routineFor(profile)
    const routineTitles = new Set(routine.map((r) => r.title))
    const existingRoutine = existing.filter((e) => e.tags.includes('routine'))
    const routineSeeded = existingRoutine.length > 0
    const routineToCreate = force
      ? routine.filter((r) => !existingTitles.has(r.title))
      : routineSeeded ? [] : routine

    const staleRoutine = force
      ? existingRoutine.filter((e) => !routineTitles.has(e.title)).map((e) => e.id)
      : []
    const routineToFix = force
      ? routine
          .map((r) => {
            const row = existingRoutine.find((e) => e.title === r.title)
            if (!row) return null
            if (row.startTime === r.time && (row.details ?? '') === r.details) return null
            return { id: row.id, time: r.time, details: r.details }
          })
          .filter((x): x is { id: string; time: string; details: string } => x !== null)
      : []

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
    if (staleRoutine.length > 0) {
      ops.push(db.plannerEntry.deleteMany({ where: { id: { in: staleRoutine }, userId } }))
    }
    for (const f of routineToFix) {
      ops.push(db.plannerEntry.update({ where: { id: f.id }, data: { startTime: f.time, details: f.details } }))
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
            tags: [
              'routine', r.tag,
              ...(r.extra ?? []),
              ...(r.optional ? ['optional'] : []),
            ],
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
      removedRoutineRows: staleRoutine.length,
      retimedRoutineRows: routineToFix.length,
      profile,
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
