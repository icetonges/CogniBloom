'use client'

/**
 * Soccer — BRYC Academy U13 ECRL, Coach Todd West.
 *
 * Three things in one place: what the coach actually said he wants, a tracker
 * for the two numbers he named (1000 touches, 100 juggles), and the handful of
 * reminders worth reading in the car on the way to the field.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Trophy, Phone, MapPin, Clock, Target, Flame, Check, Loader2,
  ChevronRight, AlertTriangle, Quote, ListChecks, MessageSquareQuote,
  CalendarDays, Users, Timer,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  COACH, COACHING_STYLE, PLAYER_RULES, PARENT_RULES, PRACTICES, TESTS,
  WHAT_COACH_NOTICES, BEFORE_PRACTICE, THE_QUESTION, KIT_CHECK,
  TOUCH_GOAL, mantraFor, minus,
} from '@/lib/soccer'

interface Log {
  date: string
  touches: number
  juggling: number
  ladderSeconds: number
  practice: boolean
}
interface Totals { touches: number; practices: number; bestJuggling: number; bestLadder: number; days: number }

const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmt12(t: string): string {
  const [h = '0', m = '00'] = t.split(':')
  const hh = Number(h)
  return `${((hh + 11) % 12) + 1}:${m} ${hh < 12 ? 'AM' : 'PM'}`
}

export default function SoccerPage() {
  const [date] = useState(todayKey)
  const [log, setLog] = useState<Log | null>(null)
  const [logs, setLogs] = useState<Log[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [streak, setStreak] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/soccer/log?date=${date}&days=28`)
      const j = await r.json()
      if (!j.success) return
      setLogs(j.logs ?? [])
      setLog(j.today ?? { date, touches: 0, juggling: 0, ladderSeconds: 0, practice: false })
      setTotals(j.totals ?? null)
      setStreak(j.streak ?? 0)
    } catch { /* the page still reads fine without the numbers */ } finally { setLoaded(true) }
  }, [date])

  useEffect(() => { void load() }, [load])

  const save = useCallback(async (patch: Partial<Log>) => {
    setSaving(true)
    setLog((l) => (l ? { ...l, ...patch } : l))
    try {
      await fetch('/api/soccer/log', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, ...patch }),
      })
      await load()
    } catch { /* keep the optimistic value on screen */ } finally { setSaving(false) }
  }, [date, load])

  const dow = new Date(`${date}T12:00:00`).getDay()
  const nextPractice = useMemo(() => {
    for (let i = 0; i < 8; i += 1) {
      const wd = (dow + i) % 7
      const p = PRACTICES.find((x) => x.weekday === wd)
      if (p) return { p, inDays: i }
    }
    return null
  }, [dow])

  const touches = log?.touches ?? 0
  const pct = Math.min(100, Math.round((touches / TOUCH_GOAL) * 100))

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1500px] mx-auto">
      {/* ── header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <Trophy className="w-5 h-5 text-emerald-400" /> Soccer
          </h1>
          <p className="text-xs text-muted-foreground">
            BRYC Academy · U13 ECRL · Coach {COACH.name}
          </p>
        </div>
        {streak > 0 && (
          <span className="text-[11px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 font-bold inline-flex items-center gap-1">
            <Flame className="w-3 h-3" /> {streak}-day touch streak
          </span>
        )}
        <Link href="/dashboard/habits" className="ml-auto text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
          <ListChecks className="w-3.5 h-3.5" /> Habit tracker
        </Link>
        <Link href="/dashboard/planner" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
          <CalendarDays className="w-3.5 h-3.5" /> Planner
        </Link>
      </div>

      {/* ── today's mantra ── */}
      <Card className="p-4 border-emerald-500/25 bg-emerald-500/[0.05] flex items-start gap-3">
        <Quote className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-sm font-semibold leading-relaxed">{mantraFor(date)}</p>
      </Card>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        {/* ══ left: the work ══ */}
        <div className="space-y-4">
          {/* touches */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Today&apos;s touches
              </h2>
              {saving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              <span className="ml-auto text-[11px] text-muted-foreground">
                Coach said it more than anything else: <strong className="text-foreground">1000 a day</strong>
              </span>
            </div>

            <div className="flex items-center gap-4">
              <Ring pct={pct} />
              <div className="flex-1 min-w-0">
                <div className="text-3xl font-black tabular-nums leading-none">
                  {touches}
                  <span className="text-base font-bold text-muted-foreground"> / {TOUCH_GOAL}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[50, 100, 250].map((n) => (
                    <Button key={n} size="sm" variant="outline" disabled={!loaded}
                      onClick={() => void save({ touches: touches + n })}>
                      +{n}
                    </Button>
                  ))}
                  <Button size="sm" disabled={!loaded || touches >= TOUCH_GOAL}
                    onClick={() => void save({ touches: TOUCH_GOAL })}>
                    Done — 1000
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!loaded || touches === 0}
                    onClick={() => void save({ touches: 0 })}>
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            {/* 28-day strip */}
            <div className="mt-4 pt-3 border-t border-border/60">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
                <span>Last 28 days</span>
                {totals && (
                  <span className="tabular-nums">
                    {totals.touches.toLocaleString()} touches · {totals.practices} sessions
                  </span>
                )}
              </div>
              <TouchStrip logs={logs} today={date} />
            </div>
          </Card>

          {/* tests */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                {TESTS[0].name}
              </h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{TESTS[0].how}</p>
              <NumberField
                value={log?.juggling ?? 0}
                suffix={`/ ${TESTS[0].target}`}
                best={totals?.bestJuggling ?? 0}
                betterIs="higher"
                onSave={(v) => void save({ juggling: v })}
                disabled={!loaded}
              />
            </Card>

            <Card className="p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                {TESTS[1].name}
              </h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{TESTS[1].how}</p>
              <NumberField
                value={log?.ladderSeconds ?? 0}
                suffix="seconds"
                best={totals?.bestLadder ?? 0}
                betterIs="lower"
                onSave={(v) => void save({ ladderSeconds: v })}
                disabled={!loaded}
              />
            </Card>
          </div>

          {/* what the coach notices */}
          <Card className="p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              What a coach like this is actually watching
            </h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {WHAT_COACH_NOTICES.map((tier) => (
                <div key={tier.tier} className="rounded-xl border border-border/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: tier.accent }}>
                    {tier.tier}
                  </p>
                  <ul className="space-y-1.5">
                    {tier.items.map((it) => (
                      <li key={it} className="text-[11px] leading-snug text-muted-foreground flex gap-1.5">
                        <span className="mt-1 w-1 h-1 rounded-full shrink-0" style={{ background: tier.accent }} />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-3 leading-relaxed">
              The third column is the one entirely within your control from the first session. It is
              also the one a coach with thirty years of evaluating players notices fastest.
            </p>
          </Card>

          {/* coach's own words */}
          <Card className="p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Coach West — style and objectives, in his words
            </h2>
            <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {COACHING_STYLE.map((s) => (
                <li key={s} className="text-xs leading-snug flex gap-2">
                  <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" />
                  <span className="text-muted-foreground">{s}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* expectations */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Expected of you
              </h2>
              <ul className="space-y-2.5">
                {PLAYER_RULES.map((r) => (
                  <li key={r.rule}>
                    <p className="text-xs font-bold">{r.rule}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">{r.why}</p>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-4">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Expected of parents
              </h2>
              <ul className="space-y-1.5">
                {PARENT_RULES.map((r) => (
                  <li key={r} className="text-[11px] leading-snug text-muted-foreground flex gap-2">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
              <p className="mt-3 pt-3 border-t border-border/60 text-[11px] font-bold text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> Referees are off limits — players and parents both
              </p>
            </Card>
          </div>
        </div>

        {/* ══ right: the day ══ */}
        <div className="space-y-4">
          {/* next session */}
          <Card className="p-4 border-emerald-500/25">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Next session
            </h2>
            {nextPractice ? (
              <>
                <p className="text-sm font-bold">
                  {nextPractice.inDays === 0 ? 'Today' : nextPractice.inDays === 1 ? 'Tomorrow' : DAY_NAME[nextPractice.p.weekday]}
                  {' · '}{fmt12(nextPractice.p.start)}
                </p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" /> {nextPractice.p.venue}
                </p>
                <div className="mt-3 space-y-1 text-[11px]">
                  <Line label="Leave home" value={fmt12(minus(nextPractice.p.arriveBy, nextPractice.p.travelMinutes))} />
                  <Line label="On the field" value={fmt12(nextPractice.p.arriveBy)} strong />
                  <Line label="Practice starts" value={fmt12(nextPractice.p.start)} />
                </div>
                {nextPractice.inDays === 0 && (
                  <button
                    onClick={() => void save({ practice: !(log?.practice ?? false) })}
                    className={cn(
                      'mt-3 w-full rounded-lg py-2 text-xs font-bold transition-colors',
                      log?.practice
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {log?.practice ? <><Check className="w-3 h-3 inline mr-1" /> Trained today</> : 'Mark practice done'}
                  </button>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No practice on the schedule.</p>
            )}
          </Card>

          {/* week */}
          <Card className="p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              This week
            </h2>
            <ul className="space-y-2">
              {PRACTICES.map((p) => (
                <li key={p.weekday} className={cn(
                  'rounded-lg px-2.5 py-2 border',
                  p.weekday === dow ? 'border-emerald-500/40 bg-emerald-500/[0.07]' : 'border-border/60'
                )}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{DAY_NAME[p.weekday]}</span>
                    <span className="ml-auto text-xs tabular-nums font-semibold">{fmt12(p.start)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{p.venue}</p>
                  <p className="text-[10px] text-muted-foreground/70">
                    On the field {fmt12(p.arriveBy)} · leave home ~{fmt12(minus(p.arriveBy, p.travelMinutes))}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          {/* five things */}
          <Card className="p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Before you walk on — five things
            </h2>
            <ol className="space-y-2">
              {BEFORE_PRACTICE.map((b) => (
                <li key={b.n} className="flex gap-2">
                  <span className="w-4 h-4 shrink-0 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-black flex items-center justify-center mt-0.5">
                    {b.n}
                  </span>
                  <span>
                    <span className="text-xs font-bold">{b.do}</span>
                    <span className="block text-[11px] text-muted-foreground leading-snug">{b.note}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          {/* kit */}
          <Card className="p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Bag check
            </h2>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
              {KIT_CHECK.map((k) => (
                <li key={k} className="text-[11px] text-muted-foreground leading-snug flex gap-1.5">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0" />{k}
                </li>
              ))}
            </ul>
          </Card>

          {/* coach card */}
          <Card className="p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> The coach
            </h2>
            <p className="text-sm font-bold">{COACH.name}</p>
            <p className="text-[11px] text-muted-foreground">{COACH.role}</p>
            <p className="text-[10px] text-muted-foreground/70">{COACH.alsoListedAs}</p>
            <a href={`sms:${COACH.phone.replace(/-/g, '')}`}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
              <Phone className="w-3 h-3" /> {COACH.phone}
            </a>
            <p className="text-[10px] text-muted-foreground/70">{COACH.contact}</p>

            <ul className="mt-3 pt-3 border-t border-border/60 space-y-1">
              {COACH.credentials.map((c) => (
                <li key={c} className="text-[10px] leading-snug text-muted-foreground flex gap-1.5">
                  <span className="mt-1 w-1 h-1 rounded-full bg-emerald-400/60 shrink-0" />{c}
                </li>
              ))}
            </ul>
            <p className="mt-3 pt-3 border-t border-border/60 text-[10px] leading-relaxed text-muted-foreground/80">
              <strong className="text-foreground">What we don&apos;t know:</strong> {COACH.unknown}
            </p>
            <p className="mt-2 text-[10px] text-muted-foreground/60">{COACH.bioNote}</p>
          </Card>

          {/* the question */}
          <Card className="p-4 border-sky-500/25 bg-sky-500/[0.05]">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-sky-400 mb-2 flex items-center gap-1.5">
              <MessageSquareQuote className="w-3.5 h-3.5" /> After 3–5 sessions, ask this
            </h2>
            <p className="text-xs leading-relaxed italic">&ldquo;{THE_QUESTION.ask}&rdquo;</p>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{THE_QUESTION.why}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-2">
              Not: {THE_QUESTION.dontAsk.map((q) => `“${q}”`).join(' · ')}
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── small pieces ────────────────────────────────────────────────────────────

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('tabular-nums', strong ? 'font-bold text-emerald-400' : 'font-semibold')}>{value}</span>
    </div>
  )
}

function Ring({ pct }: { pct: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <svg width={88} height={88} viewBox="0 0 88 88" className="shrink-0">
      <circle cx={44} cy={44} r={r} fill="none" strokeWidth={9} className="stroke-muted/40" />
      <circle
        cx={44} cy={44} r={r} fill="none" strokeWidth={9} strokeLinecap="round"
        className={pct >= 100 ? 'stroke-emerald-400' : 'stroke-primary'}
        strokeDasharray={`${(c * pct) / 100} ${c}`}
        transform="rotate(-90 44 44)"
        style={{ transition: 'stroke-dasharray 400ms ease' }}
      />
      <text x={44} y={49} textAnchor="middle" className="fill-foreground font-black" fontSize={18}>
        {pct}%
      </text>
    </svg>
  )
}

function TouchStrip({ logs, today }: { logs: Log[]; today: string }) {
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const cells: { key: string; log?: Log }[] = []
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 27)
  for (let i = 0; i < 28; i += 1) {
    const key = d.toISOString().slice(0, 10)
    cells.push({ key, log: byDate.get(key) })
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return (
    <div className="flex gap-1">
      {cells.map(({ key, log }) => {
        const t = log?.touches ?? 0
        const level = t >= 1000 ? 3 : t >= 500 ? 2 : t > 0 ? 1 : 0
        return (
          <div
            key={key}
            title={`${key} — ${t} touches${log?.practice ? ' · practice' : ''}`}
            className={cn(
              'flex-1 h-7 rounded-[3px] border',
              level === 3 && 'bg-emerald-500/70 border-emerald-400/60',
              level === 2 && 'bg-emerald-500/35 border-emerald-500/30',
              level === 1 && 'bg-emerald-500/15 border-emerald-500/20',
              level === 0 && 'bg-muted/30 border-border/40',
              key === today && 'ring-1 ring-primary'
            )}
          />
        )
      })}
    </div>
  )
}

function NumberField({
  value, suffix, best, betterIs, onSave, disabled,
}: {
  value: number
  suffix: string
  best: number
  betterIs: 'higher' | 'lower'
  onSave: (v: number) => void
  disabled?: boolean
}) {
  const [draft, setDraft] = useState(String(value || ''))
  useEffect(() => { setDraft(String(value || '')) }, [value])
  const isBest = best > 0 && value > 0 && (betterIs === 'higher' ? value >= best : value <= best)
  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 5))}
          inputMode="numeric"
          className="w-24 bg-muted/40 rounded-lg px-2.5 py-1.5 text-lg font-black tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="text-xs text-muted-foreground">{suffix}</span>
        <Button size="sm" variant="outline" className="ml-auto" disabled={disabled}
          onClick={() => onSave(Number(draft || '0'))}>
          Save
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
        <Timer className="w-2.5 h-2.5" />
        {best > 0 ? <>Best in 28 days: <strong className="text-foreground">{best}</strong></> : 'No record yet'}
        {isBest && <span className="text-emerald-400 font-bold ml-1">— personal best</span>}
      </p>
    </div>
  )
}
