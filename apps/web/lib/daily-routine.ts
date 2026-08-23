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
 * and around the three BRYC sessions, which push the evening later on Monday,
 * Tuesday and Thursday. The shape he asked to keep is preserved on every
 * profile: morning stretch → Duolingo → music, afternoon play time, two study
 * sessions, the daily investment, and the reflection that closes the day.
 */

import { PRACTICES, minus, plus, type Practice } from '@/lib/soccer'

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
export const ROUTINE_VERSION = 2
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
  | 'school-practice-early'   // Mon, Thu — 5:45 pm at Woodson
  | 'school-practice-late'    // Tue — 7:00 pm at GMU
  | 'school-plain'            // Wed, Fri
  | 'open'                    // weekend, holiday, teacher workday

export const BUS = {
  route: { am: 'FI03AM', pm: 'FI03PM' },
  stop: 'Wakefield Chapel Rd & Bromley Ct (N)',
  amPickup: '06:40',
  pmDrop: '14:35',
  /** Walk to the stop — leave the house with a margin, the bus does not wait. */
  leaveHome: '06:32',
} as const

/** Which profile a given date takes. */
export function profileFor(date: Date, isSchoolDay: boolean): DayProfile {
  if (!isSchoolDay) return 'open'
  const wd = date.getUTCDay()
  if (wd === 1 || wd === 4) return 'school-practice-early'
  if (wd === 2) return 'school-practice-late'
  return 'school-plain'
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
 * the Tuesday shape, where the $5 decision happens before he leaves for GMU
 * because practice does not finish until 8:30.
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

/** The soccer block for a practice day, worked backwards from the arrival time. */
function practiceBlock(p: Practice): RoutineItem[] {
  const leave = minus(p.arriveBy, p.travelMinutes)
  const end = plus(p.start, p.minutes)
  return [
    { title: 'Kit out + ball in the car', time: minus(leave, 15), details: 'Boots, shin guards, both kits, water, the same ball', tag: 'soccer', extra: ['prep'] },
    { title: 'Leave for practice',        time: leave,            details: `${p.venue} · ~${p.travelMinutes} min`, tag: 'soccer', extra: ['transport'] },
    { title: 'On the field — warm up',    time: p.arriveBy,       details: 'Coach’s rule: 15 minutes early, boots on, ball out', tag: 'soccer' },
    { title: 'BRYC practice',             time: p.start,          details: `${p.venue} · ${p.minutes} min · Coach West`, tag: 'soccer', extra: ['locked'] },
    { title: 'Home + dinner',             time: plus(end, p.travelMinutes), details: 'Eat, shower, then one study block', tag: 'rest' },
  ]
}

// ── the profiles ────────────────────────────────────────────────────────────

export function routineFor(profile: DayProfile): RoutineItem[] {
  switch (profile) {
    // Monday, Thursday — on the field at 5:30, so the afternoon is short and
    // Study Session 2 lands after dinner.
    case 'school-practice-early': {
      const p = PRACTICES.find((x) => x.weekday === 1)!
      return sorted([
        ...schoolMorning(),
        ...comeHome(),
        { title: 'Study Session 1', time: '15:30', details: '40 min — homework first', tag: 'study' },
        { title: '1000 touches',    time: '16:15', details: 'Before you leave, not instead of practice', tag: 'soccer' },
        ...practiceBlock(p),
        { title: 'Study Session 2', time: '20:10', details: '30 min — reading counts', tag: 'study' },
        ...closeOut('20:50', { tight: true }),
      ])
    }

    // Tuesday — 7:00 pm at GMU. Both study sessions fit before you leave.
    case 'school-practice-late': {
      const p = PRACTICES.find((x) => x.weekday === 2)!
      return sorted([
        ...schoolMorning(),
        ...comeHome(),
        { title: 'Study Session 1', time: '15:30', details: '40 min — homework first', tag: 'study' },
        { title: '1000 touches',    time: '16:15', details: 'Both feet · the same ball you take to practice', tag: 'soccer' },
        { title: 'Study Session 2', time: '16:55', details: '40 min', tag: 'study' },
        // The $5 decision moves ahead of practice on Tuesday: the GMU session
        // does not finish until 8:30 and he is up at 5:55.
        { title: '$5 daily investment', time: '17:35', details: '15 min · one decision, written down', tag: 'investment' },
        { title: 'Early dinner',    time: '17:52', details: 'Light — you train at 7', tag: 'rest' },
        ...practiceBlock(p),
        ...closeOut('21:10', { tight: true, investment: false }),
      ])
    }

    // Wednesday, Friday — no practice, so this is where the long study block
    // and the extra touches live.
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
