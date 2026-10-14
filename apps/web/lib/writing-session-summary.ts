// Personal-history summary for writing sessions: per-day totals and how today
// compares with the student's own recent days. No fixed targets, no ranking
// against anyone else.

export interface SummaryRow {
  startedAt: Date
  focusMs: number
  activeMs: number   // v1 fallback when focusMs is 0
  writeMs: number
  thinkMs: number
  referenceMs: number
  breakMs: number
  wordsStart: number
  wordsEnd: number
  blocksCompleted: number
  selfRating: number | null
}

export interface DaySummary {
  date: string        // YYYY-MM-DD in the student's time zone
  sessions: number
  focusMs: number
  writeMs: number
  thinkMs: number
  referenceMs: number
  breakMs: number
  wordsAdded: number
  blocksCompleted: number
  pace: number | null // words per focus minute
  avgRating: number | null
}

export interface WritingSummary {
  timeZone: string
  days: DaySummary[]           // oldest first, one entry per day in the window
  today: DaySummary
  /** Average pace over the earlier days in the window (not today). */
  recentPace: number | null
  /** Best single-day pace in the window, today included. */
  bestPace: number | null
  /** Average focus per active day over the earlier days. */
  recentFocusMs: number | null
  blocksThisWeek: number
  /** Consecutive days, ending today or yesterday, with 10+ min of focus. */
  streakDays: number
}

const STREAK_MIN_FOCUS_MS = 10 * 60_000
const MIN_PACE_FOCUS_MS = 3 * 60_000

export function dayKey(d: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return d.toLocaleDateString('en-CA', { timeZone })
}

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

function pace(words: number, focusMs: number): number | null {
  if (focusMs < MIN_PACE_FOCUS_MS || words <= 0) return null
  return Math.round((words / (focusMs / 60_000)) * 10) / 10
}

export function summarizeSessions(rows: SummaryRow[], timeZone: string, now: Date, windowDays = 14): WritingSummary {
  const todayKey = dayKey(now, timeZone)
  const keys: string[] = []
  for (let i = windowDays - 1; i >= 0; i--) keys.push(shiftKey(todayKey, -i))

  const byDay = new Map<string, DaySummary & { ratingSum: number; ratingN: number }>()
  for (const k of keys) {
    byDay.set(k, {
      date: k, sessions: 0, focusMs: 0, writeMs: 0, thinkMs: 0, referenceMs: 0, breakMs: 0,
      wordsAdded: 0, blocksCompleted: 0, pace: null, avgRating: null, ratingSum: 0, ratingN: 0,
    })
  }

  for (const r of rows) {
    const d = byDay.get(dayKey(r.startedAt, timeZone))
    if (!d) continue
    d.sessions += 1
    d.focusMs += r.focusMs || r.activeMs
    d.writeMs += r.writeMs
    d.thinkMs += r.thinkMs
    d.referenceMs += r.referenceMs
    d.breakMs += r.breakMs
    d.wordsAdded += Math.max(0, r.wordsEnd - r.wordsStart)
    d.blocksCompleted += r.blocksCompleted
    if (r.selfRating !== null) { d.ratingSum += r.selfRating; d.ratingN += 1 }
  }

  const days: DaySummary[] = keys.map((k) => {
    const { ratingSum, ratingN, ...d } = byDay.get(k)!
    return {
      ...d,
      pace: pace(d.wordsAdded, d.focusMs),
      avgRating: ratingN ? Math.round((ratingSum / ratingN) * 10) / 10 : null,
    }
  })

  const today = days[days.length - 1]
  const earlier = days.slice(0, -1).filter((d) => d.sessions > 0)
  const earlierWords = earlier.reduce((n, d) => n + d.wordsAdded, 0)
  const earlierFocus = earlier.reduce((n, d) => n + d.focusMs, 0)
  const paces = days.map((d) => d.pace).filter((p): p is number => p !== null)

  let streakDays = 0
  // Today still in progress: start counting from yesterday if today is short.
  let i = today.focusMs >= STREAK_MIN_FOCUS_MS ? days.length - 1 : days.length - 2
  while (i >= 0 && days[i].focusMs >= STREAK_MIN_FOCUS_MS) { streakDays += 1; i-- }

  return {
    timeZone,
    days,
    today,
    recentPace: pace(earlierWords, earlierFocus),
    bestPace: paces.length ? Math.max(...paces) : null,
    recentFocusMs: earlier.length ? Math.round(earlierFocus / earlier.length) : null,
    blocksThisWeek: days.slice(-7).reduce((n, d) => n + d.blocksCompleted, 0),
    streakDays,
  }
}

export function isValidTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}
