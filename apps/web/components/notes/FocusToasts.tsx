'use client'

import { BookOpen, Coffee, PartyPopper, X } from 'lucide-react'
import { formatDurationShort, type AwayLabel, type WritingSessionStats } from '@/lib/writing-session'
import type { CompletedBlock } from '@/hooks/useWritingSession'

interface Props {
  stats: WritingSessionStats | null
  completedBlock: CompletedBlock | null
  onResolveAway: (label: AwayLabel, startedAt?: number) => void
  onDismissBlock: () => void
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/**
 * Bottom-of-screen notices for the writing session:
 * - "Welcome back" after a trip away, asking whether it was reference or a break.
 *   Every unanswered trip gets asked about, most recent first.
 * - "Block complete" when a focus block finishes
 */
export function FocusToasts({ stats, completedBlock, onResolveAway, onDismissBlock }: Props) {
  const trips = stats?.unansweredAways ?? []
  const away = trips.length ? trips[trips.length - 1] : null
  const earlier = trips.length - 1
  if (!away && !completedBlock) return null

  return (
    <div className="fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {away && (
        <div
          role="status"
          className="pointer-events-auto w-full max-w-md rounded-2xl px-4 py-3 text-sm shadow-2xl"
          style={{ background: 'rgba(10,18,34,0.97)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <p className="text-foreground">
            {earlier === 0 ? 'Welcome back. ' : ''}You were away <b>{formatDurationShort(away.durationMs)}</b>
            {earlier > 0 ? <> at {clock(away.startedAt)}</> : null}. Were you checking a reference?
          </p>
          {earlier > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {earlier} earlier trip{earlier === 1 ? '' : 's'} away still to answer after this one.
            </p>
          )}
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => onResolveAway('reference', away.startedAt)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-violet-200"
              style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)' }}
            >
              <BookOpen className="h-3.5 w-3.5" /> Yes, reference
            </button>
            <button
              type="button"
              onClick={() => onResolveAway('break', away.startedAt)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-muted-foreground"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Coffee className="h-3.5 w-3.5" /> Took a break
            </button>
          </div>
        </div>
      )}

      {completedBlock && (
        <div
          role="status"
          className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-2xl"
          style={{ background: 'rgba(6,40,30,0.97)', border: '1px solid rgba(52,211,153,0.4)' }}
        >
          <PartyPopper className="h-5 w-5 shrink-0 text-emerald-300" />
          <p className="flex-1 text-emerald-100">
            Focus block complete. <b>{formatDurationShort(completedBlock.focusMs)}</b> of {formatDurationShort(completedBlock.durationMs)} focused.
            Take a short break or start another.
          </p>
          <button type="button" onClick={onDismissBlock} aria-label="Dismiss" className="text-emerald-200/70 hover:text-emerald-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
