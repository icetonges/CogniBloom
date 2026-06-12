import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendDailySummary } from '@/lib/email'
import { DANIEL_USER_ID, APP_USER, ALL_SUMMARY_RECIPIENTS } from '@/lib/user'
import { easternDateBoundaries, pgDateToEasternMidnight } from '@/lib/timezone'

// POST /api/email/daily-summary
// Called by GitHub Actions cron daily. Protected by CRON_SECRET.
export async function POST(request: NextRequest) {
  try {
    // Simple shared-secret protection so only the cron job can trigger this
    const secret = request.headers.get('x-cron-secret')
    if (secret !== process.env['CRON_SECRET']) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userId = DANIEL_USER_ID
    const { now: today, startOfDay, startOfWeek } = easternDateBoundaries()
    // Email is sent at 7 AM New York time; stats cover the trailing 24 hours
    // of activity rather than the (just-started) Eastern calendar day.
    const last24h = new Date(today.getTime() - 24 * 60 * 60 * 1000)

    const [
      notesCreated,
      sessionsCompleted,
      recentNotes,
      tokenStats,
      subjects,
      flashcardsDue,
      flashcardsReviewed,
      quizzesToday,
      learningProfile,
    ] = await Promise.all([
      db.note.count({ where: { userId, createdAt: { gte: last24h } } }),
      db.tutorSession.count({ where: { userId, createdAt: { gte: last24h } } }),
      db.note.findMany({
        where: { userId, createdAt: { gte: last24h } },
        select: { title: true, subject: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      db.tutorSession.aggregate({
        where: { userId, createdAt: { gte: last24h } },
        _sum: { totalTokensUsed: true },
      }),
      db.note.groupBy({
        by: ['subject'],
        where: { userId, createdAt: { gte: startOfWeek }, subject: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      // Flashcards due for review right now
      db.flashcard.count({
        where: { userId, nextReviewAt: { lte: today } },
      }),
      // Flashcard reviews completed in the last 24 hours
      db.flashcardReview.count({
        where: { flashcard: { userId }, reviewedAt: { gte: last24h } },
      }),
      // Quizzes completed in the last 24 hours (with scores)
      db.quiz.findMany({
        where: { userId, status: 'completed', completedAt: { gte: last24h } },
        select: { score: true },
      }),
      // Learning profile for mastery highlight
      db.learningProfile.findUnique({
        where: { userId },
        select: { masteryScores: true },
      }),
    ])

    // Streak calculation — Eastern calendar dates
    const allActivity = await db.$queryRaw<{ day: Date }[]>`
      SELECT DISTINCT DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') as day
      FROM "TutorSession" WHERE "userId" = ${userId}
      UNION
      SELECT DISTINCT DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') as day
      FROM "Note" WHERE "userId" = ${userId}
      ORDER BY day DESC LIMIT 60
    `
    // At 7 AM the current Eastern day has just begun — if there's no activity
    // yet today, an unbroken streak through yesterday should still count.
    let streak = 0
    if (allActivity.length > 0) {
      const mostRecent = pgDateToEasternMidnight(new Date(allActivity[0].day))
      const anchor = new Date(startOfDay)
      if (mostRecent.getTime() !== startOfDay.getTime()) {
        anchor.setDate(anchor.getDate() - 1) // no activity yet today → anchor on yesterday
      }
      for (let i = 0; i < allActivity.length; i++) {
        const expected = new Date(anchor)
        expected.setDate(anchor.getDate() - i)
        const actual = pgDateToEasternMidnight(new Date(allActivity[i].day))
        if (actual.getTime() === expected.getTime()) streak++
        else break
      }
    }

    const dateStr = today.toLocaleDateString('en-AU', {
      timeZone: 'America/New_York',
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    // Derive quiz stats from today's completed quizzes
    const quizzesTaken = quizzesToday.length
    const scoresWithValues = quizzesToday.map((q) => q.score).filter((s): s is number => s !== null)
    const avgQuizScore = scoresWithValues.length > 0
      ? scoresWithValues.reduce((a, b) => a + b, 0) / scoresWithValues.length
      : null

    // Find the highest-mastery subject from the learning profile
    let masteryHighlight: { subject: string; score: number } | null = null
    if (learningProfile?.masteryScores && typeof learningProfile.masteryScores === 'object') {
      const scores = learningProfile.masteryScores as Record<string, number>
      const entries = Object.entries(scores).filter(([, v]) => typeof v === 'number')
      if (entries.length > 0) {
        const [subject, score] = entries.reduce((best, cur) => cur[1] > best[1] ? cur : best)
        masteryHighlight = { subject, score }
      }
    }

    await sendDailySummary(ALL_SUMMARY_RECIPIENTS, {
      studentName: APP_USER.name,
      date: dateStr,
      notesCreated,
      sessionsCompleted,
      streak,
      topSubjects: subjects.map((s) => s.subject ?? 'General'),
      tokensUsed: tokenStats._sum.totalTokensUsed ?? 0,
      recentNotes: recentNotes.map((n) => ({ title: n.title, subject: n.subject ?? undefined })),
      flashcardsDue,
      flashcardsReviewed,
      quizzesTaken,
      avgQuizScore,
      masteryHighlight,
    })

    return NextResponse.json({
      success: true,
      message: `Daily summary sent to ${ALL_SUMMARY_RECIPIENTS.length} recipient(s)`,
      recipients: ALL_SUMMARY_RECIPIENTS,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to send summary' }, { status: 500 })
  }
}
