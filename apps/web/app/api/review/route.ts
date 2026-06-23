import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { sm2 } from '@/lib/flashcards'
import { easternMidnight, toEasternDateString } from '@/lib/timezone'

export const dynamic = 'force-dynamic'

const SESSION_CAP = 30 // max notes surfaced in one daily review session

// GET /api/review — the daily review queue + retention stats.
//   Returns notes that are due for active recall (never reviewed, or whose
//   SM-2 nextReviewAt has passed), oldest-first, plus aggregate stats.
export async function GET(_request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const now = new Date()

    const notes = await db.note.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        subject: true,
        tags: true,
        content: true,
        createdAt: true,
        recallState: {
          select: {
            interval: true,
            repetitions: true,
            easeFactor: true,
            nextReviewAt: true,
            lastReviewedAt: true,
            totalReviews: true,
            correctReviews: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const due = notes
      .filter((n) => !n.recallState || n.recallState.nextReviewAt <= now)
      .map((n) => {
        const s = n.recallState
        // Plain-text preview for the "prompt" (active recall cue) without
        // revealing the full answer.
        const plain = n.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        return {
          noteId: n.id,
          title: n.title,
          subject: n.subject,
          tags: n.tags,
          content: n.content,
          preview: plain.slice(0, 160),
          isNew: !s,
          interval: s?.interval ?? 0,
          repetitions: s?.repetitions ?? 0,
          nextReviewAt: s?.nextReviewAt ?? null,
        }
      })

    // Sort: never-reviewed first (build the schedule), then most-overdue first.
    due.sort((a, b) => {
      if (a.isNew !== b.isNew) return a.isNew ? -1 : 1
      const at = a.nextReviewAt ? new Date(a.nextReviewAt).getTime() : 0
      const bt = b.nextReviewAt ? new Date(b.nextReviewAt).getTime() : 0
      return at - bt
    })

    // ----- aggregate stats -----
    const states = notes.map((n) => n.recallState).filter(Boolean) as NonNullable<
      (typeof notes)[number]['recallState']
    >[]

    const todayStr = toEasternDateString(now)
    const reviewedToday = states.filter(
      (s) => s.lastReviewedAt && toEasternDateString(s.lastReviewedAt) === todayStr
    ).length

    const totalReviews = states.reduce((sum, s) => sum + s.totalReviews, 0)
    const correctReviews = states.reduce((sum, s) => sum + s.correctReviews, 0)
    const avgRetention = totalReviews > 0 ? correctReviews / totalReviews : 0

    // 7-day upcoming forecast (how many notes come due each of the next 7 days)
    const startToday = easternMidnight(now)
    const upcoming: { date: string; count: number }[] = []
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(startToday)
      dayStart.setDate(startToday.getDate() + i)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayStart.getDate() + 1)
      const count = states.filter(
        (s) => s.nextReviewAt > now && s.nextReviewAt >= dayStart && s.nextReviewAt < dayEnd
      ).length
      upcoming.push({ date: dayStart.toISOString(), count })
    }

    return NextResponse.json({
      success: true,
      data: due.slice(0, SESSION_CAP),
      stats: {
        totalNotes: notes.length,
        scheduled: states.length,
        dueCount: due.length,
        reviewedToday,
        avgRetention,
        upcoming,
      },
    })
  } catch (err) {
    console.error('[GET /api/review]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/review — grade one note's recall and reschedule it via SM-2.
//   body: { noteId: string, rating: number (0–5) }
export async function POST(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const body = (await request.json()) as { noteId?: string; rating?: number }

    if (!body.noteId || typeof body.rating !== 'number') {
      return NextResponse.json({ error: 'noteId and rating required' }, { status: 400 })
    }
    const rating = Math.max(0, Math.min(5, Math.round(body.rating)))

    const note = await db.note.findFirst({
      where: { id: body.noteId, userId },
      select: { id: true, recallState: true },
    })
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    const prev = note.recallState
    const result = sm2({
      rating,
      repetitions: prev?.repetitions ?? 0,
      easeFactor: prev?.easeFactor ?? 2.5,
      interval: prev?.interval ?? 0,
    })

    const wasCorrect = rating >= 3 ? 1 : 0
    const now = new Date()

    const state = await db.noteRecallState.upsert({
      where: { noteId: note.id },
      create: {
        userId,
        noteId: note.id,
        easeFactor: result.newEaseFactor,
        interval: result.newInterval,
        repetitions: result.newRepetitions,
        nextReviewAt: result.nextReviewAt,
        lastReviewedAt: now,
        totalReviews: 1,
        correctReviews: wasCorrect,
        lastRating: rating,
      },
      update: {
        easeFactor: result.newEaseFactor,
        interval: result.newInterval,
        repetitions: result.newRepetitions,
        nextReviewAt: result.nextReviewAt,
        lastReviewedAt: now,
        totalReviews: { increment: 1 },
        correctReviews: { increment: wasCorrect },
        lastRating: rating,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        noteId: note.id,
        interval: state.interval,
        nextReviewAt: state.nextReviewAt,
        repetitions: state.repetitions,
      },
    })
  } catch (err) {
    console.error('[POST /api/review]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
