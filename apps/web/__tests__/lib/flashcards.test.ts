import { sm2 } from '@/lib/flashcards'

// Initial ease factor used by the SM-2 spec
const DEFAULT_EF = 2.5

describe('sm2 — new card (0 repetitions)', () => {
  it('first correct answer sets interval=1 and increments repetitions to 1', () => {
    const result = sm2({ rating: 4, repetitions: 0, easeFactor: DEFAULT_EF, interval: 0 })
    expect(result.newRepetitions).toBe(1)
    expect(result.newInterval).toBe(1)
  })

  it('second correct answer sets interval=6 (repetitions becomes 2)', () => {
    const result = sm2({ rating: 4, repetitions: 1, easeFactor: DEFAULT_EF, interval: 1 })
    expect(result.newRepetitions).toBe(2)
    expect(result.newInterval).toBe(6)
  })

  it('third correct answer scales interval by easeFactor', () => {
    const result = sm2({ rating: 4, repetitions: 2, easeFactor: DEFAULT_EF, interval: 6 })
    expect(result.newRepetitions).toBe(3)
    expect(result.newInterval).toBe(Math.round(6 * result.newEaseFactor))
  })
})

describe('sm2 — failure (rating < 3)', () => {
  it('rating 0 resets interval to 1 and repetitions to 0', () => {
    const result = sm2({ rating: 0, repetitions: 5, easeFactor: DEFAULT_EF, interval: 20 })
    expect(result.newInterval).toBe(1)
    expect(result.newRepetitions).toBe(0)
  })

  it('rating 1 resets interval to 1 and repetitions to 0', () => {
    const result = sm2({ rating: 1, repetitions: 3, easeFactor: DEFAULT_EF, interval: 10 })
    expect(result.newInterval).toBe(1)
    expect(result.newRepetitions).toBe(0)
  })

  it('rating 2 resets interval to 1 and repetitions to 0', () => {
    const result = sm2({ rating: 2, repetitions: 2, easeFactor: DEFAULT_EF, interval: 6 })
    expect(result.newInterval).toBe(1)
    expect(result.newRepetitions).toBe(0)
  })
})

describe('sm2 — ease factor updates', () => {
  it('perfect rating (5) increases ease factor', () => {
    const result = sm2({ rating: 5, repetitions: 2, easeFactor: DEFAULT_EF, interval: 6 })
    expect(result.newEaseFactor).toBeGreaterThan(DEFAULT_EF)
  })

  it('poor rating (3) decreases ease factor', () => {
    const result = sm2({ rating: 3, repetitions: 2, easeFactor: DEFAULT_EF, interval: 6 })
    expect(result.newEaseFactor).toBeLessThan(DEFAULT_EF)
  })

  it('ease factor never drops below 1.3', () => {
    // 5 consecutive failures from default EF should floor at 1.3
    let ef = DEFAULT_EF
    for (let i = 0; i < 10; i++) {
      const res = sm2({ rating: 0, repetitions: 0, easeFactor: ef, interval: 1 })
      ef = res.newEaseFactor
    }
    expect(ef).toBeGreaterThanOrEqual(1.3)
  })
})

describe('sm2 — nextReviewAt', () => {
  it('schedules nextReviewAt in the future', () => {
    const before = new Date()
    const result = sm2({ rating: 4, repetitions: 0, easeFactor: DEFAULT_EF, interval: 0 })
    expect(result.nextReviewAt.getTime()).toBeGreaterThan(before.getTime())
  })

  it('nextReviewAt is newInterval days from today', () => {
    const result = sm2({ rating: 5, repetitions: 2, easeFactor: DEFAULT_EF, interval: 6 })
    const expected = new Date()
    expected.setDate(expected.getDate() + result.newInterval)
    // Allow 1 second tolerance for test execution time
    expect(Math.abs(result.nextReviewAt.getTime() - expected.getTime())).toBeLessThan(1000)
  })
})

describe('sm2 — boundary: rating exactly 3', () => {
  it('rating 3 is treated as a pass (repetitions increments)', () => {
    const result = sm2({ rating: 3, repetitions: 1, easeFactor: DEFAULT_EF, interval: 1 })
    expect(result.newRepetitions).toBe(2)
    expect(result.newInterval).toBe(6)
  })
})
