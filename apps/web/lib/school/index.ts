/**
 * School day assembly — the single entry point the rest of the app uses.
 *
 *   getSchoolDay('2026-08-24')
 *     → { type: 'blue', periods: [...with rooms, times, walking routes...] }
 *
 * Pure, synchronous, no I/O. Safe to call from a server route, a client
 * component, or the planner seeder.
 */

import {
  type DateKey,
  type DayType,
  dayTypeOf,
  quarterOf,
  isEarlyRelease,
  nextSchoolDay,
  prevSchoolDay,
  breakFor,
  fromKey,
  schoolDaysRemaining,
} from './calendar'
import {
  type BellBlock,
  type ScheduleKind,
  blocksForKind,
  scheduleKindFor,
  splitLunchBlock,
  passingMinutes,
  fmt12,
  toMin,
} from './bell'
import { type Course, COURSES, LUNCH_SLOT, coursesOn, meetsOn, EVERYDAY_KIT } from './courses'
import { type Route, routeBetween, findRoom } from './rooms'
import { resourcesFor } from './resources'
import { type CalendarOverride, type ResolvedDay, resolveDay, dayLabelOf } from './resolve'

export * from './calendar'
export * from './bell'
export * from './courses'
export * from './rooms'
export * from './resources'
export * from './year-calendar'
export * from './resolve'

export interface PeriodSlot {
  period: number
  course: Course
  start: string
  end: string
  /** Present only for the lunch double-block. */
  lunch?: { start: string; end: string; slot: string; first: boolean }
  /** Minutes of passing time before this class starts. */
  passingIn: number
  /**
   * Walk from the previous class to wherever this block starts — the
   * cafeteria when lunch comes first, otherwise the classroom itself.
   */
  routeIn: Route | null
  /** Cafeteria → classroom, only when the lunch half runs first. */
  lunchLeg: Route | null
  /** True when `routeIn` needs more time than the passing period allows. */
  tight: boolean
  note?: string
}

export interface SchoolDay {
  date: DateKey
  type: DayType
  isSchoolDay: boolean
  /** 'Blue Day' / 'Gray Day' / the closure reason. */
  label: string
  /** The full three-layer resolution behind this day. */
  resolved: ResolvedDay
  /** e.g. "Thursday, August 20". */
  dateLabel: string
  scheduleKind: ScheduleKind
  quarter: number | null
  breakLabel: string | null
  /** Why there is no school, when there isn't — e.g. "Thanksgiving Break". */
  closureReason: string | null
  /** Which layer closed the day: a manual override, FCPS, or the rotation. */
  closureSource: 'manual' | 'fcps' | 'rotation' | null
  /** Religious or cultural observance on this date. Never closes the day. */
  observance: string | null
  earlyRelease: boolean
  periods: PeriodSlot[]
  /** Period 9 / any untimed designator courses meeting today. */
  untimed: Course[]
  firstBell: string | null
  lastBell: string | null
  /** Everything to have in the bag today: the everyday kit + per-class extras. */
  packList: { item: string; forCourse?: string }[]
  /** Rooms in visit order, for map highlighting. */
  roomPath: string[]
  totalWalkMetres: number
  next: DateKey | null
  prev: DateKey | null
  schoolDaysLeft: number
}

/** Where the lunch half of the double block actually happens. */
export const LUNCH_ROOM = 'Cafeteria'

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function dateLabelOf(key: DateKey): string {
  const d = fromKey(key)
  return `${WEEKDAY[d.getDay()]}, ${MONTH[d.getMonth()]} ${d.getDate()}`
}

export interface DayOptions {
  /** The SchoolCalendarDay row for this date, when one exists. */
  override?: CalendarOverride | null
  /** Model an unplanned 2-hour delay (snow, etc.). */
  delayed?: boolean
}

/**
 * Build the complete plan for one calendar day, after resolving the manual
 * override / FCPS year calendar / Blue-Gray rotation precedence chain. A day
 * the year calendar closes comes back with no periods, no route and no pack
 * list — the closure is expressed once, here, and every caller inherits it.
 *
 * Accepts a bare boolean as the second argument for backwards compatibility.
 */
export function getSchoolDay(date: DateKey, opts: DayOptions | boolean = {}): SchoolDay {
  const o: DayOptions = typeof opts === 'boolean' ? { delayed: opts } : opts
  const delayed = o.delayed ?? false
  const r = resolveDay(date, o.override ?? null)
  const type = r.type
  const school = r.isSchoolDay
  const q = quarterOf(date)
  const brk = breakFor(date)

  const base: SchoolDay = {
    date,
    type,
    isSchoolDay: school,
    label: dayLabelOf(r),
    resolved: r,
    dateLabel: dateLabelOf(date),
    scheduleKind: r.forcedScheduleKind ?? scheduleKindFor(date, delayed),
    quarter: q?.n ?? null,
    breakLabel: brk?.label ?? r.closureReason,
    closureReason: r.closureReason,
    closureSource: r.closureSource,
    observance: r.observance,
    earlyRelease: r.earlyRelease || isEarlyRelease(date),
    periods: [],
    untimed: [],
    firstBell: null,
    lastBell: null,
    packList: [],
    roomPath: [],
    totalWalkMetres: 0,
    next: nextSchoolDay(date),
    prev: prevSchoolDay(date),
    schoolDaysLeft: schoolDaysRemaining(date),
  }

  if (!school) return base

  const dayType = type as 'blue' | 'gray'
  const enrolled = coursesOn(date)
  // Built from the *resolved* rotation and schedule kind, so an override that
  // reopens or shortens a day changes the bells too.
  const blocks: BellBlock[] = blocksForKind(dayType, base.scheduleKind)

  const periods: PeriodSlot[] = []
  let prevBlock: BellBlock | null = null
  let prevRoom: string | null = null
  let walk = 0

  for (const block of blocks) {
    const course = enrolled.find((c) => c.period === block.period && meetsOn(c, dayType))
    if (!course) continue

    const passingIn = prevBlock ? passingMinutes(prevBlock, block) : 0

    // Where does he actually walk to when this block's bell rings? Normally the
    // classroom — but on the lunch block with an A lunch, the cafeteria comes
    // first and the classroom is a second leg after eating.
    let lunchInfo: PeriodSlot['lunch']
    let start = block.start
    let end = block.end
    if (block.hasLunch) {
      const split = splitLunchBlock(block, LUNCH_SLOT, base.scheduleKind)
      lunchInfo = { ...split.lunch, slot: LUNCH_SLOT, first: split.lunchFirst }
      start = split.classTime.start
      end = split.classTime.end
    }

    const lunchFirst = !!lunchInfo?.first
    const firstStop = lunchFirst ? LUNCH_ROOM : course.room
    const routeIn = prevRoom ? routeBetween(prevRoom, firstStop) : null
    const lunchLeg = lunchFirst ? routeBetween(LUNCH_ROOM, course.room) : null
    if (routeIn) walk += routeIn.distance
    if (lunchLeg) walk += lunchLeg.distance

    const slot: PeriodSlot = {
      period: block.period,
      course,
      start,
      end,
      passingIn,
      routeIn,
      lunchLeg,
      // "Tight" once the walk eats more than 70% of the passing period — there
      // is still the locker, the water fountain and 900 other kids in the hall.
      tight: !!routeIn && prevBlock !== null && routeIn.seconds > passingIn * 60 * 0.7,
      ...(block.note ? { note: block.note } : {}),
      ...(lunchInfo ? { lunch: lunchInfo } : {}),
    }

    periods.push(slot)
    prevBlock = block
    prevRoom = course.room
  }

  const untimed = enrolled.filter((c) => c.untimed && meetsOn(c, dayType))

  // Pack list: the everyday kit, then anything a class specifically needs,
  // de-duplicated so "Chromebook" doesn't appear six times.
  const seen = new Set<string>()
  const packList: { item: string; forCourse?: string }[] = []
  for (const item of EVERYDAY_KIT) {
    packList.push({ item })
    seen.add(item.toLowerCase())
  }
  for (const slot of periods) {
    for (const m of slot.course.materials) {
      const k = m.toLowerCase()
      if (seen.has(k) || k.includes('chromebook') || k.includes('binder —')) continue
      seen.add(k)
      packList.push({ item: m, forCourse: slot.course.short })
    }
  }

  return {
    ...base,
    periods,
    untimed,
    firstBell: periods[0]?.start ?? null,
    lastBell: periods[periods.length - 1]?.end ?? null,
    packList,
    roomPath: periods.flatMap((p) => (p.lunch?.first ? [LUNCH_ROOM, p.course.room] : [p.course.room])),
    totalWalkMetres: Math.round(walk),
  }
}

// ── Prep ────────────────────────────────────────────────────────────────────

export interface CoursePrep {
  course: Course
  period: number
  time: string
  room: string
  roomName: string | null
  /** The course's subject-matter arc for the year. */
  arc: string
  /** Two or three highest-value sources for tonight. */
  keySources: { label: string; url: string; note: string }[]
  /** The next rung on the challenge ladder. */
  nextRung: { level: number; title: string; goal: string; action: string } | null
  habits: string[]
  materials: string[]
}

/**
 * Everything Daniel needs in order to walk into tomorrow prepared.
 * `ladderLevels` maps courseId → the rung he has reached, so the prep names
 * the *next* one rather than starting from level 1 every time.
 */
export function buildPrep(date: DateKey, ladderLevels: Record<string, number> = {}): CoursePrep[] {
  const day = getSchoolDay(date)
  return day.periods.map((slot) => {
    const res = resourcesFor(slot.course.id)
    const at = ladderLevels[slot.course.id] ?? 0
    const nextRung = res?.ladder.find((r) => r.level > at) ?? null
    const room = findRoom(slot.course.room)
    return {
      course: slot.course,
      period: slot.period,
      time: `${fmt12(slot.start)} – ${fmt12(slot.end)}`,
      room: slot.course.room,
      roomName: room?.name ?? null,
      arc: res?.arc ?? '',
      keySources: (res?.sources ?? []).slice(0, 3).map((s) => ({ label: s.label, url: s.url, note: s.note })),
      nextRung: nextRung
        ? { level: nextRung.level, title: nextRung.title, goal: nextRung.goal, action: nextRung.action }
        : null,
      habits: res?.habits ?? [],
      materials: slot.course.materials,
    }
  })
}

/**
 * A compact, token-cheap description of a day for the AI coach prompt.
 * Deliberately terse — the model does not need the SVG geometry.
 */
export function describeDayForAI(date: DateKey, ladderLevels: Record<string, number> = {}): string {
  const day = getSchoolDay(date)
  if (!day.isSchoolDay) {
    return `${day.dateLabel} — ${day.label}${day.breakLabel ? ` (${day.breakLabel})` : ''}. No classes.`
  }
  const lines = day.periods.map((p) => {
    const bits = [
      `P${p.period} ${fmt12(p.start)}-${fmt12(p.end)}`,
      p.course.name,
      `(${p.course.rigor})`,
      `rm ${p.course.room}`,
      p.course.teacher,
    ]
    if (p.lunch) bits.push(`[${p.lunch.slot} lunch ${fmt12(p.lunch.start)}-${fmt12(p.lunch.end)}]`)
    if (p.tight) bits.push('[tight transition]')
    const at = ladderLevels[p.course.id] ?? 0
    bits.push(`ladder@${at}`)
    return '  ' + bits.join(' · ')
  })
  return [
    `${day.dateLabel} — ${day.label}, Quarter ${day.quarter ?? '?'}${day.earlyRelease ? ', 2-hour early release' : ''}.`,
    `Bells ${fmt12(day.firstBell ?? '')} to ${fmt12(day.lastBell ?? '')}. Walking ~${day.totalWalkMetres} m across ${day.periods.length} rooms.`,
    ...lines,
    day.untimed.length ? `  Homeroom/team: ${day.untimed.map((c) => `${c.name} (${c.room}, ${c.teacher})`).join(', ')}` : '',
  ].filter(Boolean).join('\n')
}

/**
 * Rolling window of upcoming school days — for the week strip and year view.
 * `lookup` supplies the stored override for a date, so a snow day is skipped
 * here exactly as it is everywhere else.
 */
export function upcomingDays(
  from: DateKey,
  count = 5,
  lookup?: (date: DateKey) => CalendarOverride | null
): SchoolDay[] {
  const out: SchoolDay[] = []
  const at = (d: DateKey) => getSchoolDay(d, { override: lookup?.(d) ?? null })
  let cursor: DateKey | null = from
  let guard = 0
  while (cursor && out.length < count && guard++ < 400) {
    const day = at(cursor)
    if (day.isSchoolDay) out.push(day)
    cursor = nextSchoolDay(cursor)
  }
  return out
}

/** Minutes until the next bell, or null outside the school day. */
export function minutesToNextBell(date: DateKey, nowHHmm: string): { label: string; minutes: number } | null {
  const day = getSchoolDay(date)
  if (!day.isSchoolDay) return null
  const now = toMin(nowHHmm)
  for (const p of day.periods) {
    if (now < toMin(p.start)) return { label: `${p.course.short} starts`, minutes: toMin(p.start) - now }
    if (now < toMin(p.end)) return { label: `${p.course.short} ends`, minutes: toMin(p.end) - now }
  }
  return null
}

/** Course lookup by room, for the map's "what happens here" tooltip. */
export function coursesInRoom(room: string): Course[] {
  return COURSES.filter((c) => c.room.toLowerCase() === room.toLowerCase())
}
