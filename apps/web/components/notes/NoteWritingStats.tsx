'use client'

import { useEffect, useState } from 'react'
import { Timer, ChevronDown } from 'lucide-react'
import { formatDurationShort } from '@/lib/writing-session'

interface SessionRow {
  id: string
  kind: 'create' | 'edit'
  template: string | null
  startedAt: string
  endedAt: string
  openMs: number
  activeMs: number
  idleMs: number
  awayMs: number
  firstInputAt: string | null
  lastInputAt: string | null
  typingSpanMs: number
  inputEvents: number
  pauseCount: number
  longestPauseMs: number
  hiddenCount: number
  wordsStart: number
  wordsEnd: number
}

interface Totals {
  sessions: number
  openMs: number
  activeMs: number
  idleMs: number
  awayMs: number
  typingSpanMs: number
  inputEvents: number
  wordsAdded: number
  firstInputAt: string | null
  lastInputAt: string | null
}

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'
const day = (iso: string) =>
  new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })

/** Time-on-note summary shown under the note header. Hidden until there's data. */
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

  return (
    <div className="mt-3 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex flex-wrap items-center gap-x-2 gap-y-1 hover:text-foreground transition-colors"
      >
        <Timer className="h-3.5 w-3.5" />
        <span><b className="text-foreground">{formatDurationShort(totals.activeMs)}</b> active</span>
        <span className="text-muted-foreground/40">·</span>
        <span>{formatDurationShort(totals.openMs)} open</span>
        <span className="text-muted-foreground/40">·</span>
        <span>{formatDurationShort(totals.idleMs)} idle</span>
        {totals.wordsAdded > 0 && (<><span className="text-muted-foreground/40">·</span><span>+{totals.wordsAdded} words</span></>)}
        <span className="text-muted-foreground/40">·</span>
        <span>{totals.sessions} session{totals.sessions === 1 ? '' : 's'}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <table className="w-full text-[11px] tabular-nums">
            <thead>
              <tr className="text-left text-muted-foreground/70" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <th className="px-2 py-1.5 font-medium">When</th>
                <th className="px-2 py-1.5 font-medium">Open</th>
                <th className="px-2 py-1.5 font-medium">Active</th>
                <th className="px-2 py-1.5 font-medium">Idle</th>
                <th className="px-2 py-1.5 font-medium">Away</th>
                <th className="px-2 py-1.5 font-medium">First → last word</th>
                <th className="px-2 py-1.5 font-medium">Words</th>
                <th className="px-2 py-1.5 font-medium">Pauses</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {day(s.startedAt)} {time(s.startedAt)}
                    <span className="ml-1 text-muted-foreground/60">{s.kind === 'create' ? 'new' : 'edit'}</span>
                  </td>
                  <td className="px-2 py-1.5">{formatDurationShort(s.openMs)}</td>
                  <td className="px-2 py-1.5 text-foreground">{formatDurationShort(s.activeMs)}</td>
                  <td className="px-2 py-1.5">{formatDurationShort(s.idleMs)}</td>
                  <td className="px-2 py-1.5">{formatDurationShort(s.awayMs)}{s.hiddenCount > 0 ? ` (${s.hiddenCount}×)` : ''}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {s.firstInputAt ? `${time(s.firstInputAt)} → ${time(s.lastInputAt)} (${formatDurationShort(s.typingSpanMs)})` : '—'}
                  </td>
                  <td className="px-2 py-1.5">{s.wordsEnd - s.wordsStart >= 0 ? '+' : ''}{s.wordsEnd - s.wordsStart}</td>
                  <td className="px-2 py-1.5">{s.pauseCount}{s.longestPauseMs ? ` (max ${formatDurationShort(s.longestPauseMs)})` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
