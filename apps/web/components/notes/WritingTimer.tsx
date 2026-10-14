'use client'

import { useEffect, useRef, useState } from 'react'
import { Timer } from 'lucide-react'
import {
  formatDuration,
  focusPercent,
  wordsPerActiveMinute,
  type WritingSessionStats,
} from '@/lib/writing-session'

function clock(ms: number | null): string {
  if (ms === null) return '—'
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

/** Live session timer: a chip showing active time, with a breakdown on click. */
export function WritingTimer({ stats }: { stats: WritingSessionStats | null }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  if (!stats) return null
  const focus = focusPercent(stats)
  const wpm = wordsPerActiveMinute(stats)
  const added = stats.wordsEnd - stats.wordsStart

  const rows: [string, string, string?][] = [
    ['Page open', formatDuration(stats.openMs), `since ${clock(stats.startedAt)}`],
    ['Active', formatDuration(stats.activeMs), 'typing, clicking, scrolling'],
    ['Idle on page', formatDuration(stats.idleMs), 'page in front, no input'],
    ['Away', formatDuration(stats.awayMs), `left the page ${stats.hiddenCount}×`],
    ['First → last word', formatDuration(stats.typingSpanMs), `${clock(stats.firstInputAt)} → ${clock(stats.lastInputAt)}`],
    ['Pauses > 1 min', String(stats.pauseCount), stats.longestPauseMs ? `longest ${formatDuration(stats.longestPauseMs)}` : undefined],
    ['Words added', `${added >= 0 ? '+' : ''}${added}`, wpm !== null ? `${wpm} words / active min` : undefined],
    ['Keystrokes', String(stats.inputEvents)],
  ]

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground px-2 py-0.5 rounded-full tabular-nums hover:text-foreground transition-colors"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        title="Time on this note (click for details)"
      >
        <Timer className="h-2.5 w-2.5 shrink-0" />
        {formatDuration(stats.activeMs)}
        <span className="hidden sm:inline text-muted-foreground/60">/ {formatDuration(stats.openMs)}</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 z-50 w-72 rounded-xl p-3 text-xs shadow-xl"
          style={{ background: 'rgba(10,18,34,0.97)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-baseline justify-between mb-2">
            <span className="font-bold text-foreground">This session</span>
            {focus !== null && <span className="text-muted-foreground">{focus}% focused</span>}
          </div>
          <dl className="space-y-1.5">
            {rows.map(([label, value, hint]) => (
              <div key={label} className="flex items-baseline gap-2">
                <dt className="text-muted-foreground w-28 shrink-0">{label}</dt>
                <dd className="flex-1 min-w-0">
                  <span className="font-semibold text-foreground tabular-nums">{value}</span>
                  {hint && <span className="block text-[10px] text-muted-foreground/70 truncate">{hint}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 pt-2 text-[10px] text-muted-foreground/60" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            Saved with the note. A gap over 1 minute with no input counts as idle.
          </p>
        </div>
      )}
    </div>
  )
}
