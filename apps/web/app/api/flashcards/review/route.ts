import { NextRequest, NextResponse, after } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { sm2 } from '@/lib/flashcards'
import { awardXP, XP } from '@/lib/gamification'

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

    const { newInterval, newEaseFactor, newRepetitions, nextReviewAt } = sm2({
      rating: body.rating,
      repetitions: card.repetitions,
      easeFactor: card.easeFactor,
      interval: card.interval,
    })

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

    // Award XP per card reviewed
    after(() => awardXP(userId, XP.FLASHCARD_REVIEWED))

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
