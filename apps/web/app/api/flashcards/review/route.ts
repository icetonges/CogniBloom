import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'

/**
 * SM-2 Spaced Repetition Algorithm
 * rating: 0=complete blackout, 1=wrong but familiar, 2=wrong easy, 3=correct with difficulty, 4=correct, 5=perfect
 * Returns { newInterval, newEaseFactor }
 */
function sm2(rating: number, repetitions: number, easeFactor: number, interval: number) {
  let newEaseFactor = easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
  if (newEaseFactor < 1.3) newEaseFactor = 1.3

  let newInterval: number
  let newRepetitions: number

  if (rating < 3) {
    // Fail — reset
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

// POST /api/flashcards/review — record a review result
export async function POST(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const body = await request.json() as { flashcardId: string; rating: number }

    if (!body.flashcardId || body.rating === undefined) {
      return NextResponse.json({ error: 'flashcardId and rating required' }, { status: 400 })
    }
    if (body.rating < 0 || body.rating > 5) {
      return NextResponse.json({ error: 'rating must be 0-5' }, { status: 400 })
    }

    const card = await db.flashcard.findFirst({ where: { id: body.flashcardId, userId } })
    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

    const { newInterval, newEaseFactor, newRepetitions, nextReviewAt } = sm2(
      body.rating,
      card.repetitions,
      card.easeFactor,
      card.interval
    )

    const isCorrect = body.rating >= 3

    // Record review & update card in parallel
    const [, updated] = await Promise.all([
      db.flashcardReview.create({
        data: {
          flashcardId: card.id,
          rating: body.rating,
          previousInterval: card.interval,
          previousEaseFactor: card.easeFactor,
          newInterval,
          newEaseFactor,
        },
      }),
      db.flashcard.update({
        where: { id: card.id },
        data: {
          easeFactor: newEaseFactor,
          interval: newInterval,
          repetitions: newRepetitions,
          nextReviewAt,
          totalReviews: { increment: 1 },
          correctReviews: { increment: isCorrect ? 1 : 0 },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        nextReviewAt: updated.nextReviewAt,
        newInterval,
        newEaseFactor: Math.round(newEaseFactor * 100) / 100,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
