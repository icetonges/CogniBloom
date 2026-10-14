'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CalendarCheck, Dices, X, Sparkles, Laugh } from 'lucide-react'
import { pickOfTheDay, PICKS_PER_DAY, type Kickoff, type PlannerToday } from '@/lib/kickoff'

interface KickoffData extends Kickoff {
  dateKey: string
  planner: PlannerToday
  audience: 'student' | 'parent'
}

const SEEN_KEY = 'cb:kickoff:seen'

function readSeen(): string | null {
  try { return window.localStorage.getItem(SEEN_KEY) } catch { return null }
}
function writeSeen(dateKey: string) {
  try { window.localStorage.setItem(SEEN_KEY, dateKey) } catch { /* private mode: it just shows again next load */ }
}

// Writing pages stay distraction-free.
const HIDDEN_ON = ['/dashboard/notes/']

/**
 * The daily kickoff pop-up: a friendly greeting, a planner nudge based on
 * today's planner, and up to three picks (joke, spark, joke). Shows once a
 * day per device, the first time he opens a dashboard page; any way of
 * closing it counts as seen.
 */
export function DailyKickoff() {
  const pathname = usePathname()
  const router = useRouter()
  const [data, setData] = useState<KickoffData | null>(null)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const primaryRef = useRef<HTMLButtonElement>(null)

  const hidden = HIDDEN_ON.some((p) => pathname.startsWith(p))
  const onPlanner = pathname.startsWith('/dashboard/planner')

  // Fetch once per page view until today's pop-up has been seen.
  useEffect(() => {
    if (hidden || data) return
    let cancelled = false
    fetch('/api/planner/kickoff')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const d = j?.data as KickoffData | undefined
        if (cancelled || !d) return
        setData(d)
        if (readSeen() !== d.dateKey) setOpen(true)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [hidden, data])

  const close = useCallback(() => {
    if (data) writeSeen(data.dateKey)
    setOpen(false)
  }, [data])

  useEffect(() => {
    if (!open) return
    primaryRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open || !data || hidden) return null

  const pick = step === 0 ? data.pick : pickOfTheDay(data.dateKey, step)
  const canAnother = step < PICKS_PER_DAY - 1
  const next = () => { setStep((s) => Math.min(s + 1, PICKS_PER_DAY - 1)); setRevealed(false) }
  const done = !data.needsUpdate
  const goPlanner = data.needsUpdate && !onPlanner
  const preview = data.audience === 'parent'

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
      onClick={close}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="kickoff-title"
        className="relative w-full max-w-md overflow-hidden rounded-2xl p-5 shadow-2xl"
        style={{
          background: done
            ? 'linear-gradient(135deg, rgba(6,40,30,0.98), rgba(10,18,34,0.98))'
            : 'linear-gradient(135deg, rgba(24,22,64,0.98), rgba(10,18,34,0.98))',
          border: `1px solid ${done ? 'rgba(52,211,153,0.35)' : 'rgba(129,140,248,0.35)'}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        {preview && (
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Preview: this is what Daniel sees today</p>
        )}
        <h2 id="kickoff-title" className="pr-8 text-xl font-bold text-foreground">{data.greeting}</h2>
        <p className="mt-1.5 flex items-start gap-2 text-sm text-foreground/90">
          <CalendarCheck className={`mt-0.5 h-4 w-4 shrink-0 ${done ? 'text-emerald-300' : 'text-cyan-300'}`} />
          <span>{data.nudge}</span>
        </p>

        <div className="mt-4 rounded-xl px-3.5 py-3" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {pick.kind === 'joke' ? <Laugh className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
            {pick.kind === 'joke' ? 'Joke of the day' : "Today's spark"}
            <span className="ml-auto normal-case tracking-normal">{step + 1} / {PICKS_PER_DAY}</span>
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
          {canAnother && (
            <button type="button" onClick={next} className="mt-2.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
              <Dices className="h-3 w-3" /> {step === 0 ? 'Something inspiring' : 'One more joke'}
            </button>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          {goPlanner && (
            <button type="button" onClick={close} className="flex-1 rounded-xl py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Later
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            onClick={() => { close(); if (goPlanner) router.push('/dashboard/planner') }}
            className="flex-[2] rounded-xl py-2.5 text-xs font-bold text-white"
            style={{ background: done ? 'linear-gradient(135deg, rgba(16,185,129,0.9), rgba(34,211,238,0.8))' : 'linear-gradient(135deg, rgba(99,102,241,0.9), rgba(139,92,246,0.9))' }}
          >
            {goPlanner ? 'Open my planner' : onPlanner && data.needsUpdate ? "Let's update it" : "Let's go"}
          </button>
        </div>
      </section>
    </div>
  )
}
