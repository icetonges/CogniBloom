import {
  createWritingTracker,
  formatDuration,
  formatDurationShort,
  wordsPerActiveMinute,
  focusPercent,
  countWords,
} from '@/lib/writing-session'

const S = 1000
const MIN = 60 * S

function tracker(extra: Partial<Parameters<typeof createWritingTracker>[0]> = {}) {
  return createWritingTracker({ id: 't', kind: 'create', startedAt: 0, ...extra })
}

describe('writing-session tracker', () => {
  it('counts open time with no input as idle', () => {
    const t = tracker()
    const s = t.snapshot(5 * MIN)
    expect(s.openMs).toBe(5 * MIN)
    expect(s.foregroundMs).toBe(5 * MIN)
    expect(s.activeMs).toBe(0)
    expect(s.idleMs).toBe(5 * MIN)
    expect(s.firstInputAt).toBeNull()
    expect(s.typingSpanMs).toBe(0)
  })

  it('credits continuous typing plus a short tail', () => {
    const t = tracker()
    for (let ms = 10 * S; ms <= 70 * S; ms += 2 * S) t.input(ms)
    const s = t.snapshot(10 * MIN)
    // 60s of typing + 5s grace
    expect(s.activeMs).toBe(65 * S)
    expect(s.firstInputAt).toBe(10 * S)
    expect(s.lastInputAt).toBe(70 * S)
    expect(s.typingSpanMs).toBe(60 * S)
    expect(s.inputEvents).toBe(31)
    expect(s.idleMs).toBe(10 * MIN - 65 * S)
  })

  it('splits bursts on gaps longer than the idle threshold and records pauses', () => {
    const t = tracker()
    t.input(0)
    t.input(30 * S)      // same burst
    t.input(5 * MIN)     // 4.5 min gap → new burst, pause
    t.input(5 * MIN + 10 * S)
    const s = t.snapshot(6 * MIN)
    // burst 1: 30s + 5s grace; burst 2: 10s + 5s grace
    expect(s.activeMs).toBe(50 * S)
    expect(s.pauseCount).toBe(1)
    expect(s.longestPauseMs).toBe(4.5 * MIN)
    expect(s.typingSpanMs).toBe(5 * MIN + 10 * S)
  })

  it('does not count time in another tab, and stops the burst there', () => {
    const t = tracker()
    t.input(0)
    t.input(20 * S)
    t.setForeground(false, 22 * S)       // grace capped at 2s
    t.setForeground(true, 10 * MIN + 22 * S)
    const s = t.snapshot(11 * MIN)
    expect(s.hiddenCount).toBe(1)
    expect(s.awayMs).toBe(10 * MIN)
    expect(s.foregroundMs).toBe(MIN)
    expect(s.activeMs).toBe(22 * S)
    expect(s.idleMs).toBe(MIN - 22 * S)
  })

  it('treats an event while backgrounded as coming back', () => {
    const t = tracker()
    t.setForeground(false, MIN)
    t.activity(3 * MIN)
    const s = t.snapshot(4 * MIN)
    expect(s.awayMs).toBe(2 * MIN)
    expect(s.foregroundMs).toBe(2 * MIN)
  })

  it('counts non-typing activity as active but not as typing', () => {
    const t = tracker()
    t.activity(0)
    t.activity(40 * S)
    const s = t.snapshot(2 * MIN)
    expect(s.activeMs).toBe(45 * S)
    expect(s.inputEvents).toBe(0)
    expect(s.firstInputAt).toBeNull()
  })

  it('reports live grace for an open burst without over-crediting', () => {
    const t = tracker()
    t.input(0)
    expect(t.snapshot(2 * S).activeMs).toBe(2 * S)
    expect(t.snapshot(30 * S).activeMs).toBe(5 * S)
  })

  it('tracks words and template', () => {
    const t = tracker({ wordsStart: 0 })
    t.setWords(12)          // template loaded before typing: baseline moves
    t.input(1 * S)
    t.setWords(212)
    t.setTemplate('reflection')
    const s = t.snapshot(MIN)
    expect(s.wordsStart).toBe(12)
    expect(s.wordsEnd).toBe(212)
    expect(s.template).toBe('reflection')
  })

  it('starts in background when told to', () => {
    const t = tracker({ foreground: false })
    const s = t.snapshot(MIN)
    expect(s.foregroundMs).toBe(0)
    expect(s.awayMs).toBe(MIN)
  })
})

describe('writing-session helpers', () => {
  it('formats durations', () => {
    expect(formatDuration(42 * S)).toBe('0:42')
    expect(formatDuration(12 * MIN + 5 * S)).toBe('12:05')
    expect(formatDuration(63 * MIN + 20 * S)).toBe('1:03:20')
    expect(formatDurationShort(45 * S)).toBe('45s')
    expect(formatDurationShort(8 * MIN)).toBe('8m')
    expect(formatDurationShort(72 * MIN)).toBe('1h 12m')
    expect(formatDurationShort(120 * MIN)).toBe('2h')
  })

  it('computes WPM only with enough data', () => {
    expect(wordsPerActiveMinute({ wordsStart: 0, wordsEnd: 100, activeMs: 5 * MIN })).toBe(20)
    expect(wordsPerActiveMinute({ wordsStart: 0, wordsEnd: 5, activeMs: 10 * S })).toBeNull()
    expect(wordsPerActiveMinute({ wordsStart: 50, wordsEnd: 40, activeMs: 5 * MIN })).toBeNull()
  })

  it('computes focus percent', () => {
    expect(focusPercent({ activeMs: 3 * MIN, foregroundMs: 4 * MIN })).toBe(75)
    expect(focusPercent({ activeMs: 0, foregroundMs: 1 * S })).toBeNull()
  })

  it('counts words in HTML', () => {
    expect(countWords('<p>Hello <b>big</b>&nbsp;world</p><p>again</p>')).toBe(4)
    expect(countWords('')).toBe(0)
  })
})
