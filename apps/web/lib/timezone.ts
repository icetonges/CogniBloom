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
 * Returns a JS Date representing midnight 00:00:00.000 on the Eastern
 * calendar day that contains `date`.  Safe to use for >= / <= comparisons
 * against other easternMidnight() values.
 */
export function easternMidnight(date: Date = new Date()): Date {
  const str = toEasternDateString(date) // "MM/DD/YYYY"
  const [m, d, y] = str.split('/').map(Number)
  return new Date(y!, m! - 1, d!)
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
