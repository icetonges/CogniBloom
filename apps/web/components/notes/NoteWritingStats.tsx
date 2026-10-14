'use client'

import { useEffect, useState } from 'react'
import { Timer, ChevronDown } from 'lucide-react'
import { formatDurationShort, timelineSeconds, timelineCount, type TimelineEntry } from '@/lib/writing-session'
import { FocusTimeline, FocusLegend } from '@/components/notes/FocusTimeline'

interface SessionRow {
  id: string
  kind: 'create' | 'edit'
  startedAt: string
  openMs: number
  activeMs: number
  idleMs: number
  awayMs: number
  firstInputAt: string | null
  lastInputAt: string | null
  typingSpanMs: number
  wordsStart: number
  wordsEnd: number
  writeMs: number
  thinkMs: number
  referenceMs: number
  breakMs: number
  focusMs: number
  breakCount: number
  blocksCompleted: number
  selfRating: number | null
  distractions: string[]
  timeline: TimelineEntry[] | null
}

interface Totals {
  sessions: number
  openMs: number
  focusMs: number
  writeMs: number
  thinkMs: number
  referenceMs: number
  breakMs: number
  wordsAdded: number
  blocksCompleted: number
}

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'
const day = (iso: string) =>
  new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
const Dot = () => <span className="text-muted-foreground/40">·</span>

/**
 * Time-on-note summary under the note header. Same view for student and
 * parent: nothing here is hidden from the person whose time it measures.
 */
export function NoteWritingStats({ noteId, refreshKey }: { noteId: string; refreshKey?: unknown }) {
  const [data, setData] = useState<{ sessions: SessionRow[]; totals: Totals } | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Give the final keepalive flush from edit mode a moment to land.
    const t = setTimeout(() => {
      fetch(`/api/notes/${noteId}/writing-sessions`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (!cancelled && j?.data) setData(j.data) })
        .catch(() => {})
    }, 600)
    return () => { cancelled = true; clearTimeout(t) }
  }, [noteId, refreshKey])

  if (!data || data.totals.sessions === 0) return null
  const { totals, sessions } = data
  // Unanswered away time lives in each session's timeline ('a'), inside breakMs.
  const unansweredTotalMs = sessions.reduce((n, s) => n + timelineSeconds(s.timeline, 'a') * 1000, 0)

  return (
    <div className="mt-3 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex flex-wrap items-center gap-x-2 gap-y-1 hover:text-foreground transition-colors"
      >
        <Timer className="h-3.5 w-3.5" />
        <span><b className="text-foreground">{formatDurationShort(totals.focusMs)}</b> focus</span>
        <Dot /><span>{formatDurationShort(totals.openMs)} open</span>
        {totals.wordsAdded > 0 && (<><Dot /><span>+{totals.wordsAdded} words</span></>)}
        {totals.blocksCompleted > 0 && (<><Dot /><span>{totals.blocksCompleted} focus block{totals.blocksCompleted === 1 ? '' : 's'}</span></>)}
        {unansweredTotalMs >= 60_000 && (<><Dot /><span className="text-amber-300/90">{formatDurationShort(unansweredTotalMs)} away, not answered</span></>)}
        <Dot /><span>{totals.sessions} session{totals.sessions === 1 ? '' : 's'}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          <FocusLegend codes={unansweredTotalMs > 0 ? ['w', 't', 'r', 'b', 'a'] : undefined} />
          {sessions.map((s) => {
            // v1 rows (before the focus split) only have active/idle/away.
            const v1 = !s.focusMs && !s.writeMs && !s.thinkMs && !s.referenceMs
            const focus = v1 ? s.activeMs : s.focusMs
            const unansweredMs = timelineSeconds(s.timeline, 'a') * 1000
            const unansweredN = timelineCount(s.timeline, 'a')
            const breaks = (v1 ? s.idleMs + s.awayMs : s.breakMs) - unansweredMs
            const breakN = s.timeline ? timelineCount(s.timeline, 'b') : s.breakCount
            const words = s.wordsEnd - s.wordsStart
            return (
              <div key={s.id} className="rounded-xl p-2.5" style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-foreground font-semibold">{day(s.startedAt)} {time(s.startedAt)}</span>
                  <span className="text-muted-foreground/60">{s.kind === 'create' ? 'new note' : 'edit'}</span>
                  <Dot /><span><b className="text-foreground">{formatDurationShort(focus)}</b> focus of {formatDurationShort(s.openMs)}</span>
                  {s.selfRating !== null && (<><Dot /><span>felt {s.selfRating}/5</span></>)}
                </div>
                {s.timeline && s.timeline.length > 0 && <div className="mt-1.5"><FocusTimeline timeline={s.timeline} height={6} /></div>}
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums">
                  {!v1 && <span>Writing {formatDurationShort(s.writeMs)}</span>}
                  {!v1 && <span>Thinking {formatDurationShort(s.thinkMs)}</span>}
                  {!v1 && s.referenceMs > 0 && <span>Reference {formatDurationShort(s.referenceMs)}</span>}
                  <span>Breaks {formatDurationShort(Math.max(0, breaks))}{breakN ? ` (${breakN})` : ''}</span>
                  {unansweredMs > 0 && (
                    <span className="text-amber-300/90" title="Left the page and never said whether it was reference or a break. Counted as break time.">
                      Away, not answered {formatDurationShort(unansweredMs)}{unansweredN > 1 ? ` (${unansweredN})` : ''}
                    </span>
                  )}
                  {s.firstInputAt && <span>Words {time(s.firstInputAt)} → {time(s.lastInputAt)}</span>}
                  <span>{words >= 0 ? '+' : ''}{words} words</span>
                  {s.blocksCompleted > 0 && <span className="text-emerald-300">{s.blocksCompleted} block{s.blocksCompleted === 1 ? '' : 's'}</span>}
                </div>
                {s.distractions.length > 0 && (
                  <div className="mt-1 text-[11px] text-muted-foreground/80">Pulled away by: {s.distractions.join(', ')}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
