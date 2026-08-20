/**
 * Frost Middle School — 2026-2027 Blue/Gray rotation calendar.
 *
 * Frost runs a two-day rotation. Every course row on the student schedule
 * carries a "Meet Days" code:
 *
 *   ABG → meets All days   (periods 1, 4, 9)
 *   AB  → meets Blue days  (periods 3, 5, 7 — the "odd" block)
 *   AG  → meets Gray days  (periods 2, 6, 8 — the "even" block)
 *
 * so `A` reads as "all", and B/G select the rotation half.
 *
 * Source: Frost MS 2026-27 Blue/Gray calendar (frostms.fcps.edu/bell-schedule)
 * cross-checked against the FCPS 2026-2027 Standard School Year Calendar.
 *
 * Everything here is static data for the year — no DB round-trip, no migration.
 */

export type DayType = 'blue' | 'gray' | 'holiday' | 'weekend' | 'summer'

/** A calendar day key, "YYYY-MM-DD", always interpreted as Eastern local date. */
export type DateKey = string

// ── Rotation ────────────────────────────────────────────────────────────────
// Authoritative per-month day lists, transcribed from the published Frost
// Blue/Gray calendar. Weekends are simply absent.

type MonthSpec = { blue: number[]; gray: number[]; holiday: number[] }

const YEAR_SPEC: Record<string, MonthSpec> = {
  '2026-08': { blue: [24, 26, 28], gray: [25, 27, 31], holiday: [] },
  '2026-09': {
    blue: [1, 3, 9, 11, 15, 17, 22, 24, 28, 30],
    gray: [2, 8, 10, 14, 16, 18, 23, 25, 29],
    holiday: [4, 7, 21],
  },
  '2026-10': {
    blue: [2, 6, 8, 13, 15, 19, 21, 23, 27, 29],
    gray: [1, 5, 7, 9, 14, 16, 20, 22, 26, 28, 30],
    holiday: [12],
  },
  '2026-11': {
    blue: [4, 6, 10, 12, 16, 18, 20, 24],
    gray: [5, 9, 11, 13, 17, 19, 23, 30],
    holiday: [2, 3, 25, 26, 27],
  },
  '2026-12': {
    blue: [1, 3, 7, 9, 11, 15, 17],
    gray: [2, 4, 8, 10, 14, 16, 18],
    holiday: [21, 22, 23, 24, 25, 28, 29, 30, 31],
  },
  '2027-01': {
    blue: [4, 6, 8, 12, 14, 19, 21, 25, 27],
    gray: [5, 7, 11, 13, 15, 20, 22, 26, 28],
    holiday: [1, 18, 29],
  },
  '2027-02': {
    blue: [2, 4, 8, 10, 12, 17, 19, 23, 25],
    gray: [3, 5, 9, 11, 16, 18, 22, 24, 26],
    holiday: [1, 15],
  },
  '2027-03': {
    blue: [1, 3, 5, 9, 12, 16, 18, 29, 31],
    gray: [2, 4, 8, 11, 15, 17, 19, 30],
    holiday: [10, 22, 23, 24, 25, 26],
  },
  '2027-04': {
    blue: [2, 6, 8, 12, 14, 16, 22, 26, 28, 30],
    gray: [1, 5, 7, 9, 13, 15, 21, 23, 27, 29],
    holiday: [19, 20],
  },
  '2027-05': {
    blue: [4, 6, 10, 12, 14, 19, 21, 25, 27],
    gray: [3, 5, 7, 11, 13, 18, 20, 24, 26, 28],
    holiday: [17, 31],
  },
  '2027-06': {
    blue: [1, 3, 7, 9, 11, 15],
    gray: [2, 4, 8, 10, 14, 16],
    holiday: [18],
  },
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Expanded lookup: "YYYY-MM-DD" → DayType (only school-year weekdays present). */
export const DAY_MAP: Readonly<Record<DateKey, DayType>> = (() => {
  const map: Record<DateKey, DayType> = {}
  for (const [month, spec] of Object.entries(YEAR_SPEC)) {
    for (const d of spec.blue) map[`${month}-${pad2(d)}`] = 'blue'
    for (const d of spec.gray) map[`${month}-${pad2(d)}`] = 'gray'
    for (const d of spec.holiday) map[`${month}-${pad2(d)}`] = 'holiday'
  }
  return map
})()

// ── Year boundaries & quarters ──────────────────────────────────────────────

export const FIRST_DAY: DateKey = '2026-08-24'
export const LAST_DAY: DateKey = '2027-06-16'

export interface Quarter {
  n: 1 | 2 | 3 | 4
  start: DateKey
  end: DateKey
  /** Instructional days, per the FCPS calendar's quarter-duration table. */
  days: number
}

export const QUARTERS: readonly Quarter[] = [
  { n: 1, start: '2026-08-24', end: '2026-10-30', days: 46 },
  { n: 2, start: '2026-11-02', end: '2027-01-28', days: 48 },
  { n: 3, start: '2027-01-29', end: '2027-04-16', days: 47 },
  { n: 4, start: '2027-04-19', end: '2027-06-16', days: 39 },
] as const

/** Quarter-end 2-hour early-release days (FCPS "QE" markers). */
export const EARLY_RELEASE_DAYS: readonly DateKey[] = [
  '2026-10-30',
  '2027-01-28',
  '2027-04-16',
  '2027-06-16',
] as const

/** Named non-instructional stretches, for planner month/year views. */
export const BREAKS: readonly { label: string; start: DateKey; end: DateKey }[] = [
  { label: 'Labor Day Break', start: '2026-09-04', end: '2026-09-07' },
  { label: 'Yom Kippur', start: '2026-09-21', end: '2026-09-21' },
  { label: 'Indigenous Peoples’ Day', start: '2026-10-12', end: '2026-10-12' },
  { label: 'Student Holidays', start: '2026-11-02', end: '2026-11-03' },
  { label: 'Thanksgiving Break', start: '2026-11-25', end: '2026-11-27' },
  { label: 'Winter Break', start: '2026-12-21', end: '2027-01-01' },
  { label: 'Martin Luther King, Jr. Day', start: '2027-01-18', end: '2027-01-18' },
  { label: 'Teacher Workday', start: '2027-01-29', end: '2027-01-29' },
  { label: 'Staff Development Day', start: '2027-02-01', end: '2027-02-01' },
  { label: 'Presidents’ Day', start: '2027-02-15', end: '2027-02-15' },
  { label: 'Eid al-Fitr', start: '2027-03-10', end: '2027-03-10' },
  { label: 'Spring Break', start: '2027-03-22', end: '2027-03-26' },
  { label: 'Spring Holidays', start: '2027-04-19', end: '2027-04-20' },
  { label: 'Memorial Day', start: '2027-05-31', end: '2027-05-31' },
  { label: 'Juneteenth (observed)', start: '2027-06-18', end: '2027-06-18' },
] as const

// ── Lookups ─────────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" for a Date, read in the *local* calendar of that Date object. */
export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
}

/** Classify any date: blue / gray / holiday / weekend / summer. */
export function dayTypeOf(key: DateKey): DayType {
  const hit = DAY_MAP[key]
  if (hit) return hit
  const d = fromKey(key)
  const dow = d.getDay()
  if (dow === 0 || dow === 6) return 'weekend'
  if (key < FIRST_DAY || key > LAST_DAY) return 'summer'
  // A weekday inside the year with no entry: treat as a holiday rather than
  // guessing a rotation half, so the planner never invents classes.
  return 'holiday'
}

export function isSchoolDay(key: DateKey): boolean {
  const t = dayTypeOf(key)
  return t === 'blue' || t === 'gray'
}

export function quarterOf(key: DateKey): Quarter | null {
  return QUARTERS.find((q) => key >= q.start && key <= q.end) ?? null
}

export function isEarlyRelease(key: DateKey): boolean {
  return EARLY_RELEASE_DAYS.includes(key)
}

/** The next school day strictly after `key` (null past the end of the year). */
export function nextSchoolDay(key: DateKey): DateKey | null {
  const d = fromKey(key)
  for (let i = 0; i < 400; i++) {
    d.setDate(d.getDate() + 1)
    const k = toKey(d)
    if (k > LAST_DAY) return null
    if (isSchoolDay(k)) return k
  }
  return null
}

export function prevSchoolDay(key: DateKey): DateKey | null {
  const d = fromKey(key)
  for (let i = 0; i < 400; i++) {
    d.setDate(d.getDate() - 1)
    const k = toKey(d)
    if (k < FIRST_DAY) return null
    if (isSchoolDay(k)) return k
  }
  return null
}

/** Remaining school days from `key` through the end of the year (inclusive). */
export function schoolDaysRemaining(key: DateKey): number {
  let n = 0
  const d = fromKey(key)
  while (toKey(d) <= LAST_DAY) {
    if (isSchoolDay(toKey(d))) n++
    d.setDate(d.getDate() + 1)
  }
  return n
}

/** All day keys in a month, with their type — for the month/year planner grid. */
export function monthDays(year: number, month1: number): { key: DateKey; type: DayType }[] {
  const out: { key: DateKey; type: DayType }[] = []
  const last = new Date(year, month1, 0).getDate()
  for (let d = 1; d <= last; d++) {
    const key = `${year}-${pad2(month1)}-${pad2(d)}`
    out.push({ key, type: dayTypeOf(key) })
  }
  return out
}

/** The break/observance covering a date, if any. */
export function breakFor(key: DateKey) {
  return BREAKS.find((b) => key >= b.start && key <= b.end) ?? null
}
