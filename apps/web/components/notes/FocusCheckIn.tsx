'use client'

import { useEffect, useState } from 'react'
import { Loader2, Flame, TrendingUp } from 'lucide-react'
import {
  DISTRACTIONS,
  focusPercent,
  formatDurationShort,
  wordsPerFocusMinute,
  type CheckIn,
  type WritingSessionStats,
} from '@/lib/writing-session'
import type { WritingSummary } from '@/lib/writing-session-summary'
import { FocusTimeline, FocusLegend } from '@/components/notes/FocusTimeline'

/** Only ask when there was real work to reflect on. */
export const CHECK_IN_MIN_FOCUS_MS = 2 * 60_000

const RATINGS: [number, string][] = [
  [1, 'Hardly'], [2, 'A little'], [3, 'Mostly'], [4, 'Very'], [5, 'Fully'],
]

interface Props {
  stats: WritingSessionStats
  busy?: boolean
  onSubmit: (checkIn: CheckIn) => void
  onSkip: () => void
}

/**
 * Ten-second check-in after saving: how focused did it feel, what got in the
 * way. After the student answers, it shows what the timer measured so they
 * can compare the two. Comparisons are only ever against their own history.
 */
export function FocusCheckIn({ stats, busy, onSubmit, onSkip }: Props) {
  const [rating, setRating] = useState<number | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [summary, setSummary] = useState<WritingSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    fetch(`/api/writing-sessions/summary?tz=${encodeURIComponent(tz)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.data) setSummary(j.data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const measured = focusPercent(stats)
  const pace = wordsPerFocusMinute(stats)
  const added = Math.max(0, stats.wordsEnd - stats.wordsStart)

  const toggle = (d: string) => {
    setPicked((cur) => {
      if (d === 'Nothing') return cur.includes('Nothing') ? [] : ['Nothing']
      const without = cur.filter((x) => x !== 'Nothing')
      return without.includes(d) ? without.filter((x) => x !== d) : [...without, d]
    })
  }

  let paceLine: string | null = null
  if (pace !== null && summary?.recentPace) {
    if (summary.bestPace !== null && pace >= summary.bestPace) paceLine = `Your best pace in two weeks (usually ${summary.recentPace}).`
    else if (pace >= summary.recentPace) paceLine = `Faster than your usual ${summary.recentPace}.`
    else paceLine = `Your usual is ${summary.recentPace}. Some topics just take more thinking.`
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-title"
        className="w-full max-w-md rounded-2xl p-5 text-sm shadow-2xl"
        style={{ background: 'rgba(10,18,34,0.98)', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        <h2 id="checkin-title" className="text-base font-black text-foreground">Saved. Quick check-in</h2>

        <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span><b className="text-foreground text-base">{formatDurationShort(stats.focusMs)}</b> <span className="text-muted-foreground">focus</span></span>
            {added > 0 && <span className="text-muted-foreground">+{added} words</span>}
            {pace !== null && <span className="text-muted-foreground">{pace} words / focus min</span>}
            {stats.blocksCompleted > 0 && <span className="text-emerald-300">{stats.blocksCompleted} block{stats.blocksCompleted === 1 ? '' : 's'} done</span>}
          </div>
          <div className="mt-2 space-y-1">
            <FocusTimeline timeline={stats.timeline} />
            <FocusLegend />
          </div>
          {paceLine && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" /> {paceLine}
            </p>
          )}
          {summary && (summary.streakDays > 1 || summary.blocksThisWeek > 0) && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Flame className="h-3.5 w-3.5 shrink-0 text-amber-300" />
              {summary.streakDays > 1 && <span>{summary.streakDays}-day focus streak.</span>}
              {summary.blocksThisWeek > 0 && <span>{summary.blocksThisWeek} focus block{summary.blocksThisWeek === 1 ? '' : 's'} this week.</span>}
            </p>
          )}
        </div>

        <p className="mt-4 font-semibold text-foreground">How focused did you feel?</p>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {RATINGS.map(([n, label]) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-pressed={rating === n}
              className="flex flex-col items-center rounded-xl py-2 text-xs transition-all"
              style={rating === n
                ? { background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(129,140,248,0.6)', color: 'white' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span className="text-base font-black">{n}</span>
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </button>
          ))}
        </div>
        {rating !== null && measured !== null && (
          <p className="mt-2 text-xs text-muted-foreground">
            The timer counted <b className="text-foreground">{measured}%</b> of this session as focused.
            {' '}Does that match how it felt?
          </p>
        )}

        <p className="mt-4 font-semibold text-foreground">Anything pull you away? <span className="font-normal text-muted-foreground">(optional)</span></p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DISTRACTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              aria-pressed={picked.includes(d)}
              className="rounded-full px-3 py-1 text-xs transition-all"
              style={picked.includes(d)
                ? { background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(129,140,248,0.6)', color: 'white' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="flex-1 rounded-xl py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => onSubmit({ selfRating: rating, distractions: picked })}
            disabled={busy || rating === null}
            className="flex flex-[2] items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.9), rgba(139,92,246,0.9))' }}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Done
          </button>
        </div>
      </div>
    </div>
  )
}
