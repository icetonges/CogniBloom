import { NextRequest, NextResponse } from 'next/server'
import { getSchoolDay, upcomingDays, monthDays, toKey, COURSES, QUARTERS, COMPETITIONS } from '@/lib/school'

export const dynamic = 'force-dynamic'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

/**
 * GET /api/school/day?date=2026-08-24            → one day's full plan
 * GET /api/school/day?date=2026-08-24&week=1     → + the next 5 school days
 * GET /api/school/day?month=2026-09              → month grid of day types
 * GET /api/school/day?year=1                     → whole-year metadata
 *
 * The school schedule is static configuration, not user data, so this route is
 * unauthenticated by design and safe to cache client-side.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const month = searchParams.get('month')
  if (month) {
    if (!MONTH_RE.test(month)) {
      return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })
    }
    const [y, m] = month.split('-').map(Number)
    return NextResponse.json({ success: true, month, days: monthDays(y!, m!) })
  }

  if (searchParams.get('year')) {
    return NextResponse.json({
      success: true,
      quarters: QUARTERS,
      courses: COURSES,
      competitions: COMPETITIONS,
    })
  }

  const date = searchParams.get('date') ?? toKey(new Date())
  if (!DAY_RE.test(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  }
  const delayed = searchParams.get('delayed') === '1'

  const day = getSchoolDay(date, delayed)
  const week = searchParams.get('week') ? upcomingDays(date, 6) : undefined

  return NextResponse.json({
    success: true,
    day,
    ...(week ? { week: week.map(stripRoutes) } : {}),
  })
}

/** The week strip only needs headline info — drop the heavy route geometry. */
function stripRoutes(d: ReturnType<typeof getSchoolDay>) {
  return {
    ...d,
    periods: d.periods.map(({ routeIn: _r, lunchLeg: _l, ...rest }) => rest),
  }
}
