'use client'

/**
 * Habit tracker.
 *
 * It does not store anything of its own. The habits ARE the routine rows the
 * planner already seeds each morning, so ticking a box here ticks it in the
 * planner and vice versa — one source of truth, and a year of history that
 * lives in the database rather than in a browser.
 *
 * A day that has never been opened in the planner has no rows yet; the grid
 * shows those as blank rather than as misses, and the seed button fills them.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ListChecks, Loader2, Flame, ChevronLeft, ChevronRight, CalendarDays, Trophy,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { HABIT_TITLES } from '@/lib/daily-routine'

interface Entry {
  id: string
  date: string
  title: string
  status: string
  tags: string[]
  startTime: string | null
}

const HABIT_META: Record<string, { short: string; emoji: string; accent: string }> = {
  'Workout — set 1':     { short: 'Stretch',    emoji: '🤸', accent: '#f472b6' },
  'Duolingo':            { short: 'Duolingo',   emoji: '🦉', accent: '#4ade80' },
  'Music':               { short: 'Music',      emoji: '🎵', accent: '#c084fc' },
  '1000 touches':        { short: 'Touches',    emoji: '⚽', accent: '#34d399' },
  'Study Session 1':     { short: 'Study 1',    emoji: '📘', accent: '#60a5fa' },
  'Study Session 2':     { short: 'Study 2',    emoji: '📗', accent: '#38bdf8' },
  'Reading':             { short: 'Reading',    emoji: '📖', accent: '#fb923c' },
  '$5 daily investment': { short: 'Invest',     emoji: '💵', accent: '#fbbf24' },
  'Daily Reflection':    { short: 'Reflect',    emoji: '🧭', accent: '#a78bfa' },
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function HabitsPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const today = keyOf(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/planner?scope=month&date=${month}`)
      const j = await r.json()
      if (j.success) {
        setEntries((j.data as { id: string; date: string; title: string; status: string; tags: string[]; startTime: string | null }[])
          .map((e) => ({ ...e, date: String(e.date).slice(0, 10) })))
      }
    } catch { /* offline — show what we have */ } finally { setLoading(false) }
  }, [month])

  useEffect(() => { void load() }, [load])

  const days = useMemo(() => {
    const [y = '2026', m = '01'] = month.split('-')
    const last = new Date(Number(y), Number(m), 0).getDate()
    return Array.from({ length: last }, (_, i) => {
      const d = new Date(Number(y), Number(m) - 1, i + 1)
      return { key: keyOf(d), day: i + 1, dow: d.getDay() }
    })
  }, [month])

  /** title → date → entry */
  const grid = useMemo(() => {
    const m = new Map<string, Map<string, Entry>>()
    for (const t of HABIT_TITLES) m.set(t, new Map())
    for (const e of entries) {
      const row = m.get(e.title)
      if (row) row.set(e.date, e)
    }
    return m
  }, [entries])

  const seededDays = useMemo(
    () => new Set(entries.filter((e) => e.tags.includes('routine')).map((e) => e.date)),
    [entries]
  )

  const toggle = useCallback(async (entry: Entry) => {
    setBusy(entry.id)
    const next = entry.status === 'done' ? 'pending' : 'done'
    setEntries((list) => list.map((e) => (e.id === entry.id ? { ...e, status: next } : e)))
    try {
      await fetch('/api/planner', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, status: next }),
      })
    } catch {
      setEntries((list) => list.map((e) => (e.id === entry.id ? { ...e, status: entry.status } : e)))
    } finally { setBusy(null) }
  }, [])

  const seedToday = useCallback(async () => {
    setBusy('seed')
    try {
      await fetch('/api/planner/seed-day', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today }),
      })
      await load()
    } catch { /* the planner page can do it too */ } finally { setBusy(null) }
  }, [today, load])

  const shiftMonth = (dir: number) => {
    const [y = '2026', m = '01'] = month.split('-')
    const d = new Date(Number(y), Number(m) - 1 + dir, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1500px] mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Previous month">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Next month">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-amber-400" /> Habits
          </h1>
          <p className="text-xs text-muted-foreground">
            {new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            {' · '}the same rows as your planner
          </p>
        </div>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => void seedToday()} disabled={busy === 'seed'}>
          {busy === 'seed' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CalendarDays className="w-3.5 h-3.5 mr-1.5" />}
          Fill today
        </Button>
        <Link href="/dashboard/planner" className="text-xs font-semibold text-primary hover:underline">Planner</Link>
        <Link href="/dashboard/soccer" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
          <Trophy className="w-3.5 h-3.5" /> Soccer
        </Link>
      </div>

      {/* streak row */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {HABIT_TITLES.slice(0, 5).map((t) => {
          const meta = HABIT_META[t]
          const row = grid.get(t)
          const streak = streakFor(row, today)
          const done = countDone(row)
          return (
            <Card key={t} className="p-3">
              <p className="text-xs font-bold flex items-center gap-1.5">
                <span>{meta?.emoji}</span>{meta?.short ?? t}
              </p>
              <p className="text-2xl font-black tabular-nums leading-tight mt-1" style={{ color: meta?.accent }}>
                {done}
              </p>
              <p className="text-[10px] text-muted-foreground">
                done this month
                {streak > 0 && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-400 font-bold">
                    <Flame className="w-2.5 h-2.5" />{streak}
                  </span>
                )}
              </p>
            </Card>
          )
        })}
      </div>

      {/* the grid */}
      <Card className="p-0 overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card text-left px-3 py-2 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">
                Habit
              </th>
              {days.map((d) => (
                <th key={d.key} className={cn(
                  'px-0 py-1 font-medium text-center min-w-[26px]',
                  (d.dow === 0 || d.dow === 6) && 'bg-muted/25',
                  d.key === today && 'bg-primary/10'
                )}>
                  <span className="block text-[9px] text-muted-foreground/60">{DOW[d.dow]}</span>
                  <span className={cn('block tabular-nums', d.key === today ? 'text-primary font-black' : 'text-muted-foreground')}>
                    {d.day}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HABIT_TITLES.map((t) => {
              const meta = HABIT_META[t]
              const row = grid.get(t)
              return (
                <tr key={t} className="border-t border-border/50">
                  <td className="sticky left-0 z-10 bg-card px-3 py-1.5 whitespace-nowrap">
                    <span className="mr-1.5">{meta?.emoji}</span>
                    <span className="font-semibold">{meta?.short ?? t}</span>
                  </td>
                  {days.map((d) => {
                    const entry = row?.get(d.key)
                    const future = d.key > today
                    const unseeded = !seededDays.has(d.key)
                    return (
                      <td key={d.key} className={cn(
                        'p-0 text-center',
                        (d.dow === 0 || d.dow === 6) && 'bg-muted/20',
                        d.key === today && 'bg-primary/[0.07]'
                      )}>
                        {entry ? (
                          <button
                            onClick={() => void toggle(entry)}
                            disabled={busy === entry.id}
                            title={`${t} · ${d.key}`}
                            className="w-full h-7 flex items-center justify-center group"
                          >
                            <span
                              className={cn(
                                'w-4 h-4 rounded-[4px] border transition-all',
                                entry.status === 'done'
                                  ? 'border-transparent'
                                  : 'border-muted-foreground/30 group-hover:border-primary/60'
                              )}
                              style={entry.status === 'done'
                                ? { background: meta?.accent ?? 'var(--primary)' }
                                : undefined}
                            />
                          </button>
                        ) : (
                          <span
                            title={future ? 'Not yet' : unseeded ? 'This day was never opened in the planner' : 'Not part of this day’s routine'}
                            className={cn(
                              'block w-full h-7 flex items-center justify-center text-muted-foreground/25',
                              future && 'opacity-40'
                            )}
                          >
                            ·
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        A dot means there is no row for that habit on that day — either the day was never opened in
        the planner, or the routine for that day does not include it. Monday and Thursday have
        practice at 5:45, so those days carry one study session after dinner instead of two before
        it; Wednesday and Friday carry reading. Nothing here is stored separately from the planner:
        tick a box in either place and it changes in both.
      </p>
    </div>
  )
}

function countDone(row?: Map<string, Entry>): number {
  if (!row) return 0
  let n = 0
  row.forEach((e) => { if (e.status === 'done') n += 1 })
  return n
}

/** Consecutive days ending today (or yesterday, if today is not done yet). */
function streakFor(row: Map<string, Entry> | undefined, today: string): number {
  if (!row) return 0
  const done = new Set<string>()
  row.forEach((e, k) => { if (e.status === 'done') done.add(k) })
  const d = new Date(`${today}T00:00:00`)
  if (!done.has(today)) d.setDate(d.getDate() - 1)
  let n = 0
  for (;;) {
    const k = keyOf(d)
    if (!done.has(k)) break
    n += 1
    d.setDate(d.getDate() - 1)
  }
  return n
}
