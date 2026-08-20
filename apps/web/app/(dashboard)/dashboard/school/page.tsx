'use client'

/**
 * Navigate — the day-aware building map.
 *
 * Left: today's classes in order with their transitions. Pick a leg and the
 * route is drawn on the plan with turn-by-turn directions and a walk-time
 * versus passing-period check. Right: the interactive floor plan.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Footprints, Search, MapPin, Clock,
  AlertTriangle, ArrowRight, Utensils, CalendarDays, GraduationCap, Layers,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { FloorPlan } from '@/components/school/FloorPlan'
import {
  getSchoolDay, upcomingDays, routeBetween, searchRooms, findRoom, coursesInRoom,
  fmt12, toKey, fromKey, LUNCH_ROOM,
  type SchoolDay, type Route, type Floor, type PeriodSlot,
} from '@/lib/school'

/** A single walk the day requires: previous stop → next stop. */
interface Leg {
  key: string
  fromRoom: string
  toRoom: string
  label: string
  at: string
  /** Minutes available before the destination bell. */
  allowed: number
  route: Route | null
  kind: 'class' | 'lunch' | 'arrive'
}

export default function SchoolNavigationPage() {
  const [date, setDate] = useState<string>(() => toKey(new Date()))
  const [floor, setFloor] = useState<Floor>(1)
  const [activeLeg, setActiveLeg] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  /** An ad-hoc "route me from here to there" lookup, outside the day's legs. */
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null)

  const day: SchoolDay = useMemo(() => getSchoolDay(date), [date])
  const week = useMemo(() => upcomingDays(date, 6), [date])

  const legs: Leg[] = useMemo(() => buildLegs(day), [day])
  const dayLeg = legs.find((l) => l.key === activeLeg) ?? legs[0] ?? null
  const customLeg: Leg | null = useMemo(() => {
    if (!custom) return null
    const route = routeBetween(custom.from, custom.to)
    if (!route) return null
    return {
      key: 'custom', fromRoom: route.from.label, toRoom: route.to.label,
      label: `${route.from.label} → ${route.to.label}`, at: '', allowed: 0,
      route, kind: 'class',
    }
  }, [custom])
  const active = customLeg ?? dayLeg

  const accents = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of day.periods) {
      const r = findRoom(p.course.room)
      if (r) m[r.id] = p.course.accent
    }
    const caf = findRoom(LUNCH_ROOM)
    if (caf) m[caf.id] = '#facc15'
    return m
  }, [day])

  // Follow the active leg onto whichever floor it ends on.
  useEffect(() => {
    if (active?.route) setFloor(active.route.to.floor)
  }, [active?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => (query.trim() ? searchRooms(query, 8) : []), [query])
  const selectedRoom = selected ? findRoom(selected) : null
  const selectedClasses = selectedRoom ? coursesInRoom(selectedRoom.id) : []

  const shift = (dir: number) => {
    const d = fromKey(date)
    d.setDate(d.getDate() + dir)
    setDate(toKey(d))
    setActiveLeg(null)
    setCustom(null)
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* ── header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Previous day">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Next day">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-400" /> Navigate
          </h1>
          <p className="text-xs text-muted-foreground">{day.dateLabel}</p>
        </div>
        <DayBadge day={day} />
        {day.quarter && (
          <span className="text-[11px] px-2 py-1 rounded-full bg-muted text-muted-foreground font-semibold">
            Quarter {day.quarter}
          </span>
        )}
        {day.earlyRelease && (
          <span className="text-[11px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-500 font-semibold">
            2-hour early release
          </span>
        )}
        <button
          onClick={() => { setDate(toKey(new Date())); setActiveLeg(null) }}
          className="ml-auto text-xs font-semibold text-primary hover:underline"
        >
          Today
        </button>
        <Link href="/dashboard/prep" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
          <GraduationCap className="w-3.5 h-3.5" /> Prep for this day
        </Link>
      </div>

      {/* ── week strip ── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {week.map((d) => (
          <button
            key={d.date}
            onClick={() => { setDate(d.date); setActiveLeg(null) }}
            className={cn(
              'shrink-0 px-3 py-2 rounded-xl border text-left transition-colors min-w-[104px]',
              d.date === date ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50'
            )}
          >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {d.dateLabel.split(',')[0]}
            </div>
            <div className="text-sm font-bold">{d.dateLabel.split(', ')[1]}</div>
            <div className={cn('text-[10px] font-bold mt-0.5', d.type === 'blue' ? 'text-sky-400' : 'text-slate-400')}>
              {d.label}
            </div>
          </button>
        ))}
      </div>

      {!day.isSchoolDay ? (
        <Card className="p-8 text-center">
          <div className="text-4xl mb-2">🌤️</div>
          <div className="font-bold text-lg">{day.label}</div>
          {day.breakLabel && <div className="text-sm text-muted-foreground mt-1">{day.breakLabel}</div>}
          {day.next && (
            <button onClick={() => setDate(day.next!)} className="mt-4 text-sm text-primary hover:underline">
              Jump to the next school day →
            </button>
          )}
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-4 items-start">
          {/* ── itinerary ── */}
          <div className="space-y-3">
            <Card className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Today&apos;s route
                </h2>
                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <Footprints className="w-3 h-3" /> ~{day.totalWalkMetres} m
                </span>
              </div>

              <ol className="space-y-1">
                {legs.map((leg, i) => {
                  const isActive = leg.key === dayLeg?.key
                  const secs = leg.route ? Math.round(leg.route.seconds) : 0
                  const overBudget = leg.allowed > 0 && secs > leg.allowed * 60 * 0.7
                  return (
                    <li key={leg.key}>
                      <button
                        onClick={() => { setCustom(null); setActiveLeg(leg.key); setSelected(leg.toRoom) }}
                        className={cn(
                          'w-full text-left rounded-lg px-2.5 py-2 border transition-colors',
                          isActive && !customLeg ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted/50'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 shrink-0 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="text-sm font-semibold flex-1 min-w-0 truncate">{leg.label}</span>
                          <span className="text-[11px] tabular-nums text-muted-foreground">{leg.at}</span>
                        </div>
                        <div className="pl-8 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            {leg.kind === 'lunch' ? <Utensils className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                            {leg.fromRoom} <ArrowRight className="w-3 h-3" /> {leg.toRoom}
                          </span>
                          {leg.route && (
                            <span className={cn('tabular-nums', overBudget && 'text-amber-500 font-semibold')}>
                              {secs}s walk{leg.allowed > 0 ? ` / ${leg.allowed} min` : ''}
                            </span>
                          )}
                          {leg.route?.floorsCrossed && (
                            <span className="inline-flex items-center gap-0.5 text-violet-400">
                              <Layers className="w-3 h-3" /> stairs
                            </span>
                          )}
                          {overBudget && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </Card>

            {/* ── turn-by-turn ── */}
            {active?.route && (
              <Card className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {active.fromRoom} → {active.toRoom}
                  </h2>
                  {customLeg && (
                    <button onClick={() => setCustom(null)} className="text-[11px] text-primary hover:underline">
                      Back to today
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs mb-2 pb-2 border-b border-border/60">
                  <span className="tabular-nums font-semibold">{Math.round(active.route.distance)} m</span>
                  <span className="tabular-nums font-semibold">{Math.round(active.route.seconds)} s</span>
                  {active.allowed > 0 && (
                    <span className={cn(
                      'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                      active.route.seconds > active.allowed * 60 * 0.7
                        ? 'bg-amber-500/15 text-amber-500'
                        : 'bg-emerald-500/15 text-emerald-500'
                    )}>
                      {active.allowed} min passing period
                    </span>
                  )}
                </div>
                <ol className="space-y-1.5">
                  {active.route.steps.map((s, i) => (
                    <li key={i} className="flex gap-2 text-xs">
                      <span className={cn(
                        'w-4 h-4 shrink-0 rounded-full text-[9px] font-bold flex items-center justify-center mt-0.5',
                        s.stairs ? 'bg-violet-500/20 text-violet-400' : 'bg-muted text-muted-foreground'
                      )}>
                        {s.stairs ? '↕' : i + 1}
                      </span>
                      <span className={cn(s.stairs && 'text-violet-400 font-medium')}>{s.text}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            )}

            {/* ── room lookup ── */}
            <Card className="p-3">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" /> Find a room
              </h2>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="E106, gym, library, Mr. Fox's room…"
                className="w-full bg-muted/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {results.length > 0 && (
                <ul className="mt-2 space-y-0.5 max-h-52 overflow-y-auto">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => { setSelected(r.id); setFloor(r.floor); setQuery('') }}
                        className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-muted/60 text-sm flex items-center gap-2"
                      >
                        <span className="font-semibold">{r.label}</span>
                        {r.name && <span className="text-xs text-muted-foreground truncate">{r.name}</span>}
                        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                          Fl {r.floor} · {r.wing === 'Core' ? 'Core' : `${r.wing}-wing`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selectedRoom && !results.length && (
                <div className="mt-3 pt-3 border-t border-border/60">
                  <div className="text-sm font-bold">{selectedRoom.label}</div>
                  {selectedRoom.name && <div className="text-xs text-muted-foreground">{selectedRoom.name}</div>}
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Floor {selectedRoom.floor} · {selectedRoom.wing === 'Core' ? 'Central core' : `${selectedRoom.wing}-wing`}
                  </div>
                  {selectedClasses.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {selectedClasses.map((c) => (
                        <li key={c.id} className="text-xs flex items-center gap-1.5">
                          <span>{c.emoji}</span>
                          <span className="font-medium">{c.name}</span>
                          <span className="text-muted-foreground">· P{c.period} · {c.teacher}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {dayLeg && selectedRoom.id !== dayLeg.toRoom && (
                    <button
                      onClick={() => setCustom({ from: dayLeg.toRoom, to: selectedRoom.id })}
                      className="mt-2 text-xs text-primary hover:underline"
                    >
                      Route here from {dayLeg.toRoom} →
                    </button>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* ── map ── */}
          <FloorPlan
            floor={floor}
            onFloorChange={setFloor}
            path={day.roomPath}
            route={active?.route ?? null}
            selected={selected}
            onSelectRoom={setSelected}
            accents={accents}
            className="lg:sticky lg:top-4"
          />
        </div>
      )}

      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <CalendarDays className="w-3 h-3" />
        Walk times assume ~1.1 m/s in a crowded hall plus 35 s per flight of stairs. Treat them as a
        sanity check on the passing period, not a stopwatch.
      </p>
    </div>
  )
}

function DayBadge({ day }: { day: SchoolDay }) {
  const blue = day.type === 'blue'
  if (!day.isSchoolDay) {
    return <span className="text-[11px] px-2 py-1 rounded-full bg-muted text-muted-foreground font-semibold">{day.label}</span>
  }
  return (
    <span className={cn(
      'text-[11px] px-2.5 py-1 rounded-full font-bold',
      blue ? 'bg-sky-500/15 text-sky-400' : 'bg-slate-400/15 text-slate-400'
    )}>
      {day.label} · periods {day.periods.map((p) => p.period).join(' · ')}
    </span>
  )
}

/**
 * Flatten the day into the walks it actually requires, including the detour to
 * the cafeteria when A lunch opens the double block.
 */
function buildLegs(day: SchoolDay): Leg[] {
  if (!day.isSchoolDay) return []
  const legs: Leg[] = []
  let prevRoom: string | null = null

  const push = (from: string | null, to: string, label: string, at: string, allowed: number, kind: Leg['kind']) => {
    legs.push({
      key: `${legs.length}:${from ?? 'start'}:${to}`,
      fromRoom: from ?? 'Arrive',
      toRoom: to,
      label, at, allowed, kind,
      route: from ? routeBetween(from, to) : null,
    })
  }

  day.periods.forEach((p: PeriodSlot, i) => {
    if (p.lunch?.first) {
      push(prevRoom, LUNCH_ROOM, `${p.lunch.slot} Lunch`, fmt12(p.lunch.start), p.passingIn, 'lunch')
      prevRoom = LUNCH_ROOM
      push(prevRoom, p.course.room, `P${p.period} · ${p.course.short}`, fmt12(p.start), 0, 'class')
    } else {
      push(
        prevRoom,
        p.course.room,
        `P${p.period} · ${p.course.short}`,
        fmt12(p.start),
        i === 0 ? 0 : p.passingIn,
        i === 0 ? 'arrive' : 'class'
      )
    }
    prevRoom = p.course.room
  })

  return legs
}
