import {
  createWritingTracker,
  formatDuration,
  formatDurationShort,
  wordsPerFocusMinute,
  focusPercent,
  countWords,
  THINK_LIMIT_MS,
  BLOCK_THINK_LIMIT_MS,
  REFERENCE_CAP_MS,
  timelineSeconds,
  timelineCount,
} from '@/lib/writing-session'

const S = 1000
const MIN = 60 * S

function tracker(extra: Partial<Parameters<typeof createWritingTracker>[0]> = {}) {
  return createWritingTracker({ id: 't', kind: 'create', startedAt: 0, ...extra })
}

/** Type one input every `every` ms from `from` to `to` inclusive. */
function type(t: ReturnType<typeof tracker>, from: number, to: number, every = 2 * S) {
  for (let ms = from; ms <= to; ms += every) t.input(ms)
}

describe('time buckets', () => {
  it('counts a quiet page as thinking up to the limit, then break', () => {
    const t = tracker()
    const s = t.snapshot(10 * MIN)
    expect(s.thinkMs).toBe(THINK_LIMIT_MS)
    expect(s.breakMs).toBe(10 * MIN - THINK_LIMIT_MS)
    expect(s.focusMs).toBe(THINK_LIMIT_MS)
    expect(s.pauseCount).toBe(1)
    expect(s.longestPauseMs).toBe(10 * MIN)
  })

  it('counts steady typing as writing', () => {
    const t = tracker()
    type(t, 0, 60 * S)
    const s = t.snapshot(60 * S)
    expect(s.writeMs).toBe(60 * S)
    expect(s.thinkMs).toBe(0)
    expect(s.typingSpanMs).toBe(60 * S)
    expect(s.inputEvents).toBe(31)
  })

  it('treats a 2-minute pause between sentences as thinking, not idle', () => {
    const t = tracker()
    type(t, 0, 30 * S)
    type(t, 2.5 * MIN, 3 * MIN)
    const s = t.snapshot(3 * MIN)
    expect(s.writeMs).toBe(60 * S)
    expect(s.thinkMs).toBe(2 * MIN)
    expect(s.breakMs).toBe(0)
    expect(s.focusMs).toBe(3 * MIN)
  })

  it('counts scrolling and reading the page as thinking', () => {
    const t = tracker()
    for (let ms = 0; ms <= 10 * MIN; ms += MIN) t.activity(ms)
    const s = t.snapshot(10 * MIN)
    expect(s.thinkMs).toBe(10 * MIN)
    expect(s.breakMs).toBe(0)
  })

  it('a click right before typing still counts as writing', () => {
    const t = tracker()
    t.input(0)
    t.activity(5 * S)  // click to move the cursor
    t.input(8 * S)
    const s = t.snapshot(8 * S)
    expect(s.writeMs).toBe(8 * S)
  })
})

describe('trips away', () => {
  it('a quick look (< 30s) counts as reference automatically', () => {
    const t = tracker()
    t.input(0)
    t.setForeground(false, 10 * S)
    t.setForeground(true, 30 * S)
    const s = t.snapshot(30 * S)
    expect(s.referenceMs).toBe(20 * S)
    expect(s.pendingAway).toBeNull()
    expect(s.hiddenCount).toBe(1)
  })

  it('a longer trip is pending until answered, and counts as break meanwhile', () => {
    const t = tracker()
    t.setForeground(false, MIN)
    t.setForeground(true, 6 * MIN)
    let s = t.snapshot(6 * MIN)
    expect(s.pendingAway).toEqual({ startedAt: MIN, durationMs: 5 * MIN })
    expect(s.breakMs).toBe(5 * MIN)
    expect(s.referenceMs).toBe(0)

    t.resolveAway('reference')
    s = t.snapshot(6 * MIN)
    expect(s.pendingAway).toBeNull()
    expect(s.referenceMs).toBe(5 * MIN)
    expect(s.breakMs).toBe(0)
    expect(s.focusMs).toBe(6 * MIN)
  })

  it('lists every unanswered trip and resolves a specific one', () => {
    const t = tracker()
    t.setForeground(false, MIN)
    t.setForeground(true, 11 * MIN)       // trip 1: 10 min
    t.setForeground(false, 12 * MIN)
    t.setForeground(true, 15 * MIN)       // trip 2: 3 min
    let s = t.snapshot(15 * MIN)
    expect(s.unansweredAways).toEqual([
      { startedAt: MIN, durationMs: 10 * MIN },
      { startedAt: 12 * MIN, durationMs: 3 * MIN },
    ])
    expect(s.pendingAway).toEqual({ startedAt: 12 * MIN, durationMs: 3 * MIN })
    expect(s.unansweredMs).toBe(13 * MIN)

    // Answer the older one first: the newer one stays pending.
    t.resolveAway('reference', MIN)
    s = t.snapshot(15 * MIN)
    expect(s.unansweredAways).toEqual([{ startedAt: 12 * MIN, durationMs: 3 * MIN }])
    expect(s.referenceMs).toBe(10 * MIN)
    expect(s.unansweredMs).toBe(3 * MIN)
    expect(s.breakMs).toBe(3 * MIN)       // unanswered still counts as break

    t.resolveAway('break', 12 * MIN)
    s = t.snapshot(15 * MIN)
    expect(s.unansweredAways).toEqual([])
    expect(s.unansweredMs).toBe(0)
    expect(s.breakMs).toBe(3 * MIN)
  })

  it('keeps unanswered time visible in the stored timeline', () => {
    const t = tracker()
    t.setForeground(false, MIN)
    t.setForeground(true, 5 * MIN)
    const s = t.snapshot(5 * MIN)
    expect(timelineSeconds(s.timeline, 'a')).toBe(4 * 60)
    expect(timelineCount(s.timeline, 'a')).toBe(1)
  })

  it('caps reference time per trip', () => {
    const t = tracker()
    t.setForeground(false, 0)
    t.setForeground(true, 50 * MIN)
    t.resolveAway('reference')
    const s = t.snapshot(50 * MIN)
    expect(s.referenceMs).toBe(REFERENCE_CAP_MS)
    expect(s.breakMs).toBe(50 * MIN - REFERENCE_CAP_MS)
  })

  it('a trip called a break is a break', () => {
    const t = tracker()
    t.setForeground(false, 0)
    t.setForeground(true, 3 * MIN)
    t.resolveAway('break')
    const s = t.snapshot(3 * MIN)
    expect(s.breakMs).toBe(3 * MIN)
    expect(s.breakCount).toBe(1)
  })

  it('treats an event while backgrounded as coming back', () => {
    const t = tracker()
    t.setForeground(false, MIN)
    t.activity(3 * MIN)
    const s = t.snapshot(3 * MIN)
    expect(s.awayMs).toBe(2 * MIN)
    expect(s.foregroundMs).toBe(MIN)
  })

  it('starts in background when told to', () => {
    const t = tracker({ foreground: false })
    const s = t.snapshot(MIN)
    expect(s.awayMs).toBe(MIN)
    expect(s.foregroundMs).toBe(0)
  })

  it('every millisecond lands in exactly one bucket', () => {
    const t = tracker()
    type(t, 0, 40 * S)
    t.setForeground(false, 50 * S)
    t.setForeground(true, 4 * MIN)
    t.resolveAway('reference')
    type(t, 5 * MIN, 6 * MIN)
    t.setForeground(false, 7 * MIN)
    const s = t.snapshot(20 * MIN)
    expect(s.writeMs + s.thinkMs + s.referenceMs + s.breakMs).toBe(s.openMs)
    const tl = s.timeline.reduce((n, [, d]) => n + d, 0)
    expect(tl).toBe(20 * 60)
  })
})

describe('focus blocks', () => {
  it('relaxes the think limit inside a block', () => {
    const t = tracker()
    t.startBlock(0)
    const s = t.snapshot(10 * MIN)
    expect(s.thinkMs).toBe(BLOCK_THINK_LIMIT_MS)
    expect(s.block?.remainingMs).toBe(10 * MIN)
    expect(s.block?.focusMs).toBe(BLOCK_THINK_LIMIT_MS)
  })

  it('completes a block when its time runs out', () => {
    const t = tracker()
    t.startBlock(0, 20 * MIN)
    type(t, 0, 20 * MIN, 10 * S)
    const s = t.snapshot(21 * MIN)
    expect(s.blocksStarted).toBe(1)
    expect(s.blocksCompleted).toBe(1)
    expect(s.block).toBeNull()
  })

  it('a cancelled block does not complete', () => {
    const t = tracker()
    t.startBlock(0, 20 * MIN)
    t.cancelBlock(5 * MIN)
    const s = t.snapshot(30 * MIN)
    expect(s.blocksStarted).toBe(1)
    expect(s.blocksCompleted).toBe(0)
  })

  it('ignores a second start while a block runs', () => {
    const t = tracker()
    t.startBlock(0)
    t.startBlock(MIN)
    expect(t.snapshot(2 * MIN).blocksStarted).toBe(1)
  })
})

describe('words, template, check-in', () => {
  it('does not count template text as written', () => {
    const t = tracker({ wordsStart: 0 })
    t.setWords(120)   // template loaded before typing
    t.input(S)
    t.setWords(320)
    t.setTemplate('reflection')
    const s = t.snapshot(MIN)
    expect(s.wordsStart).toBe(120)
    expect(s.wordsEnd).toBe(320)
    expect(s.template).toBe('reflection')
  })

  it('clamps the self-rating and stores distractions', () => {
    const t = tracker()
    t.setCheckIn({ selfRating: 9, distractions: ['Phone'] })
    const s = t.snapshot(MIN)
    expect(s.selfRating).toBe(5)
    expect(s.distractions).toEqual(['Phone'])
  })
})

describe('helpers', () => {
  it('formats durations', () => {
    expect(formatDuration(42 * S)).toBe('0:42')
    expect(formatDuration(12 * MIN + 5 * S)).toBe('12:05')
    expect(formatDuration(63 * MIN + 20 * S)).toBe('1:03:20')
    expect(formatDurationShort(45 * S)).toBe('45s')
    expect(formatDurationShort(8 * MIN)).toBe('8m')
    expect(formatDurationShort(72 * MIN)).toBe('1h 12m')
    expect(formatDurationShort(120 * MIN)).toBe('2h')
  })

  it('computes pace only with enough data', () => {
    expect(wordsPerFocusMinute({ wordsStart: 0, wordsEnd: 100, focusMs: 5 * MIN })).toBe(20)
    expect(wordsPerFocusMinute({ wordsStart: 0, wordsEnd: 5, focusMs: 10 * S })).toBeNull()
    expect(wordsPerFocusMinute({ wordsStart: 50, wordsEnd: 40, focusMs: 5 * MIN })).toBeNull()
  })

  it('computes focus percent', () => {
    expect(focusPercent({ focusMs: 3 * MIN, openMs: 4 * MIN })).toBe(75)
    expect(focusPercent({ focusMs: 0, openMs: S })).toBeNull()
  })

  it('counts words in HTML', () => {
    expect(countWords('<p>Hello <b>big</b>&nbsp;world</p><p>again</p>')).toBe(4)
    expect(countWords('')).toBe(0)
  })
})
