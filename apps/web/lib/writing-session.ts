// Writing-session tracker — framework-free so it can be unit tested.
//
// One tracker covers one sitting with a note: the new-note page from mount to
// save, or one pass through edit mode on an existing note. It records:
//
//   openMs        wall clock since the session started
//   foregroundMs  time the tab was visible AND the window had focus
//   awayMs        openMs - foregroundMs (another tab/app, minimised, locked)
//   activeMs      time spent working: keys, clicks, scrolls, typing
//   idleMs        foregroundMs - activeMs (page in front of you, no input)
//   firstInputAt / lastInputAt / typingSpanMs
//                 first text change to last text change
//   inputEvents   number of text-changing input events (≈ keystrokes)
//   pauseCount / longestPauseMs
//                 gaps between text inputs longer than the idle threshold
//   hiddenCount   times the user left the page
//   wordsStart / wordsEnd
//
// Active time is built from bursts. Two activity events closer together than
// IDLE_THRESHOLD_MS count the whole gap as active. A burst also gets
// TAIL_GRACE_MS after its last event (reading back what you wrote, thinking
// about the next word), capped so it never runs past the next event or the
// moment the page lost focus.

export const IDLE_THRESHOLD_MS = 60_000
export const TAIL_GRACE_MS = 5_000

export type WritingSessionKind = 'create' | 'edit'

export interface WritingSessionStats {
  id: string
  kind: WritingSessionKind
  template: string | null
  startedAt: number
  endedAt: number
  openMs: number
  foregroundMs: number
  awayMs: number
  activeMs: number
  idleMs: number
  firstInputAt: number | null
  lastInputAt: number | null
  typingSpanMs: number
  inputEvents: number
  pauseCount: number
  longestPauseMs: number
  hiddenCount: number
  wordsStart: number
  wordsEnd: number
}

export interface WritingTrackerOptions {
  id: string
  kind: WritingSessionKind
  template?: string | null
  startedAt: number
  wordsStart?: number
  foreground?: boolean
  idleThresholdMs?: number
  tailGraceMs?: number
}

export interface WritingTracker {
  /** Any sign of life: keydown, pointer, wheel, touch. */
  activity(t: number): void
  /** A text-changing input event (also counts as activity). */
  input(t: number): void
  /** Tab visibility / window focus changed. */
  setForeground(foreground: boolean, t: number): void
  /** Current word count. Before the first input it also moves the baseline. */
  setWords(words: number): void
  setTemplate(template: string | null): void
  snapshot(t: number): WritingSessionStats
}

export function createWritingTracker(opts: WritingTrackerOptions): WritingTracker {
  const idle = opts.idleThresholdMs ?? IDLE_THRESHOLD_MS
  const grace = opts.tailGraceMs ?? TAIL_GRACE_MS
  const startedAt = opts.startedAt

  let template = opts.template ?? null
  let foreground = opts.foreground ?? true
  let foregroundSince: number | null = foreground ? startedAt : null
  let foregroundMs = 0
  let hiddenCount = 0

  // Active-time accounting. `settledActiveMs` holds closed bursts; the open
  // burst runs from burstStart to lastActivity (+ grace, computed on read).
  let settledActiveMs = 0
  let burstStart: number | null = null
  let lastActivity: number | null = null

  let firstInputAt: number | null = null
  let lastInputAt: number | null = null
  let inputEvents = 0
  let pauseCount = 0
  let longestPauseMs = 0

  // Until the first text input, the baseline follows the content, so a
  // template, restored draft or imported file is not counted as written.
  let wordsStart = opts.wordsStart ?? 0
  let wordsEnd = wordsStart

  /** Close the open burst, crediting grace up to `limit`. */
  const closeBurst = (limit: number) => {
    if (burstStart === null || lastActivity === null) return
    const tail = Math.max(0, Math.min(grace, limit - lastActivity))
    settledActiveMs += lastActivity - burstStart + tail
    burstStart = null
    lastActivity = null
  }

  const activity = (t: number) => {
    if (!foreground) {
      // An event while we think we're in the background means focus came
      // back without a focus event (some mobile browsers). Trust the event.
      setForeground(true, t)
    }
    if (lastActivity !== null && t - lastActivity <= idle) {
      lastActivity = Math.max(lastActivity, t)
      return
    }
    closeBurst(t)
    burstStart = t
    lastActivity = t
  }

  const input = (t: number) => {
    if (lastInputAt !== null) {
      const gap = t - lastInputAt
      if (gap > idle) {
        pauseCount += 1
        if (gap > longestPauseMs) longestPauseMs = gap
      }
    }
    if (firstInputAt === null) firstInputAt = t
    lastInputAt = t
    inputEvents += 1
    activity(t)
  }

  const setForeground = (next: boolean, t: number) => {
    if (next === foreground) return
    if (next) {
      foregroundSince = t
    } else {
      if (foregroundSince !== null) foregroundMs += Math.max(0, t - foregroundSince)
      foregroundSince = null
      hiddenCount += 1
      closeBurst(t)
    }
    foreground = next
  }

  const snapshot = (t: number): WritingSessionStats => {
    const openMs = Math.max(0, t - startedAt)
    const fg = foregroundMs + (foreground && foregroundSince !== null ? Math.max(0, t - foregroundSince) : 0)
    let active = settledActiveMs
    if (burstStart !== null && lastActivity !== null) {
      active += lastActivity - burstStart + Math.max(0, Math.min(grace, t - lastActivity))
    }
    active = Math.min(active, fg)
    return {
      id: opts.id,
      kind: opts.kind,
      template,
      startedAt,
      endedAt: t,
      openMs,
      foregroundMs: fg,
      awayMs: Math.max(0, openMs - fg),
      activeMs: active,
      idleMs: Math.max(0, fg - active),
      firstInputAt,
      lastInputAt,
      typingSpanMs: firstInputAt !== null && lastInputAt !== null ? lastInputAt - firstInputAt : 0,
      inputEvents,
      pauseCount,
      longestPauseMs,
      hiddenCount,
      wordsStart,
      wordsEnd,
    }
  }

  return {
    activity,
    input,
    setForeground,
    setWords: (w) => {
      wordsEnd = w
      if (firstInputAt === null) wordsStart = w
    },
    setTemplate: (tpl) => { template = tpl },
    snapshot,
  }
}

/** Words per minute of active time. Null when there isn't enough to measure. */
export function wordsPerActiveMinute(s: Pick<WritingSessionStats, 'wordsStart' | 'wordsEnd' | 'activeMs'>): number | null {
  const added = s.wordsEnd - s.wordsStart
  if (s.activeMs < 30_000 || added <= 0) return null
  return Math.round((added / (s.activeMs / 60_000)) * 10) / 10
}

/** Share of foreground time spent active, 0-100. */
export function focusPercent(s: Pick<WritingSessionStats, 'activeMs' | 'foregroundMs'>): number | null {
  if (s.foregroundMs < 5_000) return null
  return Math.round((s.activeMs / s.foregroundMs) * 100)
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
