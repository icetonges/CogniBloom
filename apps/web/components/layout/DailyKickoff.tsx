'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck, Dices, X, Sparkles, Laugh } from 'lucide-react'
import { pickOfTheDay, type Kickoff, type PlannerToday } from '@/lib/kickoff'

interface KickoffData extends Kickoff {
  dateKey: string
  planner: PlannerToday
  audience: 'student' | 'parent'
}

const DISMISS_KEY = 'cb:kickoff:dismissed'

function readDismissed(): string | null {
  try { return window.localStorage.getItem(DISMISS_KEY) } catch { return null }
}
function writeDismissed(dateKey: string) {
  try { window.localStorage.setItem(DISMISS_KEY, dateKey) } catch { /* private mode: just hide for now */ }
}

// Writing pages stay distraction-free.
const HIDDEN_ON = ['/dashboard/notes/']

/**
 * The daily kickoff: a friendly greeting, a planner nudge based on today's
 * planner, and a joke or encouraging line that changes every day.
 * - On the planner (his front page): the full card.
 * - Elsewhere: a slim reminder, only while the planner still needs him.
 * - Dismissed for the rest of the day on this device with ✕.
 */
export function DailyKickoff() {
  const pathname = usePathname()
  const [data, setData] = useState<KickoffData | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [revealed, setRevealed] = useState(false)

  const onPlanner = pathname.startsWith('/dashboard/planner')
  const hidden = HIDDEN_ON.some((p) => pathname.startsWith(p))

  const load = useCallback(() => {
    fetch('/api/planner/kickoff')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setData(j.data) })
      .catch(() => {})
  }, [])

  useEffect(() => { setDismissed(readDismissed()) }, [])
  // Refresh on navigation (e.g. coming back from the planner) and when the tab returns.
  useEffect(() => { if (!hidden) load() }, [pathname, hidden, load])
  // While the reminder is up on the planner, re-check so a tick turns it green within seconds.
  const waiting = onPlanner && !!data?.needsUpdate && dismissed !== data?.dateKey
  useEffect(() => {
    if (!waiting) return
    const t = setInterval(load, 20_000)
    return () => clearInterval(t)
  }, [waiting, load])
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVis)
    // Any page can dispatch 'cb:planner-changed' to refresh the card immediately.
    window.addEventListener('cb:planner-changed', load)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('cb:planner-changed', load)
    }
  }, [load])

  if (hidden || !data || dismissed === data.dateKey) return null
  if (!onPlanner && !data.needsUpdate) return null

  const dismiss = () => { writeDismissed(data.dateKey); setDismissed(data.dateKey) }
  const pick = offset === 0 ? data.pick : pickOfTheDay(data.dateKey, offset)
  const another = () => { setOffset((o) => o + 1); setRevealed(false) }
  const preview = data.audience === 'parent'

  // Slim reminder on other pages.
  if (!onPlanner) {
    return (
      <div
        className="mb-4 flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm"
        style={{ background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.25)' }}
      >
        <CalendarCheck className="h-4 w-4 shrink-0 text-cyan-300" />
        <span className="flex-1 min-w-0 text-foreground">
          {preview && <span className="mr-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Daniel sees:</span>}
          Planner not updated yet today. Two minutes now saves a messy evening.
        </span>
        <Link href="/dashboard/planner" className="shrink-0 rounded-lg px-3 py-1 text-xs font-bold text-cyan-200" style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.35)' }}>
          Update planner
        </Link>
        <button type="button" onClick={dismiss} aria-label="Hide for today" className="shrink-0 p-1 text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  const done = !data.needsUpdate
  return (
    <section
      aria-label="Daily kickoff"
      className="relative mb-5 overflow-hidden rounded-2xl p-4 sm:p-5"
      style={{
        background: done
          ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(34,211,238,0.06))'
          : 'linear-gradient(135deg, rgba(99,102,241,0.16), rgba(34,211,238,0.08))',
        border: `1px solid ${done ? 'rgba(52,211,153,0.3)' : 'rgba(129,140,248,0.3)'}`,
      }}
    >
      <button type="button" onClick={dismiss} aria-label="Hide for today" className="absolute right-3 top-3 p-1 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
      {preview && (
        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Preview: this is what Daniel sees today</p>
      )}
      <h2 className="pr-8 text-lg sm:text-xl font-bold text-foreground">{data.greeting}</h2>
      <p className="mt-1 flex items-start gap-2 text-sm text-foreground/90">
        <CalendarCheck className={`mt-0.5 h-4 w-4 shrink-0 ${done ? 'text-emerald-300' : 'text-cyan-300'}`} />
        <span>{data.nudge}</span>
      </p>

      <div className="mt-3 rounded-xl px-3.5 py-3" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {pick.kind === 'joke' ? <Laugh className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
          {pick.kind === 'joke' ? 'Joke of the day' : 'Today\'s spark'}
          <button type="button" onClick={another} className="ml-auto flex items-center gap-1 normal-case tracking-normal text-[11px] hover:text-foreground" title="Another one">
            <Dices className="h-3 w-3" /> Another one
          </button>
        </div>
        {pick.kind === 'joke' ? (
          <div className="mt-1.5 text-sm">
            <p className="text-foreground">{pick.setup}</p>
            {revealed ? (
              <p className="mt-1 font-semibold text-amber-200">{pick.punchline}</p>
            ) : (
              <button type="button" onClick={() => setRevealed(true)} className="mt-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-amber-200" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
                Tap for the punchline 😄
              </button>
            )}
          </div>
        ) : (
          <p className="mt-1.5 text-sm font-medium text-foreground">{pick.text}</p>
        )}
      </div>
    </section>
  )
}
