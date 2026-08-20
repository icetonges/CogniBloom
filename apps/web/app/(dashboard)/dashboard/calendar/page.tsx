'use client'

/**
 * Year Calendar — the whole 2026-27 school year at a glance.
 *
 * Reads the resolved calendar (manual override → FCPS → Blue/Gray rotation),
 * lets a closure be added or lifted for any date, and offers the one-click
 * ingest that loads the published FCPS calendar into the database.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CalendarRange, Loader2, Download, Snowflake, Trash2, X, Check,
  AlertTriangle, Sparkles, MapPin, GraduationCap,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  FIRST_DAY, LAST_DAY, QUARTERS, monthDays, dayTypeOf, fromKey, toKey,
  type DateKey,
} from '@/lib/school'

interface ResolvedDay {
  date: DateKey
  type: 'blue' | 'gray' | 'holiday' | 'weekend' | 'summer'
  isSchoolDay: boolean
  category: string
  closureReason: string | null
  closureSource: 'manual' | 'fcps' | 'rotation' | null
  code: string | null
  observance: string | null
  observanceEveningOnly: boolean
  earlyRelease: boolean
  note: string | null
}

const MONTHS: { y: number; m: number }[] = [
  { y: 2026, m: 8 }, { y: 2026, m: 9 }, { y: 2026, m: 10 }, { y: 2026, m: 11 }, { y: 2026, m: 12 },
  { y: 2027, m: 1 }, { y: 2027, m: 2 }, { y: 2027, m: 3 }, { y: 2027, m: 4 }, { y: 2027, m: 5 }, { y: 2027, m: 6 },
]
const MONTH_NAME = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const CATEGORY_LABEL: Record<string, string> = {
  student_holiday: 'Student Holiday',
  teacher_workday: 'Teacher Workday',
  staff_development: 'Staff Development Day',
  school_planning: 'School Planning Day',
  new_teacher_training: 'New Teacher Training',
  observance: 'Observance',
  instructional: 'Class day',
  weekend: 'Weekend',
  out_of_term: 'Out of term',
}

export default function YearCalendarPage() {
  const [days, setDays] = useState<Record<DateKey, ResolvedDay>>({})
  const [loading, setLoading] = useState(true)
  const [ingesting, setIngesting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [picked, setPicked] = useState<DateKey | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/school/calendar?from=${FIRST_DAY}&to=${LAST_DAY}`)
      const json = await res.json()
      if (json.success) {
        const m: Record<DateKey, ResolvedDay> = {}
        for (const d of json.days as ResolvedDay[]) m[d.date] = d
        setDays(m)
      }
    } catch { /* the grid still renders from the local rotation */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const ingest = async () => {
    setIngesting(true); setMsg(null)
    try {
      const res = await fetch('/api/school/calendar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ingest' }),
      })
      const j = await res.json()
      setMsg(j.success
        ? `Ingested ${j.total} dates — ${j.created} added, ${j.updated} refreshed, ${j.skippedManual} manual rows left alone.`
        : (j.error ?? 'Ingest failed.'))
      await load()
    } catch {
      setMsg('Ingest failed — is the SchoolCalendarDay migration applied?')
    } finally { setIngesting(false) }
  }

  const setClosure = async (date: DateKey, label: string) => {
    await fetch('/api/school/calendar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, noSchool: true, label, category: 'student_holiday' }),
    })
    await load()
  }
  const setDelay = async (date: DateKey) => {
    await fetch('/api/school/calendar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, noSchool: false, scheduleKind: 'two-hour-delay', label: '2-hour delay' }),
    })
    await load()
  }
  const clearOverride = async (date: DateKey) => {
    await fetch(`/api/school/calendar?date=${date}`, { method: 'DELETE' })
    await load()
  }

  const stats = useMemo(() => {
    let school = 0, closed = 0, manual = 0, obs = 0
    for (const { key } of allDays()) {
      const d = days[key]
      const type = d?.type ?? dayTypeOf(key)
      if (type === 'blue' || type === 'gray') school++
      else if (type === 'holiday') closed++
      if (d?.closureSource === 'manual') manual++
      if (d?.observance) obs++
    }
    return { school, closed, manual, obs }
  }, [days])

  const sel = picked ? days[picked] ?? null : null

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1500px] mx-auto">
      {/* ── header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-violet-400" /> Year Calendar
          </h1>
          <p className="text-xs text-muted-foreground">
            FCPS 2026-2027 · {stats.school} class days · {stats.closed} days off
            {stats.manual > 0 && ` · ${stats.manual} manual`}
          </p>
        </div>
        <Link href="/dashboard/planner" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" /> Planner
        </Link>
        <Link href="/dashboard/school" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" /> Navigate
        </Link>
        <Link href="/dashboard/prep" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
          <GraduationCap className="w-3.5 h-3.5" /> Prep
        </Link>
        <Button size="sm" variant="outline" className="ml-auto" onClick={ingest} disabled={ingesting}>
          {ingesting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
          Load FCPS calendar
        </Button>
      </div>

      {msg && (
        <Card className="p-3 text-xs flex items-start gap-2 border-primary/30 bg-primary/[0.05]">
          <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </Card>
      )}

      {/* ── quarters ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {QUARTERS.map((q) => (
          <Card key={q.n} className="p-2.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Quarter {q.n}</div>
            <div className="text-sm font-bold tabular-nums">{q.days} days</div>
            <div className="text-[10px] text-muted-foreground">ends {q.end}</div>
          </Card>
        ))}
      </div>

      {/* ── legend ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <Chip className="bg-sky-500/25" label="Blue day — P1 3 4 5 7" />
        <Chip className="bg-slate-400/25" label="Gray day — P1 2 4 6 8" />
        <Chip className="bg-amber-500/25 ring-1 ring-inset ring-amber-500/40" label="No school" />
        <Chip className="bg-fuchsia-500/25" label="Observance (school open)" />
        <span className="inline-flex items-center gap-1"><b className="text-amber-500">ER</b> early release</span>
        <span className="inline-flex items-center gap-1"><Snowflake className="w-3 h-3 text-cyan-400" /> manual closure</span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading the year…
        </div>
      )}

      {/* ── the year ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MONTHS.map(({ y, m }) => (
          <MonthCard key={`${y}-${m}`} year={y} month={m} days={days} onPick={setPicked} picked={picked} />
        ))}
      </div>

      {/* ── day detail ── */}
      {picked && (
        <Card className="p-4 sticky bottom-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm">{longDate(picked)}</span>
                <Badge day={sel} dateKey={picked} />
                {sel?.closureSource === 'manual' && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 inline-flex items-center gap-1">
                    <Snowflake className="w-3 h-3" /> manual
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {sel?.closureReason ?? CATEGORY_LABEL[sel?.category ?? ''] ?? describeLocal(picked)}
                {sel?.observance && ` · ${sel.observance}${sel.observanceEveningOnly ? ' (evening only)' : ''}`}
                {sel?.note && ` · ${sel.note}`}
              </div>
              {sel && !sel.isSchoolDay && sel.closureSource === 'fcps' && (
                <p className="text-[11px] text-amber-500 mt-1 inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Classes are cleared from the planner on this day.
                </p>
              )}
            </div>
            <button onClick={() => setPicked(null)} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/60">
            <Button size="sm" variant="outline" onClick={() => setClosure(picked, 'Snow day')}>
              <Snowflake className="w-3.5 h-3.5 mr-1.5" /> Snow day
            </Button>
            <Button size="sm" variant="outline" onClick={() => setClosure(picked, 'School closed')}>
              Close this day
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDelay(picked)}>
              2-hour delay
            </Button>
            {sel?.closureSource === 'manual' && (
              <Button size="sm" variant="outline" onClick={() => clearOverride(picked)}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remove override
              </Button>
            )}
            <Link
              href="/dashboard/planner"
              className="text-xs text-primary hover:underline self-center ml-auto"
            >
              Open this day in the planner →
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}

// ── month grid ──────────────────────────────────────────────────────────────

function MonthCard({
  year, month, days, onPick, picked,
}: {
  year: number
  month: number
  days: Record<DateKey, ResolvedDay>
  onPick: (d: DateKey) => void
  picked: DateKey | null
}) {
  const grid = monthDays(year, month)
  const firstDow = fromKey(grid[0]!.key).getDay()
  const todayKey = toKey(new Date())

  return (
    <Card className="p-3">
      <h2 className="text-xs font-bold mb-2">{MONTH_NAME[month]} {year}</h2>
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-semibold text-muted-foreground/70">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`p${i}`} />)}
        {grid.map(({ key }) => {
          const d = days[key]
          const type = d?.type ?? dayTypeOf(key)
          const closed = type === 'holiday'
          const weekend = type === 'weekend'
          const isToday = key === todayKey
          const num = Number(key.slice(-2))
          return (
            <button
              key={key}
              onClick={() => onPick(key)}
              title={d?.closureReason ?? d?.observance ?? undefined}
              className={cn(
                'relative aspect-square rounded text-[10px] font-medium flex items-center justify-center transition-colors',
                weekend && 'text-muted-foreground/30',
                type === 'blue' && 'bg-sky-500/15 text-sky-300 hover:bg-sky-500/30',
                type === 'gray' && 'bg-slate-400/15 text-slate-300 hover:bg-slate-400/30',
                closed && 'bg-amber-500/15 text-amber-500/80 ring-1 ring-inset ring-amber-500/30 hover:bg-amber-500/30',
                !weekend && !closed && type !== 'blue' && type !== 'gray' && 'text-muted-foreground/40',
                isToday && 'ring-2 ring-primary font-black',
                picked === key && 'ring-2 ring-foreground'
              )}
            >
              {num}
              {d?.earlyRelease && !closed && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
              {d?.observance && !closed && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-fuchsia-400" />
              )}
              {d?.closureSource === 'manual' && (
                <span className="absolute -top-0.5 -left-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400" />
              )}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

// ── bits ────────────────────────────────────────────────────────────────────

function Chip({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('w-2.5 h-2.5 rounded-sm', className)} />
      {label}
    </span>
  )
}

function Badge({ day, dateKey }: { day: ResolvedDay | null; dateKey: DateKey }) {
  const type = day?.type ?? dayTypeOf(dateKey)
  const map: Record<string, [string, string]> = {
    blue: ['Blue Day', 'bg-sky-500/15 text-sky-400'],
    gray: ['Gray Day', 'bg-slate-400/15 text-slate-400'],
    holiday: ['No school', 'bg-amber-500/15 text-amber-500'],
    weekend: ['Weekend', 'bg-muted text-muted-foreground'],
    summer: ['Out of term', 'bg-muted text-muted-foreground'],
  }
  const [label, cls] = map[type] ?? ['—', 'bg-muted text-muted-foreground']
  return <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', cls)}>{label}</span>
}

function longDate(key: DateKey): string {
  return fromKey(key).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function describeLocal(key: DateKey): string {
  const t = dayTypeOf(key)
  return t === 'blue' ? 'Blue day — periods 1, 3, 4, 5, 7'
    : t === 'gray' ? 'Gray day — periods 1, 2, 4, 6, 8'
    : t === 'weekend' ? 'Weekend'
    : t === 'summer' ? 'Outside the school year'
    : 'No school'
}

/** Every date in the school year, for the summary counts. */
function allDays(): { key: DateKey }[] {
  const out: { key: DateKey }[] = []
  for (const { y, m } of MONTHS) out.push(...monthDays(y, m).map((d) => ({ key: d.key })))
  return out.filter((d) => d.key >= FIRST_DAY && d.key <= LAST_DAY)
}
