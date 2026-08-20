/**
 * Calendar resolution — one place that decides what a given date actually is.
 *
 * Three layers, highest precedence first:
 *
 *   1. Manual override   — a snow day, delay or one-off closure stored in the
 *                          database. This is the only layer that ever changes
 *                          during the year.
 *   2. FCPS year calendar — the published Standard School Year Calendar. A
 *                          student-holiday code here empties the day.
 *   3. Frost rotation    — Blue / Gray, which decides *which* classes meet.
 *
 * Everything downstream (planner seeding, Navigate, Course Prep) reads the
 * result of this function, so a closure only has to be expressed once.
 */

import { type DateKey, type DayType, dayTypeOf } from './calendar'
import type { ScheduleKind } from './bell'
import {
  type DayCategory,
  type FcpsCode,
  YEAR_CALENDAR,
  FOOTNOTE_OBSERVANCES,
  yearEntryFor,
  footnoteObservanceFor,
  isNoSchoolCode,
  isEarlyReleaseCode,
  CODE_LABEL,
  CODE_CATEGORY,
} from './year-calendar'

/** A row from the SchoolCalendarDay table, or an in-memory equivalent. */
export interface CalendarOverride {
  date: DateKey
  /** Students do not attend. Wins over everything. */
  noSchool?: boolean | null
  /** Force the rotation half (rarely needed — e.g. a make-up day). */
  rotation?: 'blue' | 'gray' | null
  /** Force a shortened schedule. */
  scheduleKind?: ScheduleKind | null
  label?: string | null
  category?: DayCategory | null
  note?: string | null
}

export interface ResolvedDay {
  date: DateKey
  /** blue | gray | holiday | weekend | summer, after all overrides. */
  type: DayType
  isSchoolDay: boolean
  category: DayCategory
  /** Why there is no school, when there isn't. */
  closureReason: string | null
  /** Which layer produced the closure. */
  closureSource: 'manual' | 'fcps' | 'rotation' | null
  /** The FCPS letter code for this date, if it carries one. */
  code: FcpsCode | null
  /** Religious or cultural observance falling on this date (informational). */
  observance: string | null
  observanceEveningOnly: boolean
  earlyRelease: boolean
  /** Shortened-schedule kind, if any. */
  forcedScheduleKind: ScheduleKind | null
  /** Free text from the calendar footnote or the manual override. */
  note: string | null
}

/**
 * Resolve one date through all three layers.
 * `override` is the DB row for this date, when there is one.
 */
export function resolveDay(date: DateKey, override?: CalendarOverride | null): ResolvedDay {
  const entry = yearEntryFor(date)
  const rotation = dayTypeOf(date)

  const base: ResolvedDay = {
    date,
    type: rotation,
    isSchoolDay: rotation === 'blue' || rotation === 'gray',
    category:
      rotation === 'weekend' ? 'weekend' :
      rotation === 'summer' ? 'out_of_term' :
      rotation === 'holiday' ? 'student_holiday' : 'instructional',
    closureReason: null,
    closureSource: null,
    code: entry?.code ?? null,
    observance: null,
    observanceEveningOnly: false,
    earlyRelease: false,
    forcedScheduleKind: null,
    note: entry?.note ?? null,
  }

  // ── layer 3 → 2: the FCPS year calendar ──
  if (entry) {
    if (isNoSchoolCode(entry.code)) {
      base.type = 'holiday'
      base.isSchoolDay = false
      base.category = CODE_CATEGORY[entry.code]
      base.closureReason = entry.label
      base.closureSource = 'fcps'
    } else if (isEarlyReleaseCode(entry.code)) {
      base.earlyRelease = true
      base.forcedScheduleKind = 'early-release'
    }
    if (entry.code === 'O' || entry.code === 'OE') {
      base.observance = entry.label
      base.observanceEveningOnly = entry.code === 'OE'
    }
  }

  // Footnote-only observances never close the day.
  if (!base.observance) {
    const obs = footnoteObservanceFor(date)
    if (obs) base.observance = obs
  }

  // Weekends and out-of-term days carry no closure reason — they are not
  // "cancelled", they are simply outside the school week.
  if (rotation === 'weekend') { base.category = 'weekend'; base.closureSource = null }
  else if (rotation === 'summer') { base.category = 'out_of_term'; base.closureSource = null }
  else if (rotation === 'holiday' && !base.closureReason) {
    base.closureReason = 'No school'
    base.closureSource = 'rotation'
  }

  // ── layer 1: manual override, wins over everything ──
  if (override) {
    if (override.rotation) {
      base.type = override.rotation
      base.isSchoolDay = true
      base.category = 'instructional'
      base.closureReason = null
      base.closureSource = null
    }
    if (override.noSchool) {
      base.type = 'holiday'
      base.isSchoolDay = false
      base.category = override.category ?? 'student_holiday'
      base.closureReason = override.label ?? 'No school'
      base.closureSource = 'manual'
    }
    if (override.scheduleKind) {
      base.forcedScheduleKind = override.scheduleKind
      base.earlyRelease = override.scheduleKind === 'early-release'
    }
    if (override.note) base.note = override.note
  }

  return base
}

/** Short human label for a resolved day, used in headers and badges. */
export function dayLabelOf(r: ResolvedDay): string {
  if (r.type === 'blue') return 'Blue Day'
  if (r.type === 'gray') return 'Gray Day'
  if (r.type === 'weekend') return 'Weekend'
  if (r.type === 'summer') return 'Out of term'
  return r.closureReason ?? 'No school'
}

/** The rows the ingest writes into SchoolCalendarDay, for the whole year. */
export function buildIngestRows(): {
  date: DateKey
  code: FcpsCode | null
  category: DayCategory
  label: string | null
  note: string | null
  noSchool: boolean
  earlyRelease: boolean
  rotation: 'blue' | 'gray' | null
}[] {
  const dates = new Set<DateKey>([
    ...YEAR_CALENDAR.map((e) => e.date),
    ...FOOTNOTE_OBSERVANCES.map((o) => o.date),
  ])
  return Array.from(dates).sort().map((date) => {
    const r = resolveDay(date, null)
    return {
      date,
      code: r.code,
      category: r.category,
      label: r.closureReason ?? r.observance ?? (r.code ? CODE_LABEL[r.code] : null),
      note: r.note,
      noSchool: !r.isSchoolDay && r.type === 'holiday',
      earlyRelease: r.earlyRelease,
      rotation: r.type === 'blue' || r.type === 'gray' ? r.type : null,
    }
  })
}
