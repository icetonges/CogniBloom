/**
 * FCPS 2026-2027 Standard School Year Calendar — the authoritative year layer.
 *
 * Transcribed from the official PDF (fcps.edu, "Updated 8/11/26") by reading
 * each month grid cell-by-cell, then cross-checked two ways:
 *
 *   · the 34 no-school days here match, exactly, the holidays in Frost's own
 *     Blue/Gray rotation calendar — two independent documents agreeing;
 *   · the remaining instructional days total 180, splitting 46/48/47/39 across
 *     the four quarters, matching the PDF's own Quarter Duration table.
 *
 * ── Precedence ──
 * This layer OVERRIDES the Blue/Gray rotation. A day carrying a no-school code
 * (H / TW / SD / SP) has no classes regardless of what the rotation says, and
 * a manual override in the database in turn overrides this layer:
 *
 *     manual override  >  FCPS year calendar  >  Frost Blue/Gray rotation
 *
 * `O` (religious and cultural observance) is INFORMATIONAL only — school is in
 * session on those days. All 11 of them verify as school days in the rotation.
 */

import type { DateKey } from './calendar'

/** The letter codes used on the printed FCPS calendar. */
export type FcpsCode =
  | 'F'   // First Day of School
  | 'QE'  // End of Quarter / 2-hour student early release
  | 'YE'  // Last day for regular classes / early release
  | 'O'   // Religious and cultural observance — school IS in session
  | 'OE'  // Observance, evening only — school IS in session
  | 'TW'  // Teacher Workday / Student Holiday
  | 'SD'  // Staff Development Day / Student Holiday
  | 'SP'  // School Planning Day / Student Holiday
  | 'H'   // Student Holiday
  | 'NT'  // New Teacher Training (outside the student year)

export type DayCategory =
  | 'instructional'
  | 'student_holiday'
  | 'teacher_workday'
  | 'staff_development'
  | 'school_planning'
  | 'new_teacher_training'
  | 'observance'
  | 'weekend'
  | 'out_of_term'

export interface YearCalendarEntry {
  date: DateKey
  code: FcpsCode
  /** Human label, taken from the PDF's per-month footnotes. */
  label: string
  /** Extra context printed alongside (sundown windows, etc.). */
  note?: string
}

/** Codes that mean students do not attend. */
export const NO_SCHOOL_CODES: readonly FcpsCode[] = ['H', 'TW', 'SD', 'SP', 'NT'] as const

/** Codes that shorten the day but keep it instructional. */
export const EARLY_RELEASE_CODES: readonly FcpsCode[] = ['QE', 'YE'] as const

export const CODE_LABEL: Record<FcpsCode, string> = {
  F: 'First Day of School',
  QE: 'End of Quarter — 2-hour early release',
  YE: 'Last day for regular classes — early release',
  O: 'Religious / cultural observance',
  OE: 'Religious / cultural observance (evening only)',
  TW: 'Teacher Workday — student holiday',
  SD: 'Staff Development Day — student holiday',
  SP: 'School Planning Day — student holiday',
  H: 'Student Holiday',
  NT: 'New Teacher Training',
}

export const CODE_CATEGORY: Record<FcpsCode, DayCategory> = {
  F: 'instructional',
  QE: 'instructional',
  YE: 'instructional',
  O: 'observance',
  OE: 'observance',
  TW: 'teacher_workday',
  SD: 'staff_development',
  SP: 'school_planning',
  H: 'student_holiday',
  NT: 'new_teacher_training',
}

// ── The calendar ────────────────────────────────────────────────────────────

export const YEAR_CALENDAR: readonly YearCalendarEntry[] = [
  // July 2026
  { date: '2026-07-03', code: 'H', label: 'Independence Day (observed)' },

  // August 2026 — staff week, then students arrive
  { date: '2026-08-10', code: 'NT', label: 'New Teacher Training' },
  { date: '2026-08-11', code: 'NT', label: 'New Teacher Training' },
  { date: '2026-08-12', code: 'NT', label: 'New Teacher Training' },
  { date: '2026-08-13', code: 'NT', label: 'New Teacher Training' },
  { date: '2026-08-14', code: 'TW', label: 'Teacher Workday' },
  { date: '2026-08-17', code: 'SP', label: 'School Planning Day' },
  { date: '2026-08-18', code: 'TW', label: 'Teacher Workday' },
  { date: '2026-08-19', code: 'SD', label: 'Staff Development Day' },
  { date: '2026-08-20', code: 'TW', label: 'Teacher Workday' },
  { date: '2026-08-21', code: 'SP', label: 'School Planning Day' },
  { date: '2026-08-24', code: 'F', label: 'First Day of School' },

  // September 2026
  { date: '2026-09-04', code: 'H', label: 'Labor Day Break' },
  { date: '2026-09-07', code: 'H', label: 'Labor Day' },
  { date: '2026-09-11', code: 'OE', label: 'Rosh Hashanah', note: 'Begins sundown 9/11 — sundown 9/13' },
  { date: '2026-09-21', code: 'H', label: 'Yom Kippur', note: 'Begins sundown 9/20 — sundown 9/21' },

  // October 2026
  { date: '2026-10-12', code: 'SP', label: 'Indigenous Peoples’ Day' },
  { date: '2026-10-30', code: 'QE', label: 'End of Quarter 1' },

  // November 2026
  { date: '2026-11-02', code: 'SP', label: 'School Planning Day', note: 'All Saints Day / Día de los Muertos' },
  { date: '2026-11-03', code: 'TW', label: 'Election Day — Teacher Workday' },
  { date: '2026-11-25', code: 'H', label: 'Thanksgiving Break' },
  { date: '2026-11-26', code: 'H', label: 'Thanksgiving Break' },
  { date: '2026-11-27', code: 'H', label: 'Thanksgiving Break' },

  // December 2026
  { date: '2026-12-04', code: 'OE', label: 'Chanukah', note: 'Begins sundown 12/4 — sundown 12/12' },
  { date: '2026-12-08', code: 'O', label: 'Bodhi Day' },
  { date: '2026-12-21', code: 'H', label: 'Winter Break' },
  { date: '2026-12-22', code: 'H', label: 'Winter Break' },
  { date: '2026-12-23', code: 'H', label: 'Winter Break' },
  { date: '2026-12-24', code: 'H', label: 'Winter Break' },
  { date: '2026-12-25', code: 'H', label: 'Christmas' },
  { date: '2026-12-28', code: 'H', label: 'Winter Break' },
  { date: '2026-12-29', code: 'H', label: 'Winter Break' },
  { date: '2026-12-30', code: 'H', label: 'Winter Break' },
  { date: '2026-12-31', code: 'H', label: 'Winter Break' },

  // January 2027
  { date: '2027-01-01', code: 'H', label: 'New Year’s Day' },
  { date: '2027-01-06', code: 'O', label: 'Three Kings Day / Epiphany' },
  { date: '2027-01-07', code: 'O', label: 'Orthodox Christmas' },
  { date: '2027-01-18', code: 'H', label: 'Martin Luther King, Jr.’s Birthday' },
  { date: '2027-01-19', code: 'O', label: 'Orthodox Epiphany' },
  { date: '2027-01-28', code: 'QE', label: 'End of Quarter 2' },
  { date: '2027-01-29', code: 'TW', label: 'Teacher Workday' },

  // February 2027
  { date: '2027-02-01', code: 'SD', label: 'Staff Development Day' },
  { date: '2027-02-08', code: 'O', label: 'First full day of Ramadan', note: 'Begins sundown 2/7, daily fast and nightly prayer until 3/8' },
  { date: '2027-02-15', code: 'H', label: 'Washington’s Birthday and Presidents’ Day' },

  // March 2027
  { date: '2027-03-09', code: 'OE', label: 'Eid al-Fitr', note: 'Begins sundown 3/9 — sundown 3/10' },
  { date: '2027-03-10', code: 'H', label: 'Eid al-Fitr' },
  { date: '2027-03-22', code: 'H', label: 'Spring Break' },
  { date: '2027-03-23', code: 'H', label: 'Spring Break' },
  { date: '2027-03-24', code: 'H', label: 'Spring Break' },
  { date: '2027-03-25', code: 'H', label: 'Spring Break' },
  { date: '2027-03-26', code: 'H', label: 'Spring Break', note: 'Good Friday' },

  // April 2027
  { date: '2027-04-16', code: 'QE', label: 'End of Quarter 3' },
  { date: '2027-04-19', code: 'TW', label: 'Teacher Workday' },
  { date: '2027-04-20', code: 'SD', label: 'Staff Development Day', note: 'Theravada New Year' },
  { date: '2027-04-21', code: 'OE', label: 'First Evening of Passover', note: 'Begins sundown 4/21 — sundown 4/29' },
  { date: '2027-04-22', code: 'OE', label: 'Second Evening of Passover' },
  { date: '2027-04-30', code: 'O', label: 'Orthodox Good Friday' },

  // May 2027
  { date: '2027-05-17', code: 'H', label: 'Eid al-Adha', note: 'Begins sundown 5/16 — sundown 5/17' },
  { date: '2027-05-31', code: 'H', label: 'Memorial Day' },

  // June 2027
  { date: '2027-06-16', code: 'YE', label: 'Last day for regular classes', note: 'End of Quarter 4 — early release' },
  { date: '2027-06-17', code: 'SD', label: 'Staff Development Day' },
  { date: '2027-06-18', code: 'H', label: 'Juneteenth (observed)' },
  { date: '2027-06-21', code: 'TW', label: 'Teacher Workday' },
] as const

/**
 * Observances printed in the footnotes but carrying no cell code — school runs
 * normally. Surfaced as context on the day, never as a closure.
 */
export const FOOTNOTE_OBSERVANCES: readonly { date: DateKey; label: string }[] = [
  { date: '2026-09-12', label: 'Rosh Hashanah' },
  { date: '2026-11-08', label: 'Diwali' },
  { date: '2026-11-11', label: 'Veterans Day' },
  { date: '2027-02-06', label: 'Lunar New Year' },
  { date: '2027-02-10', label: 'Ash Wednesday' },
  { date: '2027-03-20', label: 'Nowruz' },
  { date: '2027-03-28', label: 'Easter' },
  { date: '2027-05-02', label: 'Orthodox Easter' },
] as const

// ── Lookups ─────────────────────────────────────────────────────────────────

const BY_DATE = new Map<DateKey, YearCalendarEntry>(YEAR_CALENDAR.map((e) => [e.date, e]))
const OBS_BY_DATE = new Map<DateKey, string>(FOOTNOTE_OBSERVANCES.map((o) => [o.date, o.label]))

export function yearEntryFor(date: DateKey): YearCalendarEntry | undefined {
  return BY_DATE.get(date)
}

export function footnoteObservanceFor(date: DateKey): string | undefined {
  return OBS_BY_DATE.get(date)
}

export function isNoSchoolCode(code: FcpsCode): boolean {
  return (NO_SCHOOL_CODES as readonly string[]).includes(code)
}

export function isEarlyReleaseCode(code: FcpsCode): boolean {
  return (EARLY_RELEASE_CODES as readonly string[]).includes(code)
}

/** Every date the FCPS calendar marks as closed to students. */
export const NO_SCHOOL_DATES: readonly DateKey[] = YEAR_CALENDAR
  .filter((e) => isNoSchoolCode(e.code))
  .map((e) => e.date)
