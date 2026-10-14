'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createWritingTracker,
  newSessionId,
  DEFAULT_BLOCK_MS,
  type AwayLabel,
  type CheckIn,
  type WritingSessionKind,
  type WritingSessionStats,
  type WritingTracker,
} from '@/lib/writing-session'

// Periodic save while the session is live, so a crash or closed laptop loses
// at most this much. Only sent when something changed since the last send.
const FLUSH_EVERY_MS = 30_000
const BLOCK_NOTICE_MS = 12_000

interface Options {
  /** Start tracking when true; a false→true flip starts a fresh session. */
  enabled: boolean
  /** Note the session belongs to. Null until the first save creates it. */
  noteId: string | null
  kind: WritingSessionKind
  template?: string | null
  words: number
}

export interface CompletedBlock { focusMs: number; durationMs: number }

// Typing keys are left out: the input event that follows is the real signal,
// and counting the keydown too would split one keystroke into two events.
const ACTIVITY_EVENTS = ['keydown', 'pointerdown', 'wheel', 'touchstart'] as const

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLInputElement) {
    return ['text', 'search', 'url', 'email', 'tel', 'number', ''].includes(target.type)
  }
  return false
}

function isForeground(): boolean {
  if (typeof document === 'undefined') return true
  return document.visibilityState === 'visible' && document.hasFocus()
}

function toPayload(s: WritingSessionStats) {
  const { block: _block, pendingAway: _pending, ...rest } = s
  return {
    ...rest,
    startedAt: new Date(s.startedAt).toISOString(),
    endedAt: new Date(s.endedAt).toISOString(),
    firstInputAt: s.firstInputAt === null ? null : new Date(s.firstInputAt).toISOString(),
    lastInputAt: s.lastInputAt === null ? null : new Date(s.lastInputAt).toISOString(),
  }
}

export function useWritingSession({ enabled, noteId, kind, template = null, words }: Options) {
  const trackerRef = useRef<WritingTracker | null>(null)
  const noteIdRef = useRef<string | null>(noteId)
  const dirtyRef = useRef(false)
  const blocksDoneRef = useRef(0)
  const [stats, setStats] = useState<WritingSessionStats | null>(null)
  const [completedBlock, setCompletedBlock] = useState<CompletedBlock | null>(null)
  // Last-seen focus of the running block, so the completion notice can report it.
  const blockFocus = useRef(0)
  const blockDuration = useRef(DEFAULT_BLOCK_MS)

  noteIdRef.current = noteId

  const refresh = useCallback(() => {
    const tracker = trackerRef.current
    if (!tracker) return
    const snap = tracker.snapshot(Date.now())
    setStats(snap)
    return snap
  }, [])

  /**
   * Send the cumulative snapshot. Safe to call repeatedly: the row is keyed by
   * the session id, so each send replaces the last. `keepalive` lets it finish
   * while the page navigates away.
   */
  const flush = useCallback((overrideNoteId?: string | null) => {
    const tracker = trackerRef.current
    const id = overrideNoteId ?? noteIdRef.current
    if (!tracker || !id) return
    const snap = tracker.snapshot(Date.now())
    // Nothing worth keeping: page opened and closed without a single input.
    if (snap.inputEvents === 0 && snap.selfRating === null && snap.blocksStarted === 0) return
    dirtyRef.current = false
    try {
      void fetch(`/api/notes/${id}/writing-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(snap)),
        keepalive: true,
      }).catch(() => { /* stats are best-effort */ })
    } catch { /* ignore */ }
  }, [])

  // Start / stop the session with `enabled`.
  useEffect(() => {
    if (!enabled) return
    const tracker = createWritingTracker({
      id: newSessionId(),
      kind,
      template,
      startedAt: Date.now(),
      wordsStart: words,
      foreground: isForeground(),
    })
    trackerRef.current = tracker
    blocksDoneRef.current = 0
    setStats(tracker.snapshot(Date.now()))

    const onActivity = (e: Event) => {
      if (e.type === 'keydown' && isEditable(e.target)) return
      tracker.activity(Date.now())
      dirtyRef.current = true
    }
    const onInput = (e: Event) => {
      if (!isEditable(e.target)) return
      tracker.input(Date.now())
      dirtyRef.current = true
    }
    const onFocusChange = () => {
      tracker.setForeground(isForeground(), Date.now())
      dirtyRef.current = true
      refresh()
    }
    const onPageHide = () => { tracker.setForeground(false, Date.now()); flush() }

    for (const ev of ACTIVITY_EVENTS) document.addEventListener(ev, onActivity, { capture: true, passive: true })
    document.addEventListener('input', onInput, { capture: true })
    document.addEventListener('visibilitychange', onFocusChange)
    window.addEventListener('focus', onFocusChange)
    window.addEventListener('blur', onFocusChange)
    window.addEventListener('pagehide', onPageHide)

    let noticeTimer: ReturnType<typeof setTimeout> | null = null
    const tick = setInterval(() => {
      const snap = tracker.snapshot(Date.now())
      setStats(snap)
      if (snap.blocksCompleted > blocksDoneRef.current) {
        blocksDoneRef.current = snap.blocksCompleted
        setCompletedBlock({ durationMs: blockDuration.current, focusMs: Math.min(blockFocus.current, blockDuration.current) })
        dirtyRef.current = true
        flush()
        if (noticeTimer) clearTimeout(noticeTimer)
        noticeTimer = setTimeout(() => setCompletedBlock(null), BLOCK_NOTICE_MS)
      }
      if (snap.block) {
        blockFocus.current = snap.block.focusMs
        blockDuration.current = snap.block.durationMs
      }
    }, 1000)
    const periodic = setInterval(() => { if (dirtyRef.current) flush() }, FLUSH_EVERY_MS)

    return () => {
      for (const ev of ACTIVITY_EVENTS) document.removeEventListener(ev, onActivity, { capture: true })
      document.removeEventListener('input', onInput, { capture: true })
      document.removeEventListener('visibilitychange', onFocusChange)
      window.removeEventListener('focus', onFocusChange)
      window.removeEventListener('blur', onFocusChange)
      window.removeEventListener('pagehide', onPageHide)
      clearInterval(tick)
      clearInterval(periodic)
      if (noticeTimer) clearTimeout(noticeTimer)
      // Leaving edit mode or unmounting ends the session: final send.
      flush()
      trackerRef.current = null
      setCompletedBlock(null)
    }
    // Only `enabled` starts a new session; the other inputs are fed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  useEffect(() => { trackerRef.current?.setWords(words) }, [words])
  useEffect(() => { trackerRef.current?.setTemplate(template) }, [template])

  // The note row appears after the first auto-save; send what we have so far.
  useEffect(() => { if (noteId && dirtyRef.current) flush() }, [noteId, flush])

  const resolveAway = useCallback((label: AwayLabel) => {
    trackerRef.current?.resolveAway(label)
    dirtyRef.current = true
    refresh()
  }, [refresh])

  const startBlock = useCallback((durationMs: number = DEFAULT_BLOCK_MS) => {
    trackerRef.current?.startBlock(Date.now(), durationMs)
    blockFocus.current = 0
    blockDuration.current = durationMs
    dirtyRef.current = true
    refresh()
  }, [refresh])

  const cancelBlock = useCallback(() => {
    trackerRef.current?.cancelBlock(Date.now())
    dirtyRef.current = true
    refresh()
  }, [refresh])

  /** Record the save-time check-in and send it right away. */
  const submitCheckIn = useCallback((checkIn: CheckIn, overrideNoteId?: string | null) => {
    trackerRef.current?.setCheckIn(checkIn)
    dirtyRef.current = true
    flush(overrideNoteId)
  }, [flush])

  /** Fresh snapshot on demand (e.g. for the check-in dialog). */
  const snapshotNow = useCallback(() => trackerRef.current?.snapshot(Date.now()) ?? null, [])

  return {
    stats: enabled ? stats : null,
    completedBlock: enabled ? completedBlock : null,
    dismissCompletedBlock: () => setCompletedBlock(null),
    flush,
    resolveAway,
    startBlock,
    cancelBlock,
    submitCheckIn,
    snapshotNow,
  }
}
