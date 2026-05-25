/**
 * Timezone utilities — all day-boundary logic uses US Eastern time
 * (America/New_York) so "today" advances at Eastern midnight regardless
 * of where the Vercel edge function is running (UTC by default).
 */

const TZ = 'America/New_York'

/**
 * Returns the Eastern-time date string "MM/DD/YYYY" for a given UTC timestamp.
 */
export function toEasternDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/**
 * Compute the UTC equivalent of midnight (00:00:00) Eastern time for a given
 * calendar date expressed as (year, month 0-indexed, day).
 *
 * Strategy:
 *   1. Take noon UTC on that date — always the same calendar day everywhere.
 *   2. Format noon UTC in Eastern via toLocaleString → parsed back as local (UTC on server).
 *   3. The difference is the Eastern UTC offset for that day (handles EDT/EST automatically).
 *   4. Eastern midnight = UTC midnight + that offset.
 *
 * Example (EDT, UTC-4, May 24):
 *   noonUTC  = 2026-05-24T12:00:00Z
 *   easternNoon parsed as local UTC = 2026-05-24T08:00:00Z  (noon - 4h)
 *   offsetMs = 4h → result = 2026-05-24T04:00:00Z  ✓ (midnight EDT in UTC)
 */
function _easternMidnightUTC(y: number, m: number, d: number): Date {
  const noonUTC = new Date(Date.UTC(y, m, d, 12, 0, 0))
  // toLocaleString gives the wall-clock time in Eastern; new Date() parses it
  // as local time (UTC on Vercel/Node). The difference = Eastern UTC offset.
  const easternNoon = new Date(noonUTC.toLocaleString('en-US', { timeZone: TZ }))
  const offsetMs = noonUTC.getTime() - easternNoon.getTime()
  return new Date(Date.UTC(y, m, d) + offsetMs)
}

/**
 * Returns a JS Date representing midnight 00:00:00 Eastern time (expressed
 * as UTC) for the Eastern calendar day that contains `date`.
 *
 * Safe to use for >= / <= comparisons against DB `createdAt` timestamps.
 * Handles EDT (UTC-4) and EST (UTC-5) automatically.
 */
export function easternMidnight(date: Date = new Date()): Date {
  const str = toEasternDateString(date) // "MM/DD/YYYY" in Eastern time
  const [m, d, y] = str.split('/').map(Number)
  return _easternMidnightUTC(y!, m! - 1, d!)
}

/**
 * Convert a Prisma/Postgres DATE value to the UTC equivalent of Eastern midnight.
 *
 * Prisma returns a Postgres DATE column as a JS Date at UTC midnight:
 *   e.g., the Eastern calendar date "2026-05-24" → Date(2026-05-24T00:00:00Z).
 * The UTC date components (getUTCFullYear / getUTCMonth / getUTCDate) give the
 * correct calendar date; we then compute Eastern midnight from those components.
 *
 * Never call easternMidnight() on a Postgres DATE — that would interpret UTC
 * midnight as an Eastern moment (8 PM EDT the night before) and return the
 * wrong day's midnight.
 */
export function pgDateToEasternMidnight(pgDate: Date): Date {
  return _easternMidnightUTC(
    pgDate.getUTCFullYear(),
    pgDate.getUTCMonth(),
    pgDate.getUTCDate(),
  )
}

/**
 * Convenience: returns startOfDay, startOfWeek (last 7 days), startOfMonth
 * all anchored to Eastern midnight.
 */
export function easternDateBoundaries(): {
  now: Date
  startOfDay: Date
  startOfWeek: Date
  startOfMonth: Date
} {
  const now = new Date()
  const startOfDay = easternMidnight(now)

  const startOfWeek = new Date(startOfDay)
  startOfWeek.setDate(startOfDay.getDate() - 6)

  const startOfMonth = new Date(startOfDay)
  startOfMonth.setDate(1)

  return { now, startOfDay, startOfWeek, startOfMonth }
}

/**
 * Postgres SQL fragment that converts a UTC "createdAt" column to an
 * Eastern date string for DATE(...) grouping.
 *
 * Usage (tagged template safe):
 *   DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')
 */
export const EASTERN_DATE_SQL = `AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'`
