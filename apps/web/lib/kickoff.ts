// Daily kickoff — the friendly card Daniel sees when he opens CogniBloom.
// A greeting, a planner nudge based on what his planner actually looks like
// today, and a daily joke or encouraging line. Everything here is pure, so
// the copy and the picking logic are unit tested.
//
// Tone: a supportive older teammate. Short, warm, a little funny, never
// preachy or guilt-trippy. No sarcasm about his effort.

export interface Joke { kind: 'joke'; setup: string; punchline: string }
export interface Spark { kind: 'spark'; text: string }
export type Pick = Joke | Spark

export const JOKES: Omit<Joke, 'kind'>[] = [
  { setup: 'How do you organize a space party?', punchline: 'You planet. (Kind of like your planner.)' },
  { setup: "What's a calendar's favorite snack?", punchline: 'Dates.' },
  { setup: 'Why did the clock get detention?', punchline: 'It tocked too much.' },
  { setup: 'Why was the equal sign so humble?', punchline: "It knew it wasn't less than or greater than anyone." },
  { setup: 'Why did the soccer player bring string to the game?', punchline: 'So he could tie the score.' },
  { setup: 'Why is a soccer stadium always cool?', punchline: "It's full of fans." },
  { setup: 'Where do soccer players go dancing?', punchline: 'A foot-ball.' },
  { setup: 'Why did the soccer ball quit the team?', punchline: 'It was tired of being kicked around.' },
  { setup: "Why can't you trust atoms?", punchline: 'They make up everything.' },
  { setup: 'Why did the photon skip the bag check at the hotel?', punchline: 'It was traveling light.' },
  { setup: 'What did the sound wave say to the light wave?', punchline: '"Wait up! Some of us need air."' },
  { setup: "I'd tell you a chemistry joke...", punchline: "...but I know I wouldn't get a reaction." },
  { setup: 'What did the triangle say to the circle?', punchline: "You're pointless." },
  { setup: 'Parallel lines have so much in common.', punchline: "It's a shame they'll never meet." },
  { setup: 'Why was the math book sad?', punchline: 'It had too many problems.' },
  { setup: 'How do you make seven even?', punchline: 'Take away the s.' },
  { setup: 'What did zero say to eight?', punchline: 'Nice belt.' },
  { setup: 'Why did the geometry teacher go to the beach?', punchline: 'To catch some rays.' },
  { setup: 'Why do programmers mix up Halloween and Christmas?', punchline: 'Because Oct 31 = Dec 25. (Octal 31 is decimal 25.)' },
  { setup: 'Why do Python programmers wear glasses?', punchline: "Because they can't C." },
  { setup: 'Why was the computer cold?', punchline: 'It left its Windows open.' },
  { setup: "What's an astronaut's favorite key on the keyboard?", punchline: 'The space bar.' },
  { setup: 'Why did the cell phone wear glasses?', punchline: 'It lost its contacts.' },
  { setup: "What's the best way to watch a fishing tournament?", punchline: 'Live stream.' },
  { setup: 'Why are fish so smart?', punchline: 'They live in schools.' },
  { setup: 'Why did the student bring a ladder to class?', punchline: 'Middle school was going well, so he was ready for high school.' },
  { setup: 'Why did the scarecrow win an award?', punchline: 'He was outstanding in his field.' },
  { setup: 'Why did the bicycle fall over?', punchline: 'It was two tired.' },
  { setup: "Why don't skeletons fight each other?", punchline: "They don't have the guts." },
  { setup: 'What do you call a bear with no teeth?', punchline: 'A gummy bear.' },
  { setup: 'Why did the tomato blush?', punchline: 'It saw the salad dressing.' },
  { setup: 'My planner and I have a lot in common.', punchline: 'We both work better when I actually open it.' },
  { setup: "What's a goalkeeper's favorite part of a math test?", punchline: 'The saves. (Show your work and save the points.)' },
  { setup: 'Why did the fraction go to therapy?', punchline: 'It felt divided.' },
  { setup: 'What runs but never walks, and has a mouth but never talks?', punchline: 'A river.' },
  { setup: 'Why did the student eat his homework?', punchline: 'The teacher said it was a piece of cake.' },
]

export const SPARKS: string[] = [
  'Nobody scores from the bench. Small reps today count.',
  'Confused is not stuck. Confused means your brain is moving furniture to make room.',
  "You don't have to feel ready. You just have to start the first five minutes.",
  'Pros have a routine that works even on days they feel lazy. That is the whole secret.',
  'Every expert was once a beginner who kept showing up.',
  'A wrong answer you understand beats a right answer you guessed.',
  'Plan the day, or the day plans you.',
  '1% better every day is about 37 times better in a year. (1.01^365 ≈ 37.8. Check it.)',
  'Hard practice, easy game.',
  'Your future self is watching what you do at 4 PM. Make them proud.',
  'Asking a question is a power move, not a weakness.',
  'Mistakes are just data. Collect them, then fix them.',
  'Focus is a muscle. Twenty minutes today trains it for tomorrow.',
  "Don't just count the touches. Make the touches count.",
  'The homework you start now is the free time you get later.',
  'Champions are built in the boring reps nobody films.',
  "You can't control the ref. You can always control your effort.",
  'Small wins stack. Go stack one.',
  'Curiosity is your cheat code.',
  "It's okay to be slow. Just don't stop.",
  'A goal without a plan is just a wish with good vibes.',
  "If it's in your planner, it's a plan. If it's only in your head, it's a maybe.",
  "Be the teammate you'd want to pass to.",
  'The best time to fix a weak spot is before the test finds it.',
  "Today's effort is tomorrow's confidence.",
  "You've done hard things before. This is just the next one.",
  'Rest is part of training, not the opposite of it.',
  'Read the problem twice. Rushing is the most expensive shortcut.',
  'Progress, not perfect.',
  'Every question you ask today is one less surprise on the test.',
  'Your brain grows the most right at the edge of "I don\'t get it yet."',
  'Add one word to "I can\'t do this": yet.',
]

/** Day number in the student's time zone (Eastern), stable for the whole day. */
export function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/** Picks per day: joke, then spark, then joke. Kept small so it stays a moment, not a feed. */
export const PICKS_PER_DAY = 3
const SEQUENCE: Pick['kind'][] = ['joke', 'spark', 'joke']

/**
 * The day's `step`-th pick (0, 1 or 2): joke, spark, joke. Two jokes and one
 * spark a day, striding through each list so consecutive days don't feel
 * related; every item comes around before any repeats (strides are coprime
 * with the list lengths, asserted in tests). Steps past the last wrap to it.
 */
export function pickOfTheDay(dateKey: string, step = 0): Pick {
  const day = dayNumber(dateKey)
  const i = Math.min(Math.max(0, step), PICKS_PER_DAY - 1)
  if (SEQUENCE[i] === 'spark') return { kind: 'spark', text: SPARKS[mod(day * 5, SPARKS.length)] }
  const nth = i === 0 ? 0 : 1 // which of today's two jokes
  const j = JOKES[mod((day * 2 + nth) * 7, JOKES.length)]
  return { kind: 'joke', ...j }
}

const mod = (a: number, n: number) => ((a % n) + n) % n

export interface PlannerToday {
  /** Day items he can tick (school periods excluded). */
  total: number
  done: number
  /** He ticked or edited something today, or added his own entry. */
  updatedToday: boolean
  soccer: 'game' | 'practice' | null
}

export interface Kickoff {
  greeting: string
  nudge: string
  /** True when the planner still needs him today. */
  needsUpdate: boolean
  pick: Pick
}

/** Eastern wall-clock hour and weekday (0 = Sunday). */
export interface LocalTime { hour: number; weekday: number }

export function greetingFor(name: string, t: LocalTime): string {
  const n = name || 'there'
  if (t.hour >= 22 || t.hour < 5) return `Still up, ${n}? 🦉`
  if (t.hour < 12) {
    if (t.weekday === 1) return `Morning, ${n}! Fresh week, fresh start. ☀️`
    return `Morning, ${n}! ☀️`
  }
  if (t.hour < 17) {
    if (t.weekday === 5) return `Hey ${n}, it's Friday! Finish strong. 🙌`
    if (t.weekday === 0 || t.weekday === 6) return `Hey ${n}, happy weekend! 😎`
    return `Hey ${n}, welcome back! 👋`
  }
  return `Evening, ${n}! 🌙`
}

export function nudgeFor(p: PlannerToday, t: LocalTime): string {
  const weekend = t.weekday === 0 || t.weekday === 6
  const late = t.hour >= 22 || t.hour < 5
  const pending = Math.max(0, p.total - p.done)

  if (p.total > 0 && pending === 0) return 'Everything on today\'s planner is checked off. Absolute legend. 🏆'

  let base: string
  if (late) {
    base = p.updatedToday
      ? `Quick final check: tick off what you finished, then sleep. Your brain saves today's learning while you sleep. 💤`
      : `Before bed, give your planner 60 seconds: tick what you did, add anything due tomorrow. Then sleep. 💤`
  } else if (p.updatedToday) {
    base = `${p.done} of ${p.total} done. Nice pace 💪 Keep ticking them off as you go.`
  } else if (p.total === 0) {
    base = weekend
      ? 'Weekend planner is empty. Add one fun thing and one thing you want to get better at.'
      : "Your planner is empty for today. Add your homework and one thing you want to level up."
  } else if (p.done > 0) {
    base = `${p.done} of ${p.total} already done. Take a minute to update the rest.`
  } else {
    base = weekend
      ? `Your planner has ${p.total} thing${p.total === 1 ? '' : 's'} for today. Weekend mode: knock one out early, then enjoy the rest.`
      : `Your planner has ${p.total} thing${p.total === 1 ? '' : 's'} lined up today. Give it 2 minutes: tick off what's done, add anything new.`
  }

  if (!late && p.soccer === 'game') return `${base} Game day! ⚽ Plan homework around it and pack your bag early.`
  if (!late && p.soccer === 'practice') return `${base} Practice today ⚽, so get homework in first.`
  return base
}

export function buildKickoff(opts: { name: string; dateKey: string; time: LocalTime; planner: PlannerToday }): Kickoff {
  const { planner } = opts
  const allDone = planner.total > 0 && planner.done >= planner.total
  return {
    greeting: greetingFor(opts.name, opts.time),
    nudge: nudgeFor(planner, opts.time),
    needsUpdate: !planner.updatedToday && !allDone,
    pick: pickOfTheDay(opts.dateKey, 0),
  }
}

/** Planner rows the app writes from calendars; they don't count as his updates. */
export function isAutoRow(tags: string[]): boolean {
  return tags.includes('locked')
}

/**
 * Summarize today's day-scope planner rows. School periods are not things he
 * ticks, so they're left out of the counts. "Updated" means he ticked
 * something today, or created/edited one of his own (non-calendar) rows today.
 */
export function summarizePlanner(
  rows: { tags: string[]; status: string; completedAt: Date | null; createdAt: Date; updatedAt: Date }[],
  startOfToday: Date,
): PlannerToday {
  // School periods aren't ticked; '__meta__' / '__ladder__' rows are the planner's own bookkeeping
  // (day notes, goal ladder) and count as an update when he edits them, but not as to-dos.
  const tickable = rows.filter((r) => !r.tags.includes('school') && !r.tags.some((t) => t.startsWith('__')))
  const done = tickable.filter((r) => r.status === 'done').length
  const updatedToday = rows.some((r) =>
    (r.completedAt !== null && r.completedAt >= startOfToday) ||
    (!isAutoRow(r.tags) && !r.tags.includes('routine') && r.createdAt >= startOfToday) ||
    // Routine rows get re-timed by the seeder, so only a tick counts for them.
    (!isAutoRow(r.tags) && !r.tags.includes('routine') && r.updatedAt >= startOfToday && r.updatedAt.getTime() - r.createdAt.getTime() > 1000),
  )
  const soccerRows = rows.filter((r) => r.tags.includes('soccer') && isAutoRow(r.tags) && !r.tags.includes('routine'))
  const soccer = soccerRows.some((r) => r.tags.includes('game')) ? 'game'
    : soccerRows.some((r) => r.tags.includes('practice')) ? 'practice' : null
  return { total: tickable.length, done, updatedToday, soccer }
}
