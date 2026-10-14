import { summarizeSessions, dayKey, type SummaryRow } from '@/lib/writing-session-summary'

const MIN = 60_000
const TZ = 'America/New_York'

function row(iso: string, over: Partial<SummaryRow> = {}): SummaryRow {
  return {
    startedAt: new Date(iso), focusMs: 0, activeMs: 0, writeMs: 0, thinkMs: 0, referenceMs: 0,
    breakMs: 0, wordsStart: 0, wordsEnd: 0, blocksCompleted: 0, selfRating: null, ...over,
  }
}

describe('summarizeSessions', () => {
  const now = new Date('2026-10-14T20:00:00Z') // 4 PM in New York

  it('groups by the student\'s local day, not UTC', () => {
    // 01:30 UTC on the 14th is 21:30 on the 13th in New York.
    expect(dayKey(new Date('2026-10-14T01:30:00Z'), TZ)).toBe('2026-10-13')
    const s = summarizeSessions([row('2026-10-14T01:30:00Z', { focusMs: 5 * MIN })], TZ, now)
    expect(s.days.find((d) => d.date === '2026-10-13')?.focusMs).toBe(5 * MIN)
    expect(s.today.focusMs).toBe(0)
  })

  it('returns one entry per day in the window, oldest first', () => {
    const s = summarizeSessions([], TZ, now, 14)
    expect(s.days).toHaveLength(14)
    expect(s.days[0].date).toBe('2026-10-01')
    expect(s.today.date).toBe('2026-10-14')
  })

  it('compares today\'s pace with earlier days', () => {
    const rows = [
      row('2026-10-12T20:00:00Z', { focusMs: 20 * MIN, wordsEnd: 200 }), // 10 w/min
      row('2026-10-13T20:00:00Z', { focusMs: 10 * MIN, wordsEnd: 200 }), // 20 w/min
      row('2026-10-14T18:00:00Z', { focusMs: 10 * MIN, wordsEnd: 250 }), // 25 w/min today
    ]
    const s = summarizeSessions(rows, TZ, now)
    expect(s.today.pace).toBe(25)
    expect(s.recentPace).toBeCloseTo(13.3, 1) // 400 words / 30 min
    expect(s.bestPace).toBe(25)
    expect(s.recentFocusMs).toBe(15 * MIN)
  })

  it('falls back to activeMs for v1 rows', () => {
    const s = summarizeSessions([row('2026-10-14T18:00:00Z', { activeMs: 7 * MIN })], TZ, now)
    expect(s.today.focusMs).toBe(7 * MIN)
  })

  it('counts a streak that ends yesterday while today is still short', () => {
    const rows = [
      row('2026-10-11T20:00:00Z', { focusMs: 15 * MIN }),
      row('2026-10-12T20:00:00Z', { focusMs: 15 * MIN }),
      row('2026-10-13T20:00:00Z', { focusMs: 15 * MIN }),
      row('2026-10-14T18:00:00Z', { focusMs: 3 * MIN }),
    ]
    expect(summarizeSessions(rows, TZ, now).streakDays).toBe(3)
    rows.push(row('2026-10-14T19:00:00Z', { focusMs: 8 * MIN }))
    expect(summarizeSessions(rows, TZ, now).streakDays).toBe(4)
  })

  it('sums blocks over the last 7 days and averages ratings', () => {
    const rows = [
      row('2026-10-02T20:00:00Z', { blocksCompleted: 5 }),            // outside 7 days
      row('2026-10-10T20:00:00Z', { blocksCompleted: 2 }),
      row('2026-10-14T18:00:00Z', { blocksCompleted: 1, selfRating: 4 }),
      row('2026-10-14T19:00:00Z', { selfRating: 3 }),
    ]
    const s = summarizeSessions(rows, TZ, now)
    expect(s.blocksThisWeek).toBe(3)
    expect(s.today.avgRating).toBe(3.5)
  })
})
