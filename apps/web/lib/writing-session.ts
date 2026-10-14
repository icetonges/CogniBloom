// Writing-session tracker — framework-free so it can be unit tested.
//
// One tracker covers one sitting with a note: the new-note page from mount to
// save, or one pass through edit mode on an existing note.
//
// Every millisecond of the sitting lands in exactly one bucket:
//
//   write      typing: gaps of WRITE_GAP_MS or less next to a text input
//   think      on the page without typing: reading, scrolling, planning.
//              Each quiet stretch counts as thinking up to the think limit
//              (THINK_LIMIT_MS, or BLOCK_THINK_LIMIT_MS inside a focus block)
//   reference  left the page to look something up: short trips
//              (< AUTO_REFERENCE_MS) automatically, longer ones when the
//              student confirms on return, capped at REFERENCE_CAP_MS a trip
//   break      a quiet stretch past the think limit, a trip the student
//              called a break, or reference time past the cap
//   away       left the page and hasn't said why yet (counts as break)
//
//   focus = write + think + reference
//
// The tracker never judges a sitting from input alone. Reading a source or
// thinking before a sentence is part of the work, so it counts.

export const WRITE_GAP_MS = 20_000
export const THINK_LIMIT_MS = 4 * 60_000
export const BLOCK_THINK_LIMIT_MS = 6 * 60_000
export const AUTO_REFERENCE_MS = 30_000
export const REFERENCE_CAP_MS = 20 * 60_000
export const DEFAULT_BLOCK_MS = 20 * 60_000
const MAX_TIMELINE = 400

export type WritingSessionKind = 'create' | 'edit'
export type TimeKind = 'write' | 'think' | 'reference' | 'break' | 'away'
export type AwayLabel = 'reference' | 'break'

/** [offset seconds from start, duration seconds, kind code] */
export type TimelineCode = 'w' | 't' | 'r' | 'b' | 'a'
export type TimelineEntry = [number, number, TimelineCode]
const CODE: Record<TimeKind, TimelineCode> = { write: 'w', think: 't', reference: 'r', break: 'b', away: 'a' }

export const DISTRACTIONS = ['Phone', 'Someone talked to me', 'Got stuck', 'Tired', 'Another app or game', 'Nothing'] as const

export interface CheckIn {
  selfRating: number | null
  distractions: string[]
  /** Answers for trips away the student hadn't labelled yet. */
  awayAnswers?: { startedAt: number; label: AwayLabel }[]
}

export interface AwayTrip { startedAt: number; durationMs: number }

export interface BlockState {
  startedAt: number
  durationMs: number
  remainingMs: number
  focusMs: number
}

export interface WritingSessionStats {
  id: string
  kind: WritingSessionKind
  template: string | null
  startedAt: number
  endedAt: number

  openMs: number
  foregroundMs: number
  awayMs: number

  writeMs: number
  thinkMs: number
  referenceMs: number
  breakMs: number          // includes unanswered away time (stored that way)
  /** Away time nobody has answered for yet. Part of breakMs. */
  unansweredMs: number
  focusMs: number
  breakCount: number

  // Kept for the first version's columns: on-page focused / on-page break.
  activeMs: number
  idleMs: number

  firstInputAt: number | null
  lastInputAt: number | null
  typingSpanMs: number
  inputEvents: number
  pauseCount: number       // on-page quiet stretches past the think limit
  longestPauseMs: number
  hiddenCount: number

  wordsStart: number
  wordsEnd: number

  blocksStarted: number
  blocksCompleted: number
  block: BlockState | null // the running block, live only

  /** The most recent trip away that still needs an answer. Live only. */
  pendingAway: AwayTrip | null
  /** Every trip away that still needs an answer, oldest first. Live only. */
  unansweredAways: AwayTrip[]

  selfRating: number | null
  distractions: string[]
  timeline: TimelineEntry[]
}

export interface WritingTrackerOptions {
  id: string
  kind: WritingSessionKind
  template?: string | null
  startedAt: number
  wordsStart?: number
  foreground?: boolean
}

export interface WritingTracker {
  /** Sign of life on the page: pointer, wheel, touch, non-typing keys. */
  activity(t: number): void
  /** A text-changing input event. */
  input(t: number): void
  /** Tab visibility / window focus changed. */
  setForeground(foreground: boolean, t: number): void
  /** Label a trip away: the one that started at `startedAt`, or the most recent unanswered one. */
  resolveAway(label: AwayLabel, startedAt?: number): void
  startBlock(t: number, durationMs?: number): void
  cancelBlock(t: number): void
  /** Current word count. Before the first input it also moves the baseline. */
  setWords(words: number): void
  setTemplate(template: string | null): void
  setCheckIn(checkIn: CheckIn): void
  snapshot(t: number): WritingSessionStats
}

interface Interval { s: number; e: number; k: TimeKind }
interface Away { s: number; e: number | null; label: AwayLabel | 'auto' | null }
interface Block { s: number; dur: number; cancelledAt: number | null }

export function createWritingTracker(opts: WritingTrackerOptions): WritingTracker {
  const startedAt = opts.startedAt
  let template = opts.template ?? null

  let foreground = opts.foreground ?? true
  let lastSignal = startedAt
  let lastWasInput = false
  const page: Interval[] = []
  const aways: Away[] = foreground ? [] : [{ s: startedAt, e: null, label: null }]
  const blocks: Block[] = []

  let firstInputAt: number | null = null
  let lastInputAt: number | null = null
  let inputEvents = 0
  let hiddenCount = foreground ? 0 : 1

  let wordsStart = opts.wordsStart ?? 0
  let wordsEnd = wordsStart
  let checkIn: CheckIn = { selfRating: null, distractions: [] }

  const blockAt = (t: number): Block | null => {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i]
      const end = b.cancelledAt ?? b.s + b.dur
      if (t >= b.s && t < end) return b
    }
    return null
  }

  /** Classify one stretch on the page into `out`. */
  const classify = (from: number, to: number, nearInput: boolean, out: Interval[]) => {
    if (to <= from) return
    const gap = to - from
    if (nearInput && gap <= WRITE_GAP_MS) { out.push({ s: from, e: to, k: 'write' }); return }
    const limit = blockAt(from) ? BLOCK_THINK_LIMIT_MS : THINK_LIMIT_MS
    const thinkEnd = Math.min(to, from + limit)
    out.push({ s: from, e: thinkEnd, k: 'think' })
    if (to > thinkEnd) out.push({ s: thinkEnd, e: to, k: 'break' })
  }

  const setForeground = (next: boolean, t: number) => {
    if (next === foreground) return
    if (next) {
      const a = aways[aways.length - 1]
      if (a && a.e === null) {
        a.e = Math.max(a.s, t)
        if (a.e - a.s < AUTO_REFERENCE_MS) a.label = 'auto'
      }
      lastSignal = Math.max(lastSignal, t)
      lastWasInput = false
    } else {
      const end = Math.max(lastSignal, t)
      classify(lastSignal, end, lastWasInput, page)
      lastSignal = end
      aways.push({ s: end, e: null, label: null })
      hiddenCount += 1
    }
    foreground = next
  }

  const signal = (t: number, isInput: boolean) => {
    // An event while we think we're in the background means focus came back
    // without a focus event (some mobile browsers). Trust the event.
    if (!foreground) setForeground(true, t)
    const at = Math.max(lastSignal, t)
    classify(lastSignal, at, isInput || lastWasInput, page)
    lastSignal = at
    lastWasInput = isInput
  }

  const awayIntervals = (a: Away, now: number): Interval[] => {
    const e = a.e ?? now
    if (e <= a.s) return []
    if (a.label === 'auto' || a.label === 'reference') {
      const capEnd = Math.min(e, a.s + REFERENCE_CAP_MS)
      const out: Interval[] = [{ s: a.s, e: capEnd, k: 'reference' }]
      if (e > capEnd) out.push({ s: capEnd, e, k: 'break' })
      return out
    }
    return [{ s: a.s, e, k: a.label === 'break' ? 'break' : 'away' }]
  }

  const pageAt = (now: number): Interval[] => {
    const out = page.slice()
    if (foreground) classify(lastSignal, Math.max(lastSignal, now), lastWasInput, out)
    return out
  }

  const merge = (all: Interval[]): Interval[] => {
    all.sort((x, y) => x.s - y.s)
    const merged: Interval[] = []
    for (const iv of all) {
      const last = merged[merged.length - 1]
      if (last && last.k === iv.k && iv.s <= last.e) last.e = Math.max(last.e, iv.e)
      else merged.push({ ...iv })
    }
    return merged
  }

  const sumIn = (ivs: Interval[], from: number, to: number, kinds: TimeKind[]) => {
    let total = 0
    for (const iv of ivs) {
      if (!kinds.includes(iv.k)) continue
      const s = Math.max(iv.s, from), e = Math.min(iv.e, to)
      if (e > s) total += e - s
    }
    return total
  }

  const snapshot = (now: number): WritingSessionStats => {
    const pageIvs = pageAt(now)
    const ivs = merge([...pageIvs, ...aways.flatMap((a) => awayIntervals(a, now))])
    const sum = (k: TimeKind) => ivs.reduce((n, iv) => (iv.k === k ? n + iv.e - iv.s : n), 0)
    const writeMs = sum('write'), thinkMs = sum('think'), referenceMs = sum('reference')
    const unansweredMs = sum('away')
    const breakMs = sum('break') + unansweredMs
    const openMs = Math.max(0, now - startedAt)

    let awayMs = 0
    for (const a of aways) awayMs += Math.max(0, (a.e ?? now) - a.s)

    // On-page pauses: think stretch + the break that follows it.
    let idleMs = 0, pauseCount = 0, longestPauseMs = 0
    for (let i = 0; i < pageIvs.length; i++) {
      const iv = pageIvs[i]
      if (iv.k !== 'break') continue
      idleMs += iv.e - iv.s
      pauseCount += 1
      const prev = pageIvs[i - 1]
      const len = iv.e - (prev && prev.k === 'think' && prev.e === iv.s ? prev.s : iv.s)
      if (len > longestPauseMs) longestPauseMs = len
    }

    let blocksCompleted = 0
    let block: BlockState | null = null
    for (const b of blocks) {
      const end = b.s + b.dur
      if (b.cancelledAt !== null) continue
      if (now >= end) blocksCompleted += 1
      else if (now >= b.s) {
        block = {
          startedAt: b.s,
          durationMs: b.dur,
          remainingMs: end - now,
          focusMs: sumIn(ivs, b.s, now, ['write', 'think', 'reference']),
        }
      }
    }

    const unansweredAways: AwayTrip[] = aways
      .filter((a) => a.e !== null && a.label === null)
      .map((a) => ({ startedAt: a.s, durationMs: (a.e as number) - a.s }))
    const pendingAway = unansweredAways.length ? unansweredAways[unansweredAways.length - 1] : null

    const timeline: TimelineEntry[] = ivs
      .map((iv): TimelineEntry => [
        Math.round((iv.s - startedAt) / 1000),
        Math.max(1, Math.round((iv.e - iv.s) / 1000)),
        CODE[iv.k],
      ])
      .slice(-MAX_TIMELINE)

    return {
      id: opts.id,
      kind: opts.kind,
      template,
      startedAt,
      endedAt: now,
      openMs,
      foregroundMs: Math.max(0, openMs - awayMs),
      awayMs,
      writeMs,
      thinkMs,
      referenceMs,
      breakMs,
      unansweredMs,
      focusMs: writeMs + thinkMs + referenceMs,
      breakCount: ivs.filter((iv) => iv.k === 'break' || iv.k === 'away').length,
      activeMs: writeMs + thinkMs,
      idleMs,
      firstInputAt,
      lastInputAt,
      typingSpanMs: firstInputAt !== null && lastInputAt !== null ? lastInputAt - firstInputAt : 0,
      inputEvents,
      pauseCount,
      longestPauseMs,
      hiddenCount,
      wordsStart,
      wordsEnd,
      blocksStarted: blocks.length,
      blocksCompleted,
      block,
      pendingAway,
      unansweredAways,
      selfRating: checkIn.selfRating,
      distractions: checkIn.distractions,
      timeline,
    }
  }

  return {
    activity: (t) => signal(t, false),
    input: (t) => {
      if (firstInputAt === null) firstInputAt = t
      lastInputAt = t
      inputEvents += 1
      signal(t, true)
    },
    setForeground,
    resolveAway: (label, at) => {
      for (let i = aways.length - 1; i >= 0; i--) {
        const a = aways[i]
        if (a.e === null || a.label !== null) continue
        if (at === undefined || a.s === at) { a.label = label; return }
      }
    },
    startBlock: (t, durationMs = DEFAULT_BLOCK_MS) => {
      if (blockAt(t)) return
      blocks.push({ s: t, dur: durationMs, cancelledAt: null })
    },
    cancelBlock: (t) => {
      const b = blockAt(t)
      if (b) b.cancelledAt = t
    },
    setWords: (w) => {
      wordsEnd = w
      if (firstInputAt === null) wordsStart = w
    },
    setTemplate: (tpl) => { template = tpl },
    setCheckIn: (c) => {
      const rating = c.selfRating === null ? null : Math.min(5, Math.max(1, Math.round(c.selfRating)))
      checkIn = { selfRating: rating, distractions: c.distractions.slice(0, 8) }
    },
    snapshot,
  }
}

/** Words added per minute of focus time. Null when there isn't enough to measure. */
export function wordsPerFocusMinute(s: Pick<WritingSessionStats, 'wordsStart' | 'wordsEnd' | 'focusMs'>): number | null {
  const added = s.wordsEnd - s.wordsStart
  if (s.focusMs < 60_000 || added <= 0) return null
  return Math.round((added / (s.focusMs / 60_000)) * 10) / 10
}

/** Share of the sitting spent focused, 0-100. */
export function focusPercent(s: Pick<WritingSessionStats, 'focusMs' | 'openMs'>): number | null {
  if (s.openMs < 30_000) return null
  return Math.round((s.focusMs / s.openMs) * 100)
}

/** 0:42, 12:05, 1:03:20 */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** "1h 12m", "8m", "45s" — for summaries where seconds are noise. */
export function formatDurationShort(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  if (total < 60) return `${total}s`
  const h = Math.floor(total / 3600)
  const m = Math.round((total % 3600) / 60)
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function countWords(html: string): number {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim().split(/\s+/).filter(Boolean).length
}

/** Random id for a session, generated client-side so repeated flushes upsert one row. */
export function newSessionId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export const KIND_LABEL: Record<TimelineCode, string> = {
  w: 'Writing', t: 'Thinking', r: 'Reference', b: 'Break', a: 'Away, not answered',
}

/** Colors for the timeline strip; one per kind, readable on the dark UI. */
export const KIND_COLOR: Record<TimelineCode, string> = {
  w: '#34d399', t: '#60a5fa', r: '#a78bfa', b: 'rgba(255,255,255,0.14)', a: 'rgba(251,191,36,0.45)',
}

/** Total seconds of a timeline kind, e.g. unanswered away time ('a') in a stored session. */
export function timelineSeconds(timeline: TimelineEntry[] | null | undefined, code: TimelineCode): number {
  if (!timeline) return 0
  return timeline.reduce((n, [, d, k]) => (k === code ? n + d : n), 0)
}

/** Number of separate stretches of a timeline kind. */
export function timelineCount(timeline: TimelineEntry[] | null | undefined, code: TimelineCode): number {
  if (!timeline) return 0
  return timeline.filter(([, , k]) => k === code).length
}
