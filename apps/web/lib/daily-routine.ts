/**
 * Daniel's default day.
 *
 * The old routine put "Workout — set 1" at 07:30 and "Study Session 1" at
 * 07:45 — both of which land in the middle of first period. That was written
 * before the school schedule existed. This version is built around the two
 * fixed points of a real school day:
 *
 *   FI03AM  06:40  Wakefield Chapel Rd & Bromley Ct (N)
 *   FI03PM  14:35  same stop
 *
 * and around whatever BRYC practice actually falls on a given evening. The
 * shape he asked to keep is preserved on every profile: morning stretch →
 * Duolingo → music, afternoon play time, two study sessions, the daily
 * investment, and the reflection that closes the day.
 *
 * 2026-09-06: practice used to be assumed fixed to Monday/Tuesday/Thursday
 * (`lib/soccer.ts`'s old PRACTICES table). The real BRYC schedule moves
 * around week to week — some weeks it's Mon+Thu, others Mon+Tue, sometimes a
 * Wednesday or even a Sunday evening — so this file no longer looks up a
 * weekday at all. The caller (`lib/soccer-calendar-db.ts`, reading the
 * PlayMetrics-synced calendar) tells `profileFor`/`routineFor` what's
 * actually happening *that specific date* via `PracticeTiming`. The kit/
 * leave/arrive/practice/home rows themselves are no longer built here either
 * — they're a separate, always-reconciled "soccer band" (see
 * `soccerBandItems` in lib/soccer-calendar-db.ts) so a calendar correction
 * reaches an already-seeded day immediately, the same way the school class
 * schedule already does, rather than waiting on a ROUTINE_VERSION bump.
 */

import { minus, plus } from '@/lib/soccer'

/**
 * Bump this whenever the profiles change shape.
 *
 * Seeded rows carry the version as a tag. A day that was seeded under an older
 * version is reconciled automatically the next time the planner opens it —
 * otherwise a deploy that fixes the schedule silently does nothing to any day
 * that had already been seeded, which is exactly what happened when the 07:30
 * workout was corrected.
 *
 * Reconciling only ever adds rows, re-times rows, or removes generated rows
 * that are still pending. A row already ticked done is a record of work that
 * actually happened and is never deleted.
 */
export const ROUTINE_VERSION = 3
export const ROUTINE_VERSION_TAG = `routine-v${ROUTINE_VERSION}`

export interface RoutineItem {
  title: string
  /** "HH:mm" */
  time: string
  details: string
  tag: string
  /** Rendered dashed and not counted as a commitment. */
  optional?: boolean
  /** Extra tags beyond 'routine' and `tag`. */
  extra?: string[]
}

export type DayProfile =
  | 'school-practice-early'   // school day, practice leaves before ~6 PM
  | 'school-practice-late'    // school day, practice leaves ~6 PM or later
  | 'school-plain'            // school day, no practice
  | 'open'                    // weekend, holiday, teacher workday

export const BUS = {
  route: { am: 'FI03AM', pm: 'FI03PM' },
  stop: 'Wakefield Chapel Rd & Bromley Ct (N)',
  amPickup: '06:40',
  pmDrop: '14:35',
  /** Walk to the stop — leave the house with a margin, the bus does not wait. */
  leaveHome: '06:32',
} as const

/**
 * The only two facts the personal routine needs about this evening's
 * practice: when he has to leave the house, and when he's back. Everything
 * else (venue, kit, the practice block itself) lives in the soccer band.
 * Supplied by `lib/soccer-calendar-db.ts` from the synced calendar (or the
 * static fallback, before the first sync).
 */
export interface PracticeTiming {
  leaveAt: string
  homeAt: string
}

function timeToMinutes(t: string): number {
  const [h = '0', m = '0'] = t.split(':')
  return Number(h) * 60 + Number(m)
}

/**
 * Which profile a given date takes.
 *
 * `practice` is whatever's actually on the synced calendar for *this*
 * date — no longer an assumption from the day of the week. "Late" shape
 * means both study sessions fit before leaving for practice; the 6 PM
 * cutoff is empirically where BRYC's own practice times split (5:45 PM
 * Woodson practices vs. 7:00 PM Woodson/GMU ones).
 */
export function profileFor(isSchoolDay: boolean, practice: PracticeTiming | null): DayProfile {
  if (!isSchoolDay) return 'open'
  if (!practice) return 'school-plain'
  return timeToMinutes(practice.leaveAt) >= timeToMinutes('18:00')
    ? 'school-practice-late'
    : 'school-practice-early'
}

// ── the blocks every profile shares ─────────────────────────────────────────

/** Morning, on a school day: short, in order, and finished before the bus. */
function schoolMorning(): RoutineItem[] {
  return [
    { title: 'Up + bed made',        time: '05:55', details: 'Lights on, feet on the floor', tag: 'mind' },
    { title: 'Workout — set 1',      time: '06:00', details: '10 min · stretch and mobility', tag: 'fitness' },
    { title: 'Duolingo',             time: '06:12', details: '5 min streak',                  tag: 'language' },
    { title: 'Music',                time: '06:18', details: '7 min',                         tag: 'music' },
    { title: 'Breakfast + kit check',time: '06:26', details: 'Backpack, water, soccer bag if practice today', tag: 'prep' },
    { title: `Leave for the bus stop`, time: BUS.leaveHome, details: `${BUS.stop} — walk out now`, tag: 'transport' },
    { title: `Bus ${BUS.route.am}`,  time: BUS.amPickup, details: `${BUS.stop} · approx.`, tag: 'transport', extra: ['bus'] },
  ]
}

/** Morning on a day off — later, longer, same order. */
function openMorning(): RoutineItem[] {
  return [
    { title: 'Workout — set 1',  time: '08:00', details: '10 min · stretch and mobility', tag: 'fitness' },
    { title: 'Duolingo',         time: '08:12', details: '5 min streak',                  tag: 'language' },
    { title: 'Music',            time: '08:18', details: '20 min — a real practice, not 7 minutes', tag: 'music' },
    { title: 'Study Session 1',  time: '09:00', details: '45 min',                        tag: 'study' },
    { title: '1000 touches',     time: '10:00', details: 'Both feet · the same ball you take to practice', tag: 'soccer' },
  ]
}

/** Getting home, on every school day. */
function comeHome(): RoutineItem[] {
  return [
    { title: `Bus ${BUS.route.pm} home`, time: BUS.pmDrop, details: `${BUS.stop} · approx.`, tag: 'transport', extra: ['bus'] },
    { title: 'Snack + decompress',       time: '14:45', details: '15 min — nothing scheduled', tag: 'rest' },
    { title: 'Play time',                time: '15:00', details: 'Free. Outside if the weather allows', tag: 'play' },
  ]
}

/**
 * The close of every day, wherever the evening ended up.
 *
 * `tight` drops the mind map — on a practice night there is no room for it and
 * pretending otherwise just makes the plan a lie. `investment: false` is for
 * the "late" shape, where the $5 decision happens before he leaves for
 * practice because practice doesn't finish until well past 8.
 */
function closeOut(start: string, opts: { tight?: boolean; investment?: boolean } = {}): RoutineItem[] {
  const withInvestment = opts.investment !== false
  const t = (n: number) => plus(start, n)
  const items: RoutineItem[] = []
  if (withInvestment) {
    items.push({ title: '$5 daily investment', time: start, details: '15 min · one decision, written down', tag: 'investment' })
  }
  const reflectAt = withInvestment ? t(20) : start
  items.push({ title: 'Daily Reflection', time: reflectAt, details: '3 wins · 1 lesson · 1 goal', tag: 'mind' })
  if (!opts.tight) {
    items.push({ title: 'Daily mind map + Close Out', time: plus(reflectAt, 15), details: '1 topic — branch it out', tag: 'mind' })
    items.push({ title: 'Lights out', time: plus(reflectAt, 40), details: 'Phone out of the room', tag: 'rest' })
  } else {
    items.push({ title: 'Lights out', time: plus(reflectAt, 20), details: 'Phone out of the room', tag: 'rest' })
  }
  return items
}

// ── the profiles ────────────────────────────────────────────────────────────

/**
 * Fallback timings used only as a defensive default — `profileFor` never
 * actually returns a practice profile without a `PracticeTiming`, but a
 * literal default here is safer than trusting that invariant everywhere a
 * caller might drift.
 */
const DEFAULT_EARLY: PracticeTiming = { leaveAt: '17:10', homeAt: '19:35' }
const DEFAULT_LATE: PracticeTiming = { leaveAt: '18:20', homeAt: '20:55' }

export function routineFor(profile: DayProfile, practice: PracticeTiming | null = null): RoutineItem[] {
  switch (profile) {
    // Practice that leaves before ~6 PM: the afternoon is short and Study
    // Session 2 lands after dinner, once everyone's home.
    case 'school-practice-early': {
      const { leaveAt, homeAt } = practice ?? DEFAULT_EARLY
      return sorted([
        ...schoolMorning(),
        ...comeHome(),
        { title: 'Study Session 1', time: '15:30', details: '40 min — homework first', tag: 'study' },
        { title: '1000 touches',    time: minus(leaveAt, 55), details: 'Before you leave, not instead of practice', tag: 'soccer' },
        { title: 'Study Session 2', time: plus(homeAt, 35), details: '30 min — reading counts', tag: 'study' },
        ...closeOut(plus(homeAt, 75), { tight: true }),
      ])
    }

    // Practice that leaves ~6 PM or later: both study sessions fit before
    // he leaves the house.
    case 'school-practice-late': {
      const { homeAt } = practice ?? DEFAULT_LATE
      return sorted([
        ...schoolMorning(),
        ...comeHome(),
        { title: 'Study Session 1', time: '15:30', details: '40 min — homework first', tag: 'study' },
        { title: '1000 touches',    time: '16:15', details: 'Both feet · the same ball you take to practice', tag: 'soccer' },
        { title: 'Study Session 2', time: '16:55', details: '40 min', tag: 'study' },
        // The $5 decision moves ahead of practice: a practice this late
        // doesn't finish until well past 8 and he's up at 5:55.
        { title: '$5 daily investment', time: '17:35', details: '15 min · one decision, written down', tag: 'investment' },
        { title: 'Early dinner',    time: '17:52', details: 'Light — practice tonight', tag: 'rest' },
        ...closeOut(plus(homeAt, 15), { tight: true, investment: false }),
      ])
    }

    // No practice tonight — this is where the long study block and the
    // extra touches live.
    case 'school-plain':
      return sorted([
        ...schoolMorning(),
        ...comeHome(),
        { title: 'Workout — set 2', time: '15:45', details: '10 min · core and legs', tag: 'fitness' },
        { title: 'Study Session 1', time: '16:00', details: '45 min — homework first', tag: 'study' },
        { title: '1000 touches',    time: '17:00', details: 'Both feet · juggling to finish', tag: 'soccer' },
        { title: 'Dinner',          time: '18:00', details: 'Phone stays in the kitchen', tag: 'rest' },
        { title: 'Study Session 2', time: '18:40', details: '40 min', tag: 'study' },
        { title: 'Reading',         time: '19:30', details: '20 min — English 7 book or the reading room', tag: 'reading' },
        ...closeOut('20:00'),
      ])

    // Weekends, holidays, teacher workdays.
    case 'open':
    default:
      return sorted([
        ...openMorning(),
        { title: 'Play time',       time: '11:00', details: 'Free',                         tag: 'play' },
        { title: 'Study Session 2', time: '14:00', details: '45 min',                       tag: 'study' },
        { title: 'Workout — set 2', time: '15:00', details: '10 min',                       tag: 'fitness' },
        { title: 'Reading',         time: '16:00', details: '30 min — English 7 book',      tag: 'reading' },
        { title: 'Juggling test',   time: '17:00', details: '100 alternating feet — log your best', tag: 'soccer', optional: true },
        ...closeOut('19:30'),
        { title: 'Catch up', time: '21:00', details: 'Loose ends from the week', tag: 'catchup', optional: true },
      ])
  }
}

function sorted(items: RoutineItem[]): RoutineItem[] {
  return [...items].sort((a, b) => a.time.localeCompare(b.time))
}

/** Titles that belong to the habit tracker, in the order it shows them. */
export const HABIT_TITLES = [
  'Workout — set 1',
  'Duolingo',
  'Music',
  '1000 touches',
  'Study Session 1',
  'Study Session 2',
  'Reading',
  '$5 daily investment',
  'Daily Reflection',
] as const
