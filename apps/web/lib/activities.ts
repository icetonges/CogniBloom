/**
 * Recurring outside-school commitments that aren't school or soccer —
 * an online class, a lesson, anything with a fixed weekly slot and a known
 * start/end date. Static config, same shape as the old soccer PRACTICES
 * table: no live sync, just a declared schedule that seed-day turns into
 * planner rows for every matching date, the same way the school and soccer
 * bands are generated (see app/api/planner/seed-day/route.ts).
 *
 * Add a new activity here when Daniel enrolls in something new; remove (or
 * let its endDate pass) when it's done. There's no need to touch anything
 * else — seed-day picks it up automatically for every date in range.
 */

export interface RecurringActivity {
  /** Stable slug — used as a planner tag so seed-day can find "this
   *  activity's" rows again without depending on the title text. */
  id: string
  title: string
  details: string
  /** 0 = Sunday .. 6 = Saturday */
  weekday: number
  /** Eastern wall-clock "HH:mm" */
  start: string
  end: string
  /** Inclusive "YYYY-MM-DD" range. */
  startDate: string
  endDate: string
}

export const ACTIVITIES: RecurringActivity[] = [
  {
    id: 'codewizardshq-html-css',
    title: 'CodeWizardsHQ: Webpages with HTML & CSS',
    details: 'Live online class · building web pages with HTML & CSS',
    weekday: 3, // Wednesday
    start: '20:00',
    end: '21:00',
    startDate: '2026-09-16',
    endDate: '2026-12-09',
  },
]

/** Every activity scheduled on this Eastern calendar date. */
export function activitiesOn(dateKey: string): RecurringActivity[] {
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!y || !m || !d) return []
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return ACTIVITIES.filter(
    (a) => a.weekday === weekday && dateKey >= a.startDate && dateKey <= a.endDate
  )
}
