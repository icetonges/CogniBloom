/**
 * SM-2 Spaced Repetition Algorithm
 *
 * rating: 0 = complete blackout
 *         1 = wrong but familiar
 *         2 = wrong (easy recall failed)
 *         3 = correct with difficulty
 *         4 = correct
 *         5 = perfect
 */
export interface SM2Input {
  rating: number
  repetitions: number
  easeFactor: number
  interval: number
}

export interface SM2Result {
  newInterval: number
  newEaseFactor: number
  newRepetitions: number
  nextReviewAt: Date
}

export function sm2(input: SM2Input): SM2Result {
  const { rating, repetitions, easeFactor, interval } = input

  // Update ease factor — clamp at 1.3 minimum
  let newEaseFactor =
    easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
  if (newEaseFactor < 1.3) newEaseFactor = 1.3

  let newInterval: number
  let newRepetitions: number

  if (rating < 3) {
    // Fail — reset to beginning
    newInterval = 1
    newRepetitions = 0
  } else {
    newRepetitions = repetitions + 1
    if (newRepetitions === 1) {
      newInterval = 1
    } else if (newRepetitions === 2) {
      newInterval = 6
    } else {
      newInterval = Math.round(interval * newEaseFactor)
    }
  }

  const nextReviewAt = new Date()
  nextReviewAt.setDate(nextReviewAt.getDate() + newInterval)

  return { newInterval, newEaseFactor, newRepetitions, nextReviewAt }
}
