/**
 * Soccer — BRYC Academy, 2026-27.
 *
 * Everything here is either taken verbatim from the team meeting (coach's own
 * words for the expectations) or from published records for the coach's
 * background. Nothing about his personality is asserted: there is no reliable
 * public parent-review material, and inventing a reputation would be worse
 * than leaving the gap visible.
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Practice {
  /** 0 = Sunday. */
  weekday: Weekday
  /** "HH:mm" — when the session itself starts. */
  start: string
  /** Coach's rule: on the field 15 minutes before practice. */
  arriveBy: string
  venue: string
  /** Rough door-to-door drive, for the leave-home reminder. */
  travelMinutes: number
  minutes: number
}

/** Coach's timing rule, stated at the meeting. */
export const EARLY_PRACTICE_MIN = 15
export const EARLY_MATCH_MIN = 45

export const PRACTICES: readonly Practice[] = [
  { weekday: 1, start: '17:45', arriveBy: '17:30', venue: 'Woodson HS — Aux Field', travelMinutes: 20, minutes: 90 },
  { weekday: 2, start: '19:00', arriveBy: '18:45', venue: 'GMU RAC Field',           travelMinutes: 25, minutes: 90 },
  { weekday: 4, start: '17:45', arriveBy: '17:30', venue: 'Woodson HS — Aux Field', travelMinutes: 20, minutes: 90 },
]

export const COACH = {
  name: 'Todd West',
  role: 'Boys ECNL Director · Head Coach, U13 ECRL (BRYC Academy)',
  alsoListedAs: 'U15 Boys ECNL head coach, Fairfax VA Union 2026-27',
  phone: '202-531-0148',
  /** He asked for text, not calls. */
  contact: 'Text only — direct contact by text message',
  bioNote: 'Background and experience: PlayMetrics → My Team → Summary → Roster → Coach’s link',
  /** Published, checkable record — no personality claims. */
  credentials: [
    'Head coach, American University men’s soccer, 19 seasons (164-142-47)',
    'Four-time Patriot League Coach of the Year · two Patriot League titles',
    'Three NCAA Tournament appearances, including a Sweet 16',
    'Assistant coach, U.S. U-20 National Team',
    'Assistant coach, D.C. United',
    'U.S. Region I and Virginia ODP coach — teams to Germany, Italy, Spain, Portugal, France',
    'Head coach, Lake Braddock Secondary School 1993-96 (47-13-6); 1995 district, Northern Region and Virginia state champions',
    'USSF National “A” License · George Mason graduate and four-year starter',
  ],
  /** What is genuinely unknown, said plainly. */
  unknown: 'There is no reliable public parent or player review of his current BRYC coaching. Expect high standards and detailed correction — that is what a career at this level suggests — but judge the rest from how he actually works with you.',
} as const

/** The coach's own stated objectives, from the team meeting. */
export const COACHING_STYLE = [
  'Drive understanding of the game — set expectations and hold players to them',
  'Instill a passion for soccer',
  'Respectful treatment and discipline; group coaching',
  'Technique, technique, technique — 1000 touches a day',
  'A team that thinks, passes, works hard, and takes the right risk at the right time',
  'Challenge and learning above wins — though winning is the goal',
  'We build out of the back, and through the centre',
  'Tactical play in every formation and every position',
  'Style of play over winning: pass the ball, keep it on the ground, build out of the back',
  'Building young men — work, respect',
] as const

export const PLAYER_RULES = [
  { rule: '1000 touches a day', why: 'The single thing Coach repeated most. It is the price of admission at this level.' },
  { rule: 'EFFORT', why: 'The one thing that is entirely in your control, every single session.' },
  { rule: 'Always be prepared', why: 'The right kit — both kits at every match — in the right place at the right time.' },
  { rule: 'Be EARLY, not on time', why: '15 minutes before practice, 45 minutes before a game. Coaches are there 15 minutes before that.' },
  { rule: 'One ball — practice, games, home', why: 'The same ball you train with at home is the one that comes to the field.' },
  { rule: 'Referees are OFF LIMITS', why: 'No exceptions, no comments, no faces. Not yours, not your parents’.' },
] as const

export const PARENT_RULES = [
  'Let the players be responsible and make mistakes — that is how they learn',
  'Understand the objective: build young men, develop them as players',
  'No coaching from the sideline — let the coaches drive style and tactics',
  'Praise effort, not results. The results will come',
  'After a game, let him cool off. Talk shop once he brings it up',
  'Referees are OFF LIMITS',
  'Drive preparation — remind him, but the player is responsible',
] as const

/** Post-summer testing, as announced. */
export const TESTS = [
  {
    id: 'juggle',
    name: 'Juggling — 100 with alternating feet',
    target: 100,
    unit: 'touches',
    how: 'Left, right, left, right. A drop resets the count. Little touches, waist height, over the standing foot.',
  },
  {
    id: 'ladder',
    name: 'Conditioning — full-field ladder',
    target: 0,
    unit: 'seconds',
    how: 'From the back line out to each 10-yard line and back, all the way up the field. Record your best time and try to beat it.',
  },
] as const

/**
 * What a coach with this background actually watches, ordered by how quickly he
 * will see it. Tier 3 is the one a 12-year-old can control from day one.
 */
export const WHAT_COACH_NOTICES = [
  {
    tier: 'Seen in the first ten minutes',
    accent: '#f59e0b',
    items: [
      'First touch — especially receiving under pressure',
      'Passing weight and accuracy',
      'How fast you can play once the ball arrives',
      'Acceleration and change of direction',
      'Whether you compete for a ball you might lose',
    ],
  },
  {
    tier: 'Seen over several sessions',
    accent: '#38bdf8',
    items: [
      'Scanning — do you look before the ball comes',
      'Body shape when you receive',
      'Knowing when to pass and when to carry',
      'Movement when you do not have the ball',
      'Defensive positioning and recovery runs',
    ],
  },
  {
    tier: 'What actually decides it',
    accent: '#34d399',
    items: [
      'Do you listen the first time',
      'Do you try the correction immediately',
      'Do you recover after a mistake, or sulk',
      'Do you work when nobody is watching',
      'Do you stay switched on when the play is somewhere else',
      'Do your teammates play better with you on the field',
    ],
  },
] as const

/** Five instructions, and nothing else, before a session. */
export const BEFORE_PRACTICE = [
  { n: 1, do: 'Arrive early', note: '15 minutes, boots on, ball out.' },
  { n: 2, do: 'Listen', note: 'When Coach talks, the ball stops and so do you.' },
  { n: 3, do: 'Play simple', note: 'Receive → scan → pass → move. Not: receive → beat three → lose it.' },
  { n: 4, do: 'Defend hard', note: 'Working without the ball is the fastest way to get noticed.' },
  { n: 5, do: 'Take the correction', note: '“Yes, Coach” — then actually do it on the very next rep.' },
] as const

export const MANTRAS = [
  'Correction is not criticism. It means he is watching you.',
  '1000 touches. Nobody can do them for you.',
  'Next play. The last one is finished.',
  'Be early. Being on time is being late.',
  'Play the simple pass brilliantly and the hard pass becomes available.',
  'Work when nobody is watching — that is the part that shows up in a game.',
  'You are not there to impress anyone. You are there to learn.',
  'If someone is better than you, watch what he does.',
  'Keep it on the ground. Build out of the back.',
  'Effort is the one thing that never needs talent.',
  'Scan before it comes, not after.',
  'The referee is never your problem.',
] as const

/** The question worth asking after three to five sessions — and the ones not to. */
export const THE_QUESTION = {
  ask: 'Coach Todd, thank you for the chance to train with the group. From what you have seen, what are the two or three things I should work on most to be a stronger player at this level?',
  dontAsk: ['Am I good enough?', 'Will I make the team?', 'How much will I play?'],
  why: 'A specific answer — “scan earlier before you receive”, “first touch under pressure” — is worth more than the invitation itself. “Work harder” is not an answer; ask when and where.',
} as const

export const KIT_CHECK = [
  'Both kits (every match)',
  'Shin guards',
  'Boots + trainers',
  'The same ball — practice, games, home',
  'Full water bottle',
  'Weather layer',
] as const

/** Daily touch goal — the number Coach kept repeating. */
export const TOUCH_GOAL = 1000

// ── helpers ─────────────────────────────────────────────────────────────────

export function practiceOn(weekday: number): Practice | undefined {
  return PRACTICES.find((p) => p.weekday === weekday)
}

/** "HH:mm" minus n minutes, clamped to the same day. */
export function minus(time: string, mins: number): string {
  const [h = '0', m = '0'] = time.split(':')
  const t = Math.max(0, Number(h) * 60 + Number(m) - mins)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** "HH:mm" plus n minutes. */
export function plus(time: string, mins: number): string {
  const [h = '0', m = '0'] = time.split(':')
  const t = Number(h) * 60 + Number(m) + mins
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Deterministic mantra for a date — same one all day, different tomorrow. */
export function mantraFor(dateKey: string): string {
  let h = 0
  for (let i = 0; i < dateKey.length; i += 1) h = (h * 31 + dateKey.charCodeAt(i)) | 0
  return MANTRAS[Math.abs(h) % MANTRAS.length] ?? MANTRAS[0]
}
