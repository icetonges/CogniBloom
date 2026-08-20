/**
 * Server-only bridge between the SchoolCalendarDay table and the pure
 * scheduling module in `lib/school`.
 *
 * `lib/school/*` stays free of Prisma so client components can import it. This
 * file is the only place the two meet, and every server route that needs a
 * calendar-aware day goes through `schoolDayFor` / `schoolDaysFor`.
 */

import 'server-only'
import { db } from '@/lib/db'
import {
  getSchoolDay,
  toKey,
  type CalendarOverride,
  type DateKey,
  type SchoolDay,
} from '@/lib/school'

type Row = {
  date: Date
  rotation: string | null
  noSchool: boolean
  earlyRelease: boolean
  scheduleKind: string | null
  code: string | null
  category: string | null
  label: string | null
  note: string | null
  source: string
}

function toOverride(r: Row): CalendarOverride {
  return {
    date: toKey(r.date),
    noSchool: r.noSchool,
    rotation: (r.rotation as 'blue' | 'gray' | null) ?? null,
    scheduleKind: (r.scheduleKind as CalendarOverride['scheduleKind']) ?? null,
    label: r.label,
    category: (r.category as CalendarOverride['category']) ?? null,
    note: r.note,
  }
}

const utc = (d: DateKey) => new Date(`${d}T00:00:00.000Z`)

/**
 * Overrides for a date range, keyed by "YYYY-MM-DD".
 *
 * Returns an empty map — rather than throwing — if the table does not exist
 * yet, so every page keeps working on the published FCPS calendar alone until
 * the migration is applied.
 */
export async function overridesFor(from: DateKey, to: DateKey): Promise<Map<DateKey, CalendarOverride>> {
  try {
    const rows = (await db.schoolCalendarDay.findMany({
      where: { date: { gte: utc(from), lte: utc(to) } },
      orderBy: { date: 'asc' },
    })) as Row[]
    return new Map(rows.map((r) => [toKey(r.date), toOverride(r)]))
  } catch (err) {
    if (isMissingTable(err)) {
      console.warn('[school-db] SchoolCalendarDay not found — run the migration; falling back to the static FCPS calendar.')
      return new Map()
    }
    throw err
  }
}

/** One fully-resolved school day, with any stored override applied. */
export async function schoolDayFor(date: DateKey, delayed = false): Promise<SchoolDay> {
  const map = await overridesFor(date, date)
  return getSchoolDay(date, { override: map.get(date) ?? null, delayed })
}

/** Several days in one query — used by the week strip and month grid. */
export async function schoolDaysFor(dates: DateKey[]): Promise<Map<DateKey, SchoolDay>> {
  if (dates.length === 0) return new Map()
  const sorted = [...dates].sort()
  const map = await overridesFor(sorted[0]!, sorted[sorted.length - 1]!)
  return new Map(dates.map((d) => [d, getSchoolDay(d, { override: map.get(d) ?? null })]))
}

/** True when the error is "relation does not exist" — i.e. migration pending. */
function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string }
  return e?.code === 'P2021' || /does not exist|relation .* does not exist/i.test(e?.message ?? '')
}
