/**
 * Minimal iCalendar (RFC 5545) VEVENT parser for the PlayMetrics team
 * calendar feed.
 *
 * Deliberately narrow: it understands the subset PlayMetrics actually
 * emits (checked against the live feed on 2026-09-06) rather than the full
 * RFC. In particular:
 *   - No RRULE. Every practice and game is its own VEVENT, one per
 *     occurrence — PlayMetrics does not use recurrence rules at all.
 *   - DTSTART/DTEND are always either `TZID=America/New_York:YYYYMMDDTHHMMSS`
 *     or a bare `YYYYMMDDTHHMMSS`/`YYYYMMDD` — this calendar has exactly one
 *     team, so there is only one timezone to worry about, and every value is
 *     treated as that Eastern wall-clock time regardless of any TZID param.
 *   - A bare 8-digit date (no "T") means "no time set yet" — PlayMetrics
 *     emits this (with a TZID param it doesn't actually need) for
 *     tournament games before the bracket schedule is published ("Start
 *     Time TBD" in the description).
 *   - PlayMetrics's own UID prefix ("Practice_12345" / "Game_67890") is the
 *     ground truth for classification; SUMMARY text is only a fallback.
 */

export type IcsEventKind = 'practice' | 'game' | 'other'

export interface IcsEvent {
  uid: string
  kind: IcsEventKind
  summary: string
  /** Full unescaped DESCRIPTION, kept verbatim even when the heuristics below fail to parse it. */
  description: string | null
  /** Unescaped LOCATION (street address), or null when absent or literally "TBD". */
  location: string | null
  status: string | null
  /** Eastern calendar date "YYYY-MM-DD". */
  startDate: string
  /** Eastern wall-clock "HH:mm", or null when `allDay` is true. */
  startTime: string | null
  endDate: string
  endTime: string | null
  /** True when DTSTART carried no time-of-day (a TBD tournament game). */
  allDay: boolean
  /** Best-effort, games only — who "U13 Boys ECNL-RL" plays, parsed out of DESCRIPTION's first line. */
  opponent: string | null
  /** Best-effort venue name (distinct from the street address in `location`). */
  venue: string | null
  /** Best-effort "HH:mm" parsed from "Arrive by 8:15 AM" in DESCRIPTION. */
  arriveByTime: string | null
  /** Best-effort, the text after "Uniform:" in DESCRIPTION. */
  uniform: string | null
}

// ── low-level line handling ─────────────────────────────────────────────────

/** Un-fold RFC5545 line continuations (a line starting with space/tab
 * continues the previous line) and normalize line endings. */
function unfold(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '')
}

/** Un-escape an RFC5545 TEXT value. */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\N/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

interface RawProp {
  name: string
  value: string
}

/** Split "NAME;PARAM=X;PARAM2=Y:value" into name + value. Params are not
 * needed beyond detecting the property name — every DTSTART/DTEND value in
 * this feed is Eastern wall-clock regardless of what its TZID param says. */
function parseLine(line: string): RawProp | null {
  const colon = line.indexOf(':')
  if (colon === -1) return null
  const head = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const name = head.split(';')[0]!.toUpperCase().trim()
  return { name, value }
}

/** DTSTART/DTEND value → Eastern date + optional time-of-day. */
function parseDateTimeValue(value: string): { date: string; time: string | null } {
  const v = value.trim().replace(/Z$/, '')
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v)
  if (dateOnly) return { date: `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`, time: null }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/.exec(v)
  if (!m) return { date: v, time: null }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` }
}

/** "8:15 AM" / "2:30PM" → "08:15" / "14:30". Null if it doesn't parse. */
function to24h(t: string): string | null {
  const m = /^(\d{1,2}):(\d{2})\s*([AP])M?$/i.exec(t.trim())
  if (!m) return null
  let hh = Number(m[1])
  const mm = m[2]
  const ap = m[3]!.toUpperCase()
  if (ap === 'P' && hh !== 12) hh += 12
  if (ap === 'A' && hh === 12) hh = 0
  return `${String(hh).padStart(2, '0')}:${mm}`
}

// ── classification + description parsing ────────────────────────────────────

export function classify(uid: string, summary: string): IcsEventKind {
  if (/^practice[_-]/i.test(uid)) return 'practice'
  if (/^game[_-]/i.test(uid)) return 'game'
  const s = summary.toLowerCase()
  if (s.includes('practice')) return 'practice'
  if (s.includes('game')) return 'game'
  return 'other'
}

/** "Team A at Team B (League)" → whichever side isn't our own team. */
function parseOpponent(firstLine: string, ourTeamHint: string): string | null {
  const parts = firstLine.split(/\s+at\s+/i)
  if (parts.length !== 2) return null
  let [a, b] = parts as [string, string]
  a = a.trim()
  b = b.replace(/\s*\([^]*\)\s*$/, '').trim()
  if (a.toLowerCase().includes(ourTeamHint.toLowerCase())) return b || null
  if (b.toLowerCase().includes(ourTeamHint.toLowerCase())) return a || null
  return null
}

const KNOWN_LINE_PREFIX = /^(arrive by|uniform|bring both|start time)/i

/** Everything DESCRIPTION can tell us about a game, best-effort. Never
 * throws — a description that doesn't match the usual shape just yields
 * more nulls, and the raw text is preserved separately regardless. */
export function parseGameDescription(description: string, ourTeamHint: string): {
  opponent: string | null
  venue: string | null
  arriveByTime: string | null
  uniform: string | null
} {
  const lines = description.split('\n').map((l) => l.trim()).filter(Boolean)
  const opponent = lines.length > 0 ? parseOpponent(lines[0]!, ourTeamHint) : null

  // `\s*` (not `\s+`) between "by" and the time: PlayMetrics's line-folding
  // sometimes swallows the space that was there in the unfolded original,
  // producing "Arrive by2:30 PM" — tolerate zero-or-more rather than trust
  // fold fidelity.
  const arriveMatch = /Arrive by\s*([\d:]+\s*[AP]M)/i.exec(description)
  const arriveByTime = arriveMatch ? to24h(arriveMatch[1]!) : null

  const uniformMatch = /Uniform:\s*([^\n]+)/i.exec(description)
  const uniform = uniformMatch ? uniformMatch[1]!.trim() : null

  // The venue is whatever's left after dropping the "X at Y (...)" line and
  // any line matching a known field prefix — in every observed example
  // that's exactly the last line, when there is one.
  const rest = lines.slice(1).filter((l) => !KNOWN_LINE_PREFIX.test(l))
  const venue = rest.length > 0 ? rest[rest.length - 1]! : null

  return { opponent, venue, arriveByTime, uniform }
}

// ── the public parser ────────────────────────────────────────────────────────

/**
 * Parse every VEVENT out of a raw .ics feed.
 *
 * `ourTeamHint` is a substring that identifies "us" inside a game's
 * "Team A at Team B" description line (default "U13 Boys" — this team's
 * PlayMetrics name) so the opponent side can be picked out.
 */
export function parseIcs(text: string, ourTeamHint = 'U13 Boys'): IcsEvent[] {
  const lines = unfold(text).split('\n').map((l) => l.trimEnd())

  const events: IcsEvent[] = []
  let current: RawProp[] | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line === 'BEGIN:VEVENT') { current = []; continue }
    if (line === 'END:VEVENT') {
      if (current) {
        const ev = buildEvent(current, ourTeamHint)
        if (ev) events.push(ev)
      }
      current = null
      continue
    }
    if (current && line.length > 0) {
      const prop = parseLine(line)
      if (prop) current.push(prop)
    }
  }
  return events
}

function buildEvent(props: RawProp[], ourTeamHint: string): IcsEvent | null {
  const get = (name: string) => props.find((p) => p.name === name)?.value ?? null

  const uid = get('UID')
  const dtstart = get('DTSTART')
  if (!uid || !dtstart) return null

  const summary = unescapeText(get('SUMMARY') ?? '')
  const descriptionRaw = get('DESCRIPTION')
  const description = descriptionRaw ? unescapeText(descriptionRaw) : null
  const locationRaw = get('LOCATION')
  const location = locationRaw && unescapeText(locationRaw).trim().toUpperCase() !== 'TBD'
    ? unescapeText(locationRaw)
    : null
  const status = get('STATUS')?.trim() || null

  const start = parseDateTimeValue(dtstart)
  const dtend = get('DTEND')
  const end = dtend ? parseDateTimeValue(dtend) : { date: start.date, time: start.time }

  const kind = classify(uid.trim(), summary)

  let opponent: string | null = null
  let venue: string | null = null
  let arriveByTime: string | null = null
  let uniform: string | null = null

  if (description) {
    if (kind === 'game') {
      const parsed = parseGameDescription(description, ourTeamHint)
      opponent = parsed.opponent
      venue = parsed.venue
      arriveByTime = parsed.arriveByTime
      uniform = parsed.uniform
    } else if (kind === 'practice') {
      // Practice descriptions are just the venue, single line.
      venue = description.split('\n').map((l) => l.trim()).find(Boolean) ?? null
    }
  }

  return {
    uid: uid.trim(),
    kind,
    summary,
    description,
    location,
    status,
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    allDay: start.time === null,
    opponent,
    venue,
    arriveByTime,
    uniform,
  }
}
