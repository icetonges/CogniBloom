import { parseIcs, classify } from '@/lib/soccer-ics'

// A trimmed real excerpt of the U13 Boys ECNL-RL PlayMetrics feed (captured
// 2026-09-06), covering every shape the parser has to handle: a non-soccer
// "other" event, a plain practice, a confirmed home/away game with the
// "Arrive by / Uniform / venue" description shape (including PlayMetrics's
// own line-folding, which sometimes swallows a space — see soccer-ics.ts),
// and a TBD-time tournament game.
const FIXTURE = `BEGIN:VCALENDAR
PRODID:-//PlayMetrics//EN
VERSION:2.0
METHOD:PUBLISH
CALSCALE:GREGORIAN
TZID:America/New_York
X-WR-CALNAME:U13 Boys ECNL-RL
BEGIN:VEVENT
UID:GenericCalendarEvent_2359741
DTSTAMP:20260901T173743Z
SEQUENCE:1772825333
DTSTART;TZID=America/New_York:20260506T170000
DTEND;TZID=America/New_York:20260506T210000
SUMMARY:U13 Boys ECNL-RL - BRYC Soccer Chipotle Fundraiser
DESCRIPTION:BRYC Soccer<br>05/06/2026\\, 5:00pm-9:00pm
END:VEVENT
BEGIN:VEVENT
UID:Practice_11242337
DTSTAMP:20260901T173743Z
SEQUENCE:1781713582
DTSTART;TZID=America/New_York:20260625T183000
DTEND;TZID=America/New_York:20260625T200000
SUMMARY:U13 Boys ECNL-RL - Practice
DESCRIPTION:CG Woodson HS Stadium Turf
LOCATION:9525 Main St Fairfax\\, VA 22032
STATUS:CONFIRMED
URL:https://app.playmetrics.com
END:VEVENT
BEGIN:VEVENT
UID:Game_4642216
DTSTAMP:20260901T173743Z
SEQUENCE:1786921788
DTSTART;TZID=America/New_York:20260816T150000
DTEND;TZID=America/New_York:20260816T161000
SUMMARY:U13 Boys ECNL-RL - Game
DESCRIPTION:BRYC U-14 ECNL R at U13 Boys ECNL-RL (Scrimmage)\\nArrive by
 2:30 PM\\nUniform: Gray\\, bring both\\nRobinson HS Stadium
LOCATION:5035 Sideburn Rd Fairfax\\, VA 22032
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:Game_4532825
DTSTAMP:20260901T173743Z
SEQUENCE:1786921789
DTSTART;TZID=America/New_York:20260920T090000
DTEND;TZID=America/New_York:20260920T110000
SUMMARY:U13 Boys ECNL-RL - Game
DESCRIPTION:U13 Boys ECNL-RL at Herndon ECNL RL B2014/13 (ECNL RL (VPSL))\\nArrive by
 8:15 AM\\nUniform: All Royal\\; GKs in All RED\\nBring both kits in case switch needed\\nHerndon High School Stadium
LOCATION:TBD
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:Game_4812990
DTSTAMP:20260901T173743Z
SEQUENCE:1787586513
DTSTART;TZID=America/New_York:20261205
DTEND;TZID=America/New_York:20261205
SUMMARY:U13 Boys ECNL-RL - Game
DESCRIPTION:2026 Celtic Soccer Academy Elite Cup at U13 Boys ECNL-RL (2026
  Celtic Soccer Academy Elite Cup)\\nStart Time TBD\\nUniform: TBD
LOCATION:TBD
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR
`

describe('classify', () => {
  it('reads the UID prefix first', () => {
    expect(classify('Practice_1', 'anything')).toBe('practice')
    expect(classify('Game_1', 'anything')).toBe('game')
  })

  it('falls back to SUMMARY keywords when the UID does not say', () => {
    expect(classify('GenericCalendarEvent_1', 'Team Practice')).toBe('practice')
    expect(classify('GenericCalendarEvent_1', 'Team Game')).toBe('game')
    expect(classify('GenericCalendarEvent_1', 'Fundraiser Night')).toBe('other')
  })
})

describe('parseIcs', () => {
  const events = parseIcs(FIXTURE)
  const byUid = Object.fromEntries(events.map((e) => [e.uid, e]))

  it('parses every VEVENT in the feed', () => {
    expect(events).toHaveLength(5)
  })

  it('classifies the non-soccer event as other and reads its date/time', () => {
    const e = byUid['GenericCalendarEvent_2359741']!
    expect(e.kind).toBe('other')
    expect(e.startDate).toBe('2026-05-06')
    expect(e.startTime).toBe('17:00')
  })

  it('parses a plain practice: venue comes from DESCRIPTION, location is unescaped', () => {
    const e = byUid['Practice_11242337']!
    expect(e.kind).toBe('practice')
    expect(e.startDate).toBe('2026-06-25')
    expect(e.startTime).toBe('18:30')
    expect(e.endTime).toBe('20:00')
    expect(e.allDay).toBe(false)
    expect(e.venue).toBe('CG Woodson HS Stadium Turf')
    expect(e.location).toBe('9525 Main St Fairfax, VA 22032')
  })

  it('parses a confirmed game where we are listed second in "X at Y"', () => {
    const e = byUid['Game_4642216']!
    expect(e.kind).toBe('game')
    expect(e.opponent).toBe('BRYC U-14 ECNL R')
    // Line-folding in the real feed sometimes eats the space before the
    // time ("Arrive by2:30 PM") — the parser must tolerate that.
    expect(e.arriveByTime).toBe('14:30')
    expect(e.uniform).toBe('Gray, bring both')
    expect(e.venue).toBe('Robinson HS Stadium')
  })

  it('parses a game where we are listed first, strips nested parens from the opponent, unescapes ";"', () => {
    const e = byUid['Game_4532825']!
    expect(e.opponent).toBe('Herndon ECNL RL B2014/13')
    expect(e.arriveByTime).toBe('08:15')
    expect(e.uniform).toBe('All Royal; GKs in All RED')
    expect(e.venue).toBe('Herndon High School Stadium')
    // LOCATION: TBD is treated as absent, not a literal address.
    expect(e.location).toBeNull()
  })

  it('treats a bare 8-digit DTSTART (no time-of-day) as all-day / TBD', () => {
    const e = byUid['Game_4812990']!
    expect(e.allDay).toBe(true)
    expect(e.startDate).toBe('2026-12-05')
    expect(e.startTime).toBeNull()
    // Only "Start Time TBD" / "Uniform: TBD" lines remain after the first
    // line, and both are filtered as known fields — nothing left to be a venue.
    expect(e.venue).toBeNull()
  })
})
