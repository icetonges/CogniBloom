/**
 * Frost Middle School bell schedules (2026-27).
 *
 * A Blue day runs periods 1 · 3 · 4 · 5 · 7; a Gray day runs 1 · 2 · 4 · 6 · 8
 * in exactly the same time blocks. Period 9 ("Team Designator") is an
 * administrative homeroom assignment, not a timed block.
 *
 * The 5th/6th block is a double block with lunch folded in: A/B/C/D lunches
 * rotate inside it. Daniel has **A Lunch**, which sits at the front of the
 * block — so his class time in that block is 11:13 → 12:43.
 *
 * Source: frostms.fcps.edu/bell-schedule
 */

import type { DateKey } from './calendar'
import { isEarlyRelease, dayTypeOf } from './calendar'

export type ScheduleKind = 'regular' | 'two-hour-delay' | 'early-release'
export type LunchSlot = 'A' | 'B' | 'C' | 'D'

/** "HH:mm" 24h. */
export type Time = string

export interface BellBlock {
  /** Period number as it appears on the student schedule. */
  period: number
  start: Time
  end: Time
  /** True for the double block that contains lunch. */
  hasLunch?: boolean
  /** Free-text note shown under the block (e.g. recess/advisory). */
  note?: string
}

/** Lunch windows inside the 5th/6th double block on a regular day. */
export const LUNCH_WINDOWS: Record<LunchSlot, { start: Time; end: Time }> = {
  A: { start: '10:43', end: '11:13' },
  B: { start: '11:13', end: '11:43' },
  C: { start: '11:43', end: '12:13' },
  D: { start: '12:13', end: '12:43' },
}

export const SCHOOL_START: Time = '07:30'
export const SCHOOL_END: Time = '14:15'

/**
 * Block templates. The `period` values are for a Blue day; on a Gray day the
 * 3rd/5th/7th slots become 2nd/6th/8th (same clock times).
 */
const BLUE_ORDER = [1, 3, 4, 5, 7] as const
const GRAY_ORDER = [1, 2, 4, 6, 8] as const

const REGULAR: { start: Time; end: Time; hasLunch?: boolean; note?: string }[] = [
  { start: '07:30', end: '08:16' },
  { start: '08:21', end: '09:48' },
  { start: '09:53', end: '10:38', note: 'Recess · Advisory / office hours' },
  { start: '10:42', end: '12:43', hasLunch: true },
  { start: '12:48', end: '14:15' },
]

/** 2-hour delay drops the period-4 advisory block entirely. */
const DELAY: { start: Time; end: Time; hasLunch?: boolean }[] = [
  { start: '09:30', end: '10:00' },
  { start: '10:05', end: '11:05' },
  { start: '11:10', end: '13:10', hasLunch: true },
  { start: '13:15', end: '14:15' },
]
const DELAY_BLUE = [1, 3, 5, 7] as const
const DELAY_GRAY = [1, 2, 6, 8] as const

/**
 * Early release (quarter-end, 2 hours early). Note the unusual ordering —
 * the 7th/8th block runs *before* the lunch block so dismissal lands at 12:15.
 */
const EARLY: { period: 'p1' | 'p2' | 'p4' | 'p5'; start: Time; end: Time; hasLunch?: boolean }[] = [
  { period: 'p1', start: '07:30', end: '08:10' },
  { period: 'p2', start: '08:15', end: '09:10' },
  { period: 'p4', start: '09:15', end: '10:10' },
  { period: 'p5', start: '10:15', end: '12:15', hasLunch: true },
]
const EARLY_BLUE = { p1: 1, p2: 3, p4: 7, p5: 5 } as const
const EARLY_GRAY = { p1: 1, p2: 2, p4: 8, p5: 6 } as const

export function scheduleKindFor(key: DateKey, delayed = false): ScheduleKind {
  if (delayed) return 'two-hour-delay'
  if (isEarlyRelease(key)) return 'early-release'
  return 'regular'
}

/**
 * The ordered timed blocks for a given date. Returns [] on non-school days.
 * `delayed` lets a caller model an unplanned 2-hour delay (snow, etc.).
 *
 * Prefer `blocksForKind` when the caller has already resolved the day through
 * the override → FCPS → rotation chain, since this reads the raw rotation and
 * would miss, say, a make-up day scheduled onto a published holiday.
 */
export function blocksFor(key: DateKey, delayed = false): BellBlock[] {
  const type = dayTypeOf(key)
  if (type !== 'blue' && type !== 'gray') return []
  return blocksForKind(type, scheduleKindFor(key, delayed))
}

/**
 * The blocks for an already-resolved rotation half and schedule kind. This is
 * the form the day builder uses, so any override that changes what a date *is*
 * automatically changes which bells ring on it.
 */
export function blocksForKind(dayType: 'blue' | 'gray', kind: ScheduleKind): BellBlock[] {
  const blue = dayType === 'blue'

  if (kind === 'two-hour-delay') {
    const order = blue ? DELAY_BLUE : DELAY_GRAY
    return DELAY.map((b, i) => ({ period: order[i]!, ...b }))
  }
  if (kind === 'early-release') {
    const map = blue ? EARLY_BLUE : EARLY_GRAY
    return EARLY.map((b) => ({
      period: map[b.period],
      start: b.start,
      end: b.end,
      ...(b.hasLunch ? { hasLunch: true } : {}),
    }))
  }
  const order = blue ? BLUE_ORDER : GRAY_ORDER
  return REGULAR.map((b, i) => ({ period: order[i]!, ...b }))
}

/**
 * Split the lunch double-block into the lunch window and the class window for a
 * given lunch slot. On non-regular schedules the exact sub-lunch times are not
 * published, so we place the slot proportionally inside the block.
 */
export function splitLunchBlock(
  block: BellBlock,
  slot: LunchSlot,
  kind: ScheduleKind = 'regular'
): { lunch: { start: Time; end: Time }; classTime: { start: Time; end: Time }; lunchFirst: boolean } {
  const idx = ['A', 'B', 'C', 'D'].indexOf(slot)
  let lunch = LUNCH_WINDOWS[slot]

  if (kind !== 'regular') {
    const s = toMin(block.start)
    const e = toMin(block.end)
    const seg = Math.round((e - s) / 4)
    lunch = { start: fromMin(s + idx * seg), end: fromMin(s + (idx + 1) * seg) }
  }

  const lunchFirst = toMin(lunch.start) - toMin(block.start) < toMin(block.end) - toMin(lunch.end)
  const classTime = lunchFirst
    ? { start: lunch.end, end: block.end }
    : { start: block.start, end: lunch.start }
  return { lunch, classTime, lunchFirst }
}

// ── time helpers ────────────────────────────────────────────────────────────

export function toMin(t: Time): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function fromMin(n: number): Time {
  const h = Math.floor(n / 60)
  const m = n % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "7:30 AM" style display. */
export function fmt12(t: Time): string {
  const [h, m] = t.split(':').map(Number)
  const hh = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12
  return `${hh}:${String(m ?? 0).padStart(2, '0')} ${(h ?? 0) < 12 ? 'AM' : 'PM'}`
}

/** Minutes of passing time between two consecutive blocks. */
export function passingMinutes(a: BellBlock, b: BellBlock): number {
  return Math.max(0, toMin(b.start) - toMin(a.end))
}
