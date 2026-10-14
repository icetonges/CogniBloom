import {
  JOKES, SPARKS, PICKS_PER_DAY, pickOfTheDay, greetingFor, nudgeFor, buildKickoff, summarizePlanner,
} from '@/lib/kickoff'

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

describe('daily pick', () => {
  it('is stable for a day and changes the next day', () => {
    expect(pickOfTheDay('2026-10-14')).toEqual(pickOfTheDay('2026-10-14'))
    expect(pickOfTheDay('2026-10-14')).not.toEqual(pickOfTheDay('2026-10-15'))
  })

  it('goes joke, spark, joke, and stops at three', () => {
    const d = '2026-10-14'
    expect([0, 1, 2].map((i) => pickOfTheDay(d, i).kind)).toEqual(['joke', 'spark', 'joke'])
    expect(PICKS_PER_DAY).toBe(3)
    const a = pickOfTheDay(d, 0), c = pickOfTheDay(d, 2)
    expect(a.kind === 'joke' && c.kind === 'joke' && a.setup !== c.setup).toBe(true)
    expect(pickOfTheDay(d, 7)).toEqual(c) // past the last step stays on it
  })

  it('cycles through every joke and spark across days before repeating', () => {
    // Strides must be coprime with the list lengths for a full cycle.
    expect(gcd(7, JOKES.length)).toBe(1)
    expect(gcd(5, SPARKS.length)).toBe(1)
    const jokes = new Set<string>(), sparks = new Set<string>()
    const start = Date.UTC(2026, 9, 14)
    for (let day = 0; day < Math.max(JOKES.length, SPARKS.length); day++) {
      const key = new Date(start + day * 86_400_000).toISOString().slice(0, 10)
      for (let i = 0; i < 3; i++) {
        const p = pickOfTheDay(key, i)
        if (p.kind === 'joke') jokes.add(p.setup); else sparks.add(p.text)
      }
    }
    expect(jokes.size).toBe(JOKES.length)
    expect(sparks.size).toBe(SPARKS.length)
  })

  it('keeps the copy short and free of em dashes', () => {
    for (const j of JOKES) {
      expect(j.setup.length + j.punchline.length).toBeLessThan(140)
      expect(j.setup + j.punchline).not.toMatch(/—/)
    }
    for (const s of SPARKS) {
      expect(s.length).toBeLessThan(120)
      expect(s).not.toMatch(/—/)
    }
  })
})

describe('greeting and nudge', () => {
  const tue = (hour: number) => ({ hour, weekday: 2 })

  it('greets by time of day and weekday', () => {
    expect(greetingFor('Daniel', tue(8))).toMatch(/^Morning, Daniel/)
    expect(greetingFor('Daniel', { hour: 8, weekday: 1 })).toMatch(/Fresh week/)
    expect(greetingFor('Daniel', { hour: 15, weekday: 5 })).toMatch(/Friday/)
    expect(greetingFor('Daniel', tue(15))).toMatch(/welcome back/)
    expect(greetingFor('Daniel', tue(19))).toMatch(/^Evening/)
    expect(greetingFor('Daniel', tue(23))).toMatch(/Still up/)
  })

  it('nudges based on the planner', () => {
    expect(nudgeFor({ total: 6, done: 0, updatedToday: false, soccer: null }, tue(16))).toMatch(/6 things lined up/)
    expect(nudgeFor({ total: 6, done: 2, updatedToday: true, soccer: null }, tue(16))).toMatch(/2 of 6 done/)
    expect(nudgeFor({ total: 6, done: 6, updatedToday: true, soccer: null }, tue(16))).toMatch(/legend/)
    expect(nudgeFor({ total: 0, done: 0, updatedToday: false, soccer: null }, tue(16))).toMatch(/empty/)
    expect(nudgeFor({ total: 4, done: 0, updatedToday: false, soccer: 'practice' }, tue(16))).toMatch(/Practice today/)
    expect(nudgeFor({ total: 4, done: 0, updatedToday: false, soccer: 'game' }, { hour: 9, weekday: 6 })).toMatch(/Game day/)
    expect(nudgeFor({ total: 4, done: 1, updatedToday: true, soccer: 'practice' }, tue(23))).toMatch(/sleep/)
  })

  it('says whether the planner still needs him', () => {
    const base = { name: 'Daniel', dateKey: '2026-10-14', time: tue(16) }
    expect(buildKickoff({ ...base, planner: { total: 5, done: 0, updatedToday: false, soccer: null } }).needsUpdate).toBe(true)
    expect(buildKickoff({ ...base, planner: { total: 5, done: 1, updatedToday: true, soccer: null } }).needsUpdate).toBe(false)
    expect(buildKickoff({ ...base, planner: { total: 5, done: 5, updatedToday: false, soccer: null } }).needsUpdate).toBe(false)
  })
})

describe('summarizePlanner', () => {
  const today = new Date('2026-10-14T04:00:00Z') // Eastern midnight
  const yesterday = new Date('2026-10-13T12:00:00Z')
  const row = (over: Partial<Parameters<typeof summarizePlanner>[0][number]>) => ({
    tags: [] as string[], status: 'pending', completedAt: null, createdAt: yesterday, updatedAt: yesterday, ...over,
  })

  it('does not count calendar rows rewritten today as his update', () => {
    const s = summarizePlanner([
      row({ tags: ['school', 'locked'], createdAt: today, updatedAt: today }),
      row({ tags: ['soccer', 'locked', 'practice'], createdAt: today, updatedAt: new Date(today.getTime() + 60_000) }),
      row({ tags: ['routine', 'routine-v3'], createdAt: today, updatedAt: new Date(today.getTime() + 60_000) }),
    ], today)
    expect(s.updatedToday).toBe(false)
    expect(s.total).toBe(2) // school period excluded
    expect(s.soccer).toBe('practice')
  })

  it('counts a tick, a new entry, or an edit to his own entry', () => {
    expect(summarizePlanner([row({ tags: ['routine'], status: 'done', completedAt: new Date(today.getTime() + 1) })], today).updatedToday).toBe(true)
    expect(summarizePlanner([row({ createdAt: today, updatedAt: today })], today).updatedToday).toBe(true)
    expect(summarizePlanner([row({ updatedAt: new Date(today.getTime() + 5000) })], today).updatedToday).toBe(true)
    expect(summarizePlanner([row({ status: 'done', completedAt: yesterday })], today).updatedToday).toBe(false)
  })

  it('leaves bookkeeping rows out of the to-do count but counts editing them', () => {
    const s = summarizePlanner([row({ tags: ['__meta__'], createdAt: today, updatedAt: today }), row({})], today)
    expect(s.total).toBe(1)
    expect(s.updatedToday).toBe(true)
  })

  it('ignores routine habits tagged soccer when spotting practice', () => {
    const s = summarizePlanner([row({ tags: ['routine', 'soccer'] })], today)
    expect(s.soccer).toBeNull()
  })
})
