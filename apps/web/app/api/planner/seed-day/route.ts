import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { fmt12, LUNCH_ROOM, type SchoolDay } from '@/lib/school'
import { schoolDayFor } from '@/lib/school-db'
import {
  profileFor, routineFor, ROUTINE_VERSION_TAG, type RoutineItem,
} from '@/lib/daily-routine'
import { practiceTimingFor, soccerBandItems, type SeedItem as SoccerSeedItem } from '@/lib/soccer-calendar-db'
import { activitiesOn } from '@/lib/activities'

export const dynamic = 'force-dynamic'

// The daily routine is no longer one fixed list: a Monday with practice at
// Woodson, a Tuesday at GMU and a Wednesday at home are genuinely different
// days, and the old defaults put the morning workout at 07:30 — inside first
// period. lib/daily-routine builds the right shape for the date. Items are
// still tagged 'routine' so seeding stays idempotent, and 'optional' items
// still render dashed.
//
// 2026-09-06: the soccer commitment (kit/leave/arrive/practice-or-game/home)
// used to be baked into that same versioned routine, keyed off a hardcoded
// Monday/Tuesday/Thursday assumption. It's now its own band — see
// `soccerItems` below — sourced from the PlayMetrics-synced calendar and
// reconciled every time this route runs, the same way the school class
// schedule already is. That means a calendar correction (a moved practice,
// a newly-scheduled game) reaches an already-seeded future day the next time
// this route runs, without needing a ROUTINE_VERSION bump.
//
// 2026-09-07: same treatment for `lib/activities` — fixed-schedule outside
// commitments (an online class, a lesson) that aren't school or soccer.
// No live sync needed there, just a declared weekly slot + date range.

/** Every generated routine row carries the version that produced it. */
function routineTags(r: RoutineItem): string[] {
  return [
    'routine', ROUTINE_VERSION_TAG, r.tag,
    ...(r.extra ?? []),
    ...(r.optional ? ['optional'] : []),
  ]
}

/** Reserved tag marking an entry as generated from the Frost class schedule. */
const SCHOOL_TAG = 'school'
/** Reserved tag marking an entry as generated from the synced soccer calendar. */
const SOCCER_TAG = 'soccer'
/** Reserved tag marking an entry as generated from lib/activities. */
const ACTIVITY_TAG = 'activity'
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

/** The soccer band for a date, tagged so it's reconciled the same way the
 * school band is (see below) — always, not gated behind ROUTINE_VERSION. */
function soccerItems(band: SoccerSeedItem[]): SeedItem[] {
  return band.map((b) => ({ title: b.title, time: b.time, details: b.details, tags: b.tags }))
}

/** The activities band for a date — fixed weekly commitments from
 * lib/activities (an online class, a lesson), reconciled the same way. */
function activityItems(dateKey: string): SeedItem[] {
  return activitiesOn(dateKey).map((a) => ({
    title: a.title,
    time: a.start,
    details: `${a.details} · ${fmt12(a.start)}–${fmt12(a.end)}`,
    tags: [ACTIVITY_TAG, LOCKED_TAG, a.id],
  }))
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
    // And the soccer calendar the same way — a synced practice or game for
    // this specific date, or null. Only ever falls back to the old static
    // Monday/Tuesday/Thursday guess if the calendar has never synced at all.
    const practiceTiming = await practiceTimingFor(dateKey)
    const soccerBand = await soccerBandItems(dateKey)

    const existing = await db.plannerEntry.findMany({
      where: { userId, scope: 'day', date: anchor },
      select: { id: true, title: true, tags: true, startTime: true, details: true, status: true },
    })

    const existingTitles = new Set(existing.map((e) => e.title))
    const force = body.force === true

    // ── routine ──
    // Three modes, in order of how they are triggered:
    //
    //   never seeded  → write the whole profile
    //   seeded, old version → reconcile automatically. This is what makes a
    //     deploy that changes the schedule actually reach days that already
    //     exist; without it, correcting the 07:30 workout fixed nothing.
    //   force (the planner's "restore routine" button) → reconcile as well
    //
    // Reconciling adds missing rows, re-times drifted ones, and removes
    // generated rows the profile no longer has — but ONLY rows still marked
    // pending. A ticked row is a record that the work happened, and records are
    // never deleted here. Anything typed by hand is untouched in every mode.
    const profile = profileFor(day.isSchoolDay, practiceTiming)
    const routine = routineFor(profile, practiceTiming)
    const routineTitles = new Set(routine.map((r) => r.title))
    const existingRoutine = existing.filter((e) => e.tags.includes('routine'))
    const routineSeeded = existingRoutine.length > 0
    const outOfDate = routineSeeded && !existingRoutine.some((e) => e.tags.includes(ROUTINE_VERSION_TAG))
    const reconcile = force || outOfDate

    const routineToCreate = reconcile
      ? routine.filter((r) => !existingTitles.has(r.title))
      : routineSeeded ? [] : routine

    const staleRoutine = reconcile
      ? existingRoutine
          .filter((e) => !routineTitles.has(e.title) && e.status !== 'done')
          .map((e) => e.id)
      : []

    const routineToFix = reconcile
      ? routine
          .map((r) => {
            const row = existingRoutine.find((e) => e.title === r.title)
            if (!row) return null
            const tags = routineTags(r)
            const sameTags = tags.length === row.tags.length && tags.every((t) => row.tags.includes(t))
            if (row.startTime === r.time && (row.details ?? '') === r.details && sameTags) return null
            return { id: row.id, time: r.time, details: r.details, tags }
          })
          .filter((x): x is { id: string; time: string; details: string; tags: string[] } => x !== null)
      : []

    // ── school band ──
    // The class schedule is authoritative rather than personal, so unlike the
    // routine it is reconciled every time: rows missing by title are added, and
    // rows whose time or room drifted from the schedule are corrected. A day
    // Frost is closed produces nothing at all.
    const school = schoolItems(day)
    // Exclude rows also tagged 'routine': a routine item can carry a topical
    // tag string that collides with a band's reserved marker (e.g. the
    // '1000 touches' / 'Juggling test' routine rows are topically tagged
    // 'soccer', same string as SOCCER_TAG) without actually belonging to
    // that band. Without this guard such a row gets deleted here as
    // "stale" while routineToFix, below, tries to update that same row a
    // few lines later in the same transaction -- which throws (the row is
    // already gone) and 500s the whole request.
    const existingSchool = existing.filter((e) => e.tags.includes(SCHOOL_TAG) && !e.tags.includes('routine'))
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

    // ── soccer band ──
    // Same treatment as the school band: authoritative, reconciled every
    // time from the synced calendar, tags fixed too (not just time/details)
    // since a game vs. practice distinction can change the tag set on an
    // already-seeded row (a TBD tournament game gets its real time later).
    const soccer = soccerItems(soccerBand)
    const existingSoccer = existing.filter((e) => e.tags.includes(SOCCER_TAG) && !e.tags.includes('routine'))
    const soccerByTitle = new Map(existingSoccer.map((e) => [e.title, e]))

    // Only pending rows. A ticked row is a record that the session happened,
    // and a later feed change (a cancellation published after the fact, or
    // PlayMetrics re-creating the event under a new UID) must not erase it —
    // the same rule the routine band above follows.
    const staleSoccer = existingSoccer
      .filter((e) => !soccer.some((s) => s.title === e.title) && e.status !== 'done')
      .map((e) => e.id)
    const soccerToCreate = soccer.filter((s) => !soccerByTitle.has(s.title))
    const soccerToFix = soccer
      .map((s) => {
        const row = soccerByTitle.get(s.title)
        if (!row) return null
        const sameTags = s.tags.length === row.tags.length && s.tags.every((t) => row.tags.includes(t))
        if (row.startTime === s.time && row.details === s.details && sameTags) return null
        return { id: row.id, time: s.time, details: s.details, tags: s.tags }
      })
      .filter((x): x is { id: string; time: string; details: string; tags: string[] } => x !== null)

    // ── activities band ──
    // Same treatment again: fixed weekly outside commitments (an online
    // class, a lesson) declared in lib/activities. Reconciled every time so
    // adding a new activity (or an end date passing) reaches already-seeded
    // future days without anyone needing to touch the database by hand.
    const activity = activityItems(dateKey)
    const existingActivity = existing.filter((e) => e.tags.includes(ACTIVITY_TAG) && !e.tags.includes('routine'))
    const activityByTitle = new Map(existingActivity.map((e) => [e.title, e]))

    const staleActivity = existingActivity
      .filter((e) => !activity.some((a) => a.title === e.title) && e.status !== 'done')
      .map((e) => e.id)
    const activityToCreate = activity.filter((a) => !activityByTitle.has(a.title))
    const activityToFix = activity
      .map((a) => {
        const row = activityByTitle.get(a.title)
        if (!row) return null
        if (row.startTime === a.time && row.details === a.details) return null
        return { id: row.id, time: a.time, details: a.details }
      })
      .filter((x): x is { id: string; time: string; details: string } => x !== null)

    const ops = []
    let order = existing.length

    if (staleSchool.length > 0) {
      ops.push(db.plannerEntry.deleteMany({ where: { id: { in: staleSchool }, userId } }))
    }
    if (staleSoccer.length > 0) {
      ops.push(db.plannerEntry.deleteMany({ where: { id: { in: staleSoccer }, userId } }))
    }
    if (staleActivity.length > 0) {
      ops.push(db.plannerEntry.deleteMany({ where: { id: { in: staleActivity }, userId } }))
    }
    if (staleRoutine.length > 0) {
      ops.push(db.plannerEntry.deleteMany({ where: { id: { in: staleRoutine }, userId } }))
    }
    for (const f of routineToFix) {
      ops.push(db.plannerEntry.update({
        where: { id: f.id },
        data: { startTime: f.time, details: f.details, tags: f.tags },
      }))
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
    for (const s of soccerToCreate) {
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
    for (const f of soccerToFix) {
      ops.push(db.plannerEntry.update({
        where: { id: f.id },
        data: { startTime: f.time, details: f.details, tags: f.tags },
      }))
    }
    for (const a of activityToCreate) {
      ops.push(
        db.plannerEntry.create({
          data: {
            userId, scope: 'day', date: anchor,
            title: a.title, startTime: a.time, details: a.details,
            tags: a.tags, priority: 'normal', sortOrder: order++,
          },
        })
      )
    }
    for (const f of activityToFix) {
      ops.push(db.plannerEntry.update({ where: { id: f.id }, data: { startTime: f.time, details: f.details } }))
    }
    for (const r of routineToCreate) {
      ops.push(
        db.plannerEntry.create({
          data: {
            userId, scope: 'day', date: anchor,
            title: r.title, startTime: r.time, details: r.details,
            tags: routineTags(r),
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
    all.forEach((e) => e.tags.forEach((t) => {
      // 'routine-vN' is seeder bookkeeping, not a tag anyone would filter by.
      if (t !== 'routine' && t !== LOCKED_TAG && !t.startsWith('routine-v')) tagSet.add(t)
    }))

    return NextResponse.json({
      success: true,
      data: entries,
      tags: Array.from(tagSet).sort(),
      removedSchoolRows: staleSchool.length,
      removedSoccerRows: staleSoccer.length,
      removedActivityRows: staleActivity.length,
      removedRoutineRows: staleRoutine.length,
      retimedRoutineRows: routineToFix.length,
      routineUpgraded: outOfDate,
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
