'use client'

import { useEffect, useRef, useState } from 'react'
import { Timer, Target, X } from 'lucide-react'
import {
  formatDuration,
  focusPercent,
  wordsPerFocusMinute,
  DEFAULT_BLOCK_MS,
  type WritingSessionStats,
} from '@/lib/writing-session'
import { FocusTimeline, FocusLegend } from '@/components/notes/FocusTimeline'

function clock(ms: number | null): string {
  if (ms === null) return '—'
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

interface Props {
  stats: WritingSessionStats | null
  onStartBlock: (durationMs?: number) => void
  onCancelBlock: () => void
}

/** Live focus timer for the editor top bar, with an optional 20-minute focus block. */
export function WritingTimer({ stats, onStartBlock, onCancelBlock }: Props) {
  const [open, setOpen] = useState(false)
  // Fixed position under the chip, so a clipping parent (the top bar) can't cut it off.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const place = () => {
      const r = boxRef.current?.getBoundingClientRect()
      if (!r) return
      const width = Math.min(320, window.innerWidth - 32)
      setPos({ top: r.bottom + 8, left: Math.max(16, Math.min(r.left, window.innerWidth - width - 16)) })
    }
    place()
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  if (!stats) return null
  const focus = focusPercent(stats)
  const pace = wordsPerFocusMinute(stats)
  const added = stats.wordsEnd - stats.wordsStart
  const block = stats.block

  const rows: [string, string, string?][] = [
    ['Focus', formatDuration(stats.focusMs), 'writing + thinking + reference'],
    ['  Writing', formatDuration(stats.writeMs)],
    ['  Thinking', formatDuration(stats.thinkMs), 'on the page, reading or planning'],
    ['  Reference', formatDuration(stats.referenceMs), 'looking things up'],
    ['Breaks', formatDuration(stats.breakMs), stats.breakCount ? `${stats.breakCount} break${stats.breakCount === 1 ? '' : 's'}` : undefined],
    ['Page open', formatDuration(stats.openMs), `since ${clock(stats.startedAt)}`],
    ['First → last word', formatDuration(stats.typingSpanMs), stats.firstInputAt ? `${clock(stats.firstInputAt)} → ${clock(stats.lastInputAt)}` : undefined],
    ['Words added', `${added >= 0 ? '+' : ''}${added}`, pace !== null ? `${pace} words per focus minute` : undefined],
    ['Focus blocks', String(stats.blocksCompleted), stats.blocksStarted > stats.blocksCompleted + (block ? 1 : 0) ? 'some stopped early' : undefined],
  ]

  return (
    <div ref={boxRef} className="relative flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full tabular-nums transition-colors whitespace-nowrap"
        style={block
          ? { background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)', color: '#6ee7b7' }
          : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        title="Focus time (click for details)"
      >
        {block ? <Target className="h-2.5 w-2.5 shrink-0" /> : <Timer className="h-2.5 w-2.5 shrink-0" />}
        {block ? `${formatDuration(block.remainingMs)} left` : `${formatDuration(stats.focusMs)} focus`}
      </button>

      {block ? (
        <button
          type="button"
          onClick={onCancelBlock}
          className="text-[10px] p-1 rounded-full text-muted-foreground hover:text-foreground"
          title="Stop focus block"
          aria-label="Stop focus block"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onStartBlock(DEFAULT_BLOCK_MS)}
          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          title="Start a 20-minute focus block"
        >
          <Target className="h-2.5 w-2.5" /> Focus 20
        </button>
      )}

      {open && pos && (
        <div
          className="fixed z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl p-3 text-xs shadow-xl"
          style={{ top: pos.top, left: pos.left, background: 'rgba(10,18,34,0.97)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-baseline justify-between mb-2">
            <span className="font-bold text-foreground">This session</span>
            {focus !== null && <span className="text-muted-foreground">{focus}% of the time focused</span>}
          </div>

          {block && (
            <div className="mb-2 rounded-lg px-2 py-1.5" style={{ background: 'rgba(52,211,153,0.08)' }}>
              <span className="text-emerald-300 font-semibold">Focus block running</span>
              <span className="text-muted-foreground"> · {formatDuration(block.focusMs)} focused so far · {formatDuration(block.remainingMs)} left</span>
            </div>
          )}

          <div className="mb-2 space-y-1">
            <FocusTimeline timeline={stats.timeline} />
            <FocusLegend />
          </div>

          <dl className="space-y-1">
            {rows.map(([label, value, hint]) => (
              <div key={label} className="flex items-baseline gap-2">
                <dt className={`w-28 shrink-0 text-muted-foreground ${label.startsWith('  ') ? 'pl-3' : ''}`}>{label.trim()}</dt>
                <dd className="flex-1 min-w-0">
                  <span className="font-semibold text-foreground tabular-nums">{value}</span>
                  {hint && <span className="ml-1.5 text-[10px] text-muted-foreground/70">{hint}</span>}
                </dd>
              </div>
            ))}
          </dl>

          {!block && (
            <button
              type="button"
              onClick={() => { onStartBlock(DEFAULT_BLOCK_MS); setOpen(false) }}
              className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-semibold text-emerald-300"
              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)' }}
            >
              <Target className="h-3.5 w-3.5" /> Start a 20-minute focus block
            </button>
          )}

          <p className="mt-2 pt-2 text-[10px] leading-relaxed text-muted-foreground/60" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            Quiet time on the page counts as thinking for up to 4 minutes (6 in a focus block).
            Leaving to look something up counts as reference when you say so on return.
          </p>
        </div>
      )}
    </div>
  )
}
