'use client'

import { useState } from 'react'
import { ClipboardList, RefreshCw, Loader2, Copy, Check, X, Trophy, Puzzle, CalendarClock, Lightbulb, Users, PartyPopper, Timer } from 'lucide-react'
import type { StoredSummary } from '@/lib/reflection-summary'
import type { SummaryStatus } from '@/hooks/useReflectionSummary'

const when = (iso: string) =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function Section({ icon: Icon, title, color, items }: { icon: typeof Trophy; title: string; color: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <p className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${color}`}>
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-sm text-foreground/90">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface CardProps {
  summary: StoredSummary | null
  status: SummaryStatus
  error: string | null
  complete: boolean
  outdated: boolean
  /** Edit mode: an outdated summary refreshes by itself. */
  autoRefresh?: boolean
  onRefresh: () => void
}

/** The full reflection summary, for the right-hand side. */
export function ReflectionSummaryCard({ summary, status, error, complete, outdated, autoRefresh, onRefresh }: CardProps) {
  const [copied, setCopied] = useState(false)
  const loading = status === 'loading'

  const copyParent = async () => {
    if (!summary?.parentNote) return
    try { await navigator.clipboard.writeText(summary.parentNote); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  if (!summary) {
    return (
      <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="flex items-center gap-2 font-semibold text-foreground"><ClipboardList className="h-4 w-4 text-cyan-300" /> Reflection summary</p>
        <p className="mt-1.5 text-muted-foreground">
          {complete
            ? 'Section 14 is done. Your summary will show up here in a few seconds.'
            : 'Finish the three lines in "14. Progress Summary" and your summary shows up here automatically.'}
        </p>
        {complete && (
          <button type="button" onClick={onRefresh} disabled={loading} className="mt-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-cyan-200 disabled:opacity-50" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.35)' }}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardList className="h-3.5 w-3.5" />}
            {loading ? 'Summarizing…' : 'Summarize now'}
          </button>
        )}
        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(34,211,238,0.07))', border: '1px solid rgba(129,140,248,0.3)' }}>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5 text-cyan-300" />
          <span>Reflection summary · {when(summary.generatedAt)}</span>
          {summary.focusMinutes !== null && (
            <span className="flex items-center gap-1 rounded-full px-1.5 py-0.5" style={{ background: 'rgba(52,211,153,0.1)' }}>
              <Timer className="h-3 w-3 text-emerald-300" /> {summary.focusMinutes} min focus
            </span>
          )}
          <button type="button" onClick={onRefresh} disabled={loading} title="Make a fresh summary" className="ml-auto p-1 hover:text-foreground disabled:opacity-50">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
        </div>
        <h3 className="mt-2 text-lg font-bold leading-snug text-foreground" style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}>{summary.headline}</h3>
        <p className="mt-1.5 text-sm text-foreground/90">{summary.quickSummary}</p>
        {outdated && !loading && (
          <p className="mt-2 text-xs text-amber-200/90">
            {autoRefresh
              ? 'You changed section 14 since this was made. It refreshes on its own in a few seconds.'
              : 'Section 14 changed since this was made. Press ↻ for a fresh summary.'}
          </p>
        )}
        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      </div>

      <Section icon={Trophy} title="Wins" color="text-amber-300" items={summary.wins} />
      <Section icon={Puzzle} title="Still working on" color="text-violet-300" items={summary.stillWorkingOn} />
      <Section icon={CalendarClock} title="Tomorrow" color="text-cyan-300" items={summary.tomorrow} />

      {summary.tip && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)' }}>
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-300"><Lightbulb className="h-3.5 w-3.5" /> Study tip</p>
          <p className="mt-1 text-sm text-foreground/90">{summary.tip}</p>
        </div>
      )}

      {summary.parentNote && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> For a parent or teacher
            <button type="button" onClick={copyParent} className="ml-auto flex items-center gap-1 normal-case tracking-normal font-normal hover:text-foreground">
              {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
            </button>
          </div>
          <p className="mt-1 text-sm text-foreground/90">{summary.parentNote}</p>
        </div>
      )}
    </div>
  )
}

/** The quick pop-up shown when a fresh summary arrives. */
export function ReflectionSummaryPopup({ summary, onClose, onOpenFull }: { summary: StoredSummary; onClose: () => void; onOpenFull: () => void }) {
  return (
    <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-popup-title"
        className="relative w-full max-w-md rounded-2xl p-5 shadow-2xl"
        style={{ background: 'rgba(10,18,34,0.98)', border: '1px solid rgba(129,140,248,0.35)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
          <PartyPopper className="h-3.5 w-3.5" /> Reflection done
        </p>
        <h2 id="summary-popup-title" className="mt-1.5 pr-6 text-xl font-bold leading-snug text-foreground">{summary.headline}</h2>
        <p className="mt-2 text-sm text-foreground/90">{summary.quickSummary}</p>
        {summary.tomorrow.length > 0 && (
          <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.25)' }}>
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-cyan-300"><CalendarClock className="h-3.5 w-3.5" /> Tomorrow</p>
            <ul className="mt-1 space-y-0.5 text-sm text-foreground/90">
              {summary.tomorrow.slice(0, 3).map((t, i) => <li key={i}>• {t}</li>)}
            </ul>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            Close
          </button>
          <button type="button" onClick={onOpenFull} className="flex-[2] rounded-xl py-2.5 text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.9), rgba(139,92,246,0.9))' }}>
            See full summary
          </button>
        </div>
      </div>
    </div>
  )
}

/** Right-side panel for the new-note page, which has no sidebar. */
export function ReflectionSummaryDrawer({ open, onOpen, onClose, children, hasSummary }: { open: boolean; onOpen: () => void; onClose: () => void; children: React.ReactNode; hasSummary: boolean }) {
  if (!open) {
    if (!hasSummary) return null
    return (
      <button
        type="button"
        onClick={onOpen}
        className="fixed bottom-[8.5rem] right-4 z-[64] flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-cyan-100 shadow-2xl"
        style={{ background: 'rgba(8,47,73,0.95)', border: '1px solid rgba(34,211,238,0.45)' }}
      >
        <ClipboardList className="h-4 w-4" /> Summary
      </button>
    )
  }
  return (
    <aside
      aria-label="Reflection summary"
      className="fixed z-[64] flex flex-col inset-x-0 bottom-0 h-[80vh] rounded-t-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:top-20 sm:h-auto sm:w-[420px] sm:rounded-2xl shadow-2xl"
      style={{ background: 'rgba(10,18,34,0.98)', border: '1px solid rgba(255,255,255,0.12)' }}
    >
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <ClipboardList className="h-4 w-4 text-cyan-300" />
        <span className="text-sm font-bold text-foreground">Today&apos;s summary</span>
        <button type="button" onClick={onClose} aria-label="Close summary" className="ml-auto p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </aside>
  )
}
