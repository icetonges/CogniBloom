'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isProgressComplete, progressFingerprint, type StoredSummary } from '@/lib/reflection-summary'

// Wait this long after the last keystroke before summarizing, so it doesn't
// fire halfway through his last sentence.
export const SUMMARY_DEBOUNCE_MS = 5000

interface Options {
  noteId: string | null
  html: string
  /** Generate automatically when section 14 is (re)finished. Off in read-only views. */
  auto: boolean
  /** Current focus time from the writing timer, read at generation time. */
  getFocusMs?: () => number | null
}

export type SummaryStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Loads the stored reflection summary and, when `auto` is on, generates a new
 * one a few seconds after the three section-14 lines are finished, or after
 * he changes them. Edits elsewhere in the note don't regenerate on their
 * own; `generate()` (the Refresh button) covers those.
 */
export function useReflectionSummary({ noteId, html, auto, getFocusMs }: Options) {
  const [summary, setSummary] = useState<StoredSummary | null>(null)
  const [status, setStatus] = useState<SummaryStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [popup, setPopup] = useState<StoredSummary | null>(null)

  const complete = useMemo(() => isProgressComplete(html), [html])
  const fingerprint = useMemo(() => progressFingerprint(html), [html])

  // Section-14 answers we already have a summary for (stored or just generated).
  const baselineRef = useRef<string | null | undefined>(undefined)
  // Section-14 answers when auto mode started (page opened / edit mode entered).
  // Without a stored summary, only a change from these triggers a summary, so
  // opening an old finished note doesn't fire one by itself.
  const autoStartRef = useRef<string | null | undefined>(undefined)
  const inflightRef = useRef<string | null>(null)
  const htmlRef = useRef(html)
  htmlRef.current = html
  const focusRef = useRef(getFocusMs)
  focusRef.current = getFocusMs

  useEffect(() => {
    autoStartRef.current = auto ? progressFingerprint(htmlRef.current) : undefined
  }, [auto])

  // Load what's stored for this note.
  useEffect(() => {
    if (!noteId) return
    let cancelled = false
    fetch(`/api/notes/${noteId}/reflection-summary`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return
        const stored = (j?.data ?? null) as StoredSummary | null
        setSummary(stored)
        if (stored) setStatus('ready')
        baselineRef.current = stored ? stored.fingerprint : undefined
        setLoaded(true)
      })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [noteId])

  const generate = useCallback(async (opts: { showPopup?: boolean } = {}) => {
    if (!noteId) return
    const fp = progressFingerprint(htmlRef.current)
    inflightRef.current = fp
    setStatus('loading')
    setError(null)
    try {
      const res = await fetch(`/api/notes/${noteId}/reflection-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlRef.current, focusMs: focusRef.current?.() ?? null }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok || !j?.data) throw new Error(j?.error ?? 'Could not make the summary right now.')
      const stored = j.data as StoredSummary
      baselineRef.current = stored.fingerprint
      setSummary(stored)
      setStatus('ready')
      if (opts.showPopup) setPopup(stored)
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Could not make the summary right now.')
    } finally {
      inflightRef.current = null
    }
  }, [noteId])

  // Auto-generate when section 14 is finished with answers we haven't summarized.
  useEffect(() => {
    if (!auto || !loaded || !noteId || !complete || !fingerprint) return
    const baseline = baselineRef.current !== undefined ? baselineRef.current : autoStartRef.current
    if (fingerprint === baseline || fingerprint === inflightRef.current) return
    const t = setTimeout(() => { void generate({ showPopup: true }) }, SUMMARY_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [auto, loaded, noteId, complete, fingerprint, generate])

  return {
    summary,
    status,
    error,
    complete,
    /** True when section 14 has changed since the stored summary was made. */
    outdated: !!summary?.fingerprint && !!fingerprint && summary.fingerprint !== fingerprint,
    /** Whether an outdated summary will refresh by itself (edit mode). */
    autoRefresh: auto,
    generate,
    popup,
    closePopup: () => setPopup(null),
  }
}
