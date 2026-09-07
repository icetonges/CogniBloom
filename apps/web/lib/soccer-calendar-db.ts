import 'server-only'
import { db } from '@/lib/db'
import { easternWallTimeToUTC, utcInstantToEasternTime } from '@/lib/timezone'
import { parseIcs } from '@/lib/soccer-ics'
import {
  practiceOn, minus, plus, travelMinutesForVenue, isCancelledEvent, stripCancelledPrefix,
  EARLY_PRACTICE_MIN, EARLY_MATCH_MIN,
} from '@/lib/soccer'

/**
 * Bridges the PlayMetrics-synced `SoccerEvent` table to the rest of the app —
 * the same role `lib/school-db.ts` plays for `SchoolCalendarDay`. Kept
 * separate from `lib/soccer.ts` / `lib/soccer-ics.ts` so those stay
 * Prisma-free and importable from client components.
 */

const ICS_URL_ENV = 'SOCCER_ICS_URL'

/**
 * Marks a planner row that came from the static pre-sync fallback in
 * `lib/soccer.ts` rather than the real PlayMetrics feed.
 *
 * 2026-09-07: a practice that had been cancelled still showed on the planner
 * as an ordinary commitment. The sync had never run once — `SOCCER_ICS_URL`
 * was never set in Vercel, so every cron fire 502'd — which left
 * `SoccerEvent` empty, which is exactly the condition the fallback exists
 * for. The fallback wasn't wrong to fire; it was wrong to be silent. A guess
 * now says it's a guess, all the way to the UI.
 */
export const UNSYNCED_TAG = 'unsynced'
export const UNSYNCED_NOTE = "⚠ Unconfirmed — soccer calendar has never synced"

function parseDateKeyParts(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number)
  return { y: y!, m: m! - 1, d: d! }
}

function dateKeyToUTC(dateKey: string, hhmm: string): Date {
  const { y, m, d } = parseDateKeyParts(dateKey)
  return easternWallTimeToUTC(y, m, d, hhmm)
}

function addDaysToKey(key: string, days: number): string {
  const { y, m, d } = parseDateKeyParts(key)
  const dt = new Date(Date.UTC(y, m, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

/** True when the error is "relation does not exist" — the migration hasn't
 * been applied yet. Same check as lib/school-db.ts's `isMissingTable`. */
function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string }
  return e?.code === 'P2021' || /does not exist|relation .* does not exist/i.test(e?.message ?? '')
}

// ── sync ─────────────────────────────────────────────────────────────────

export interface SyncResult {
  ok: boolean
  total: number
  created: number
  updated: number
  removedFuture: number
  skippedOther: number
  error?: string
}

/**
 * Fetch the team's published PlayMetrics .ics feed and upsert every VEVENT
 * into `SoccerEvent`, keyed by its ICS UID so re-running never duplicates.
 *
 * Future rows (startAt in the future) that used to be synced but no longer
 * appear in the feed are removed — PlayMetrics does sometimes drop and
 * re-create an event under a new UID when it is rescheduled. It does NOT do
 * that for a cancellation: a cancelled session stays in the feed with
 * `STATUS:CANCELLED`, so it is stored here like any other row and filtered
 * out on read by `isCancelledEvent` (see lib/soccer.ts). Keeping the row is
 * deliberate — "practice cancelled" is information worth showing, and this
 * app does not delete records. Past rows are left alone even if
 * they've aged out of the export; that history is worth keeping (and this
 * app has already lost data once to a moment of “it's fine to just clear
 * this” — see the note-loss incident write-up).
 */
export async function syncSoccerCalendar(): Promise<SyncResult> {
  const url = process.env[ICS_URL_ENV]
  if (!url) {
    return { ok: false, total: 0, created: 0, updated: 0, removedFuture: 0, skippedOther: 0, error: `${ICS_URL_ENV} is not set` }
  }

  let text: string
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: 'no-store' })
    if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status}`)
    text = await res.text()
  } catch (err) {
    return {
      ok: false, total: 0, created: 0, updated: 0, removedFuture: 0, skippedOther: 0,
      error: err instanceof Error ? err.message : 'fetch failed',
    }
  }

  const events = parseIcs(text)
  let created = 0
  let updated = 0
  let skippedOther = 0
  const seenIds: string[] = []

  for (const ev of events) {
    seenIds.push(ev.uid)
    if (ev.kind === 'other') skippedOther += 1

    const startAt = dateKeyToUTC(ev.startDate, ev.startTime ?? '00:00')
    const endAt = dateKeyToUTC(ev.endDate, ev.endTime ?? ev.startTime ?? '00:00')

    const data = {
      kind: ev.kind,
      summary: ev.summary,
      description: ev.description,
      location: ev.location,
      opponent: ev.opponent,
      venue: ev.venue,
      uniform: ev.uniform,
      startAt,
      endAt,
      allDay: ev.allDay,
      status: ev.status,
      source: 'playmetrics',
      lastSeenAt: new Date(),
    }

    try {
      const existing = await db.soccerEvent.findUnique({ where: { externalId: ev.uid } })
      if (existing) {
        await db.soccerEvent.update({ where: { externalId: ev.uid }, data })
        updated += 1
      } else {
        await db.soccerEvent.create({ data: { externalId: ev.uid, ...data } })
        created += 1
      }
    } catch (err) {
      if (isMissingTable(err)) {
        return {
          ok: false, total: events.length, created, updated, removedFuture: 0, skippedOther,
          error: 'SoccerEvent table does not exist yet — run the pending migration (prisma migrate deploy)',
        }
      }
      throw err
    }
  }

  let removedFuture = 0
  try {
    const { count } = await db.soccerEvent.deleteMany({
      where: {
        source: 'playmetrics',
        externalId: { notIn: seenIds.length > 0 ? seenIds : ['__none-seen__'] },
        startAt: { gte: new Date() },
      },
    })
    removedFuture = count
  } catch (err) {
    if (!isMissingTable(err)) throw err
  }

  return { ok: true, total: events.length, created, updated, removedFuture, skippedOther }
}

// ── reading the schedule ────────────────────────────────────────────────

export interface SoccerWindow {
  kind: 'practice' | 'game'
  date: string
  summary: string
  opponent: string | null
  venue: string | null
  uniform: string | null
  /** "HH:mm" Eastern, or null when PlayMetrics hasn't published a time yet. */
  start: string | null
  end: string | null
  arriveBy: string | null
  leaveAt: string | null
  homeAt: string | null
  tbd: boolean
  /** True for a row synthesized from the static pre-sync fallback list. */
  isFallback: boolean
}

interface EventRow {
  kind: string
  summary: string
  opponent: string | null
  venue: string | null
  uniform: string | null
  startAt: Date
  endAt: Date | null
  allDay: boolean
}

function windowFromRow(row: EventRow, dateKey: string): SoccerWindow {
  const kind: 'practice' | 'game' = row.kind === 'game' ? 'game' : 'practice'

  if (row.allDay) {
    return {
      kind, date: dateKey, summary: row.summary, opponent: row.opponent, venue: row.venue,
      uniform: row.uniform, start: null, end: null, arriveBy: null, leaveAt: null, homeAt: null,
      tbd: true, isFallback: false,
    }
  }

  const start = utcInstantToEasternTime(row.startAt).hhmm
  const end = row.endAt ? utcInstantToEasternTime(row.endAt).hhmm : null
  const earlyMin = kind === 'game' ? EARLY_MATCH_MIN : EARLY_PRACTICE_MIN
  const arriveBy = minus(start, earlyMin)
  const travel = travelMinutesForVenue(row.venue)
  const leaveAt = minus(arriveBy, travel)
  const homeAt = end ? plus(end, travel) : null

  return {
    kind, date: dateKey, summary: row.summary, opponent: row.opponent, venue: row.venue,
    uniform: row.uniform, start, end, arriveBy, leaveAt, homeAt, tbd: false, isFallback: false,
  }
}

/** The static fallback, shaped like a synced row — used only before the
 * first sync (or if the table isn't there yet). */
function fallbackWindowFor(dateKey: string): SoccerWindow | null {
  const { y, m, d } = parseDateKeyParts(dateKey)
  const weekday = new Date(Date.UTC(y, m, d)).getUTCDay()
  const p = practiceOn(weekday)
  if (!p) return null
  const arriveBy = p.arriveBy
  const leaveAt = minus(arriveBy, p.travelMinutes)
  const end = plus(p.start, p.minutes)
  const homeAt = plus(end, p.travelMinutes)
  return {
    kind: 'practice', date: dateKey, summary: 'BRYC practice', opponent: null, venue: p.venue,
    uniform: null, start: p.start, end, arriveBy, leaveAt, homeAt, tbd: false, isFallback: true,
  }
}

/**
 * What's happening on this specific Eastern date — a practice or a game, or
 * null when nothing is scheduled. A game takes priority over a practice on
 * the rare day both are synced (a tournament day, say).
 *
 * Falls back to the static `PRACTICES` weekly list only when the synced
 * calendar has genuinely never been populated (no sync has ever run, or the
 * migration hasn't landed yet) — not merely because this particular date has
 * nothing on it, which is a perfectly real answer once syncing is live.
 */
export async function soccerWindowFor(dateKey: string): Promise<SoccerWindow | null> {
  const dayStart = dateKeyToUTC(dateKey, '00:00')
  const dayEnd = dateKeyToUTC(addDaysToKey(dateKey, 1), '00:00')

  try {
    const all = await db.soccerEvent.findMany({
      where: { startAt: { gte: dayStart, lt: dayEnd }, kind: { in: ['practice', 'game'] } },
      orderBy: { startAt: 'asc' },
    })
    // A cancelled session is not a commitment. Dropping it here means the
    // planner's soccer band generates nothing for the day, and seed-day's
    // stale-row reconciliation clears any rows a previous seed had created.
    const rows = all.filter((r) => !isCancelledEvent(r))
    if (rows.length > 0) {
      const chosen = rows.find((r) => r.kind === 'game') ?? rows[0]!
      return windowFromRow(chosen, dateKey)
    }
    // Distinguish "cancelled" from "never synced": if the only thing on this
    // date is a cancellation, the calendar has plainly synced, so the static
    // fallback must not step in and re-invent the practice that was called off.
    if (all.length > 0) return null
    const everSynced = await db.soccerEvent.count()
    if (everSynced > 0) return null
    return fallbackWindowFor(dateKey)
  } catch (err) {
    if (isMissingTable(err)) return fallbackWindowFor(dateKey)
    throw err
  }
}

/**
 * The two timing facts the personal routine (lib/daily-routine.ts) needs for
 * a practice evening — null for anything else (no practice, a game instead,
 * or a practice whose time PlayMetrics hasn't published yet).
 */
export async function practiceTimingFor(dateKey: string): Promise<{ leaveAt: string; homeAt: string } | null> {
  const w = await soccerWindowFor(dateKey)
  if (!w || w.kind !== 'practice' || w.tbd || !w.leaveAt || !w.homeAt) return null
  return { leaveAt: w.leaveAt, homeAt: w.homeAt }
}

export interface SeedItem {
  title: string
  time: string
  details: string
  tags: string[]
}

/**
 * The locked, authoritative rows for this date's soccer commitment — kit
 * out, leave, arrive/warm up, the session itself, home. Reconciled every
 * time the day is seeded (see /api/planner/seed-day), the same way the
 * school class schedule is: a calendar correction reaches an already-seeded
 * future day immediately, it doesn't wait on a ROUTINE_VERSION bump the way
 * the personal routine does.
 */
export async function soccerBandItems(dateKey: string): Promise<SeedItem[]> {
  const w = await soccerWindowFor(dateKey)
  if (!w) return []

  const label = w.kind === 'game' ? (w.opponent ? `Game vs ${w.opponent}` : 'Game') : 'BRYC practice'
  const tag = w.kind
  const items: SeedItem[] = []

  if (w.tbd || !w.start || !w.arriveBy || !w.leaveAt) {
    items.push({
      title: `⚽ ${label} — time TBD`,
      time: '07:00',
      details: [w.venue, w.uniform ? `Uniform: ${w.uniform}` : null, 'Check PlayMetrics for the start time']
        .filter(Boolean).join(' · '),
      tags: ['soccer', 'locked', tag],
    })
  } else {
    items.push(
      {
        title: 'Kit out + ball in the car',
        time: minus(w.leaveAt, 15),
        details: w.kind === 'game'
          ? `Both kits, shin guards, water, the same ball${w.uniform ? ` · Uniform: ${w.uniform}` : ''}`
          : 'Boots, shin guards, both kits, water, the same ball',
        tags: ['soccer', 'locked', tag, 'prep'],
      },
      {
        title: `Leave for ${w.kind === 'game' ? 'the game' : 'practice'}`,
        time: w.leaveAt,
        details: `${w.venue ?? 'Venue TBD'}`,
        tags: ['soccer', 'locked', tag, 'transport'],
      },
      {
        title: 'On the field — warm up',
        time: w.arriveBy,
        details: w.kind === 'game'
          ? 'Coach’s rule: 45 minutes early'
          : 'Coach’s rule: 15 minutes early, boots on, ball out',
        tags: ['soccer', 'locked', tag],
      },
      {
        title: `⚽ ${label}`,
        time: w.start,
        details: [w.venue, w.end ? `${w.start}–${w.end}` : null, 'Coach West']
          .filter(Boolean).join(' · '),
        tags: ['soccer', 'locked', tag],
      },
    )

    if (w.homeAt) {
      items.push({
        title: 'Home + dinner',
        time: w.homeAt,
        details: 'Eat, shower, then one study block',
        tags: ['soccer', 'locked', tag, 'rest'],
      })
    }
  }

  // Everything above is identical whether the window came from the synced
  // calendar or the static weekly guess. The one thing that must differ is
  // how confidently it's presented — so provisional rows carry the marker
  // tag and say so in their own details text, rather than relying on some
  // other part of the app to remember to check.
  if (!w.isFallback) return items
  return items.map((it) => ({
    ...it,
    details: [it.details, UNSYNCED_NOTE].filter(Boolean).join(' · '),
    tags: [...it.tags, UNSYNCED_TAG],
  }))
}

// ── the schedule for the dashboard / API ────────────────────────────────

export interface ScheduleEntry {
  id: string
  externalId: string
  kind: 'practice' | 'game'
  date: string
  start: string | null
  end: string | null
  arriveBy: string | null
  leaveAt: string | null
  venue: string | null
  opponent: string | null
  uniform: string | null
  summary: string
  tbd: boolean
  /** PlayMetrics keeps cancelled sessions in the feed; these are surfaced
   *  (struck through) rather than hidden, so "it's off" is visible. */
  cancelled: boolean
}

/**
 * Every practice/game between two Eastern dates (inclusive), for the Soccer
 * dashboard page and `/api/soccer/schedule`. Empty (not the static
 * fallback) once the table exists but nothing has synced into this range
 * yet — the fallback is only for `soccerWindowFor`'s day-by-day planner use,
 * not for a whole-range listing that would otherwise show a stale weekly
 * pattern next to genuinely-synced dates.
 */
export async function scheduleBetween(fromKey: string, toKey: string): Promise<{
  practices: ScheduleEntry[]
  games: ScheduleEntry[]
  lastSyncedAt: string | null
  /** False when `SoccerEvent` is empty — nothing has ever synced, so an
   *  empty list here means "we don't know", not "nothing is scheduled". */
  synced: boolean
}> {
  const from = dateKeyToUTC(fromKey, '00:00')
  const to = dateKeyToUTC(toKey, '23:59')

  try {
    const rows = await db.soccerEvent.findMany({
      where: { startAt: { gte: from, lte: to }, kind: { in: ['practice', 'game'] } },
      orderBy: { startAt: 'asc' },
    })
    const latest = await db.soccerEvent.findFirst({ orderBy: { lastSeenAt: 'desc' }, select: { lastSeenAt: true } })

    const entries = rows.map((r): ScheduleEntry => {
      const kind: 'practice' | 'game' = r.kind === 'game' ? 'game' : 'practice'
      const dateKey = utcInstantToEasternTime(r.startAt).dateKey
      const cancelled = isCancelledEvent(r)
      const summary = cancelled ? stripCancelledPrefix(r.summary) : r.summary
      if (r.allDay) {
        return {
          id: r.id, externalId: r.externalId, kind, date: dateKey, start: null, end: null,
          arriveBy: null, leaveAt: null, venue: r.venue, opponent: r.opponent, uniform: r.uniform,
          summary, tbd: true, cancelled,
        }
      }
      const start = utcInstantToEasternTime(r.startAt).hhmm
      const end = r.endAt ? utcInstantToEasternTime(r.endAt).hhmm : null
      const earlyMin = kind === 'game' ? EARLY_MATCH_MIN : EARLY_PRACTICE_MIN
      const arriveBy = minus(start, earlyMin)
      const leaveAt = minus(arriveBy, travelMinutesForVenue(r.venue))
      return {
        id: r.id, externalId: r.externalId, kind, date: dateKey, start, end, arriveBy, leaveAt,
        venue: r.venue, opponent: r.opponent, uniform: r.uniform, summary, tbd: false, cancelled,
      }
    })

    return {
      practices: entries.filter((e) => e.kind === 'practice'),
      games: entries.filter((e) => e.kind === 'game'),
      lastSyncedAt: latest?.lastSeenAt.toISOString() ?? null,
      synced: latest !== null,
    }
  } catch (err) {
    if (isMissingTable(err)) return { practices: [], games: [], lastSyncedAt: null, synced: false }
    throw err
  }
}
