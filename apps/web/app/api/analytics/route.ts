import { NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { easternDateBoundaries, easternMidnight, pgDateToEasternMidnight } from '@/lib/timezone'

// GET /api/analytics — return learning stats for the authenticated user
export async function GET() {
  try {
    const userId = DANIEL_USER_ID

    const { now, startOfDay, startOfWeek, startOfMonth } = easternDateBoundaries()

    const [
      totalNotes,
      totalSessions,
      notesThisWeek,
      sessionsThisWeek,
      recentSessions,
      subjectBreakdown,
      tokenStats,
      learningProfile,
      recentQuizzes,
      flashcardStats,
      flashcardReviewsThisWeek,
    ] = await Promise.all([
      db.note.count({ where: { userId } }),
      db.tutorSession.count({ where: { userId } }),
      db.note.count({ where: { userId, createdAt: { gte: startOfWeek } } }),
      db.tutorSession.count({ where: { userId, createdAt: { gte: startOfWeek } } }),
      // Last 7 days of sessions for the activity chart
      db.tutorSession.findMany({
        where: { userId, createdAt: { gte: startOfWeek } },
        select: { createdAt: true, totalTokensUsed: true, messageCount: true, mode: true },
        orderBy: { createdAt: 'asc' },
      }),
      // Notes per subject
      db.note.groupBy({
        by: ['subject'],
        where: { userId, subject: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 6,
      }),
      // Total tokens used this month
      db.tutorSession.aggregate({
        where: { userId, createdAt: { gte: startOfMonth } },
        _sum: { totalTokensUsed: true, messageCount: true },
      }),
      // Mastery profile
      db.learningProfile.findUnique({
        where: { userId },
        select: { masteryScores: true, weakAreas: true, strongAreas: true, currentStreak: true, totalPracticeAnswered: true, averageAccuracy: true },
      }),
      // Recent quizzes for history
      db.quiz.findMany({
        where: { userId, status: 'completed' },
        orderBy: { completedAt: 'desc' },
        take: 5,
        select: { id: true, title: true, subject: true, score: true, totalQuestions: true, correctAnswers: true, completedAt: true, difficulty: true },
      }),
      // Flashcard aggregate stats
      db.flashcard.aggregate({
        where: { userId },
        _count: { id: true },
        _avg: { easeFactor: true },
      }),
      // Flashcard reviews this week
      db.flashcardReview.count({
        where: {
          flashcard: { userId },
          reviewedAt: { gte: startOfWeek },
        },
      }),
    ])

    // Build day-by-day activity (last 7 days) — keys are Eastern calendar dates YYYY-MM-DD
    const activityMap: Record<string, { sessions: number; messages: number }> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(startOfDay)
      d.setDate(startOfDay.getDate() - i)
      // Format as YYYY-MM-DD using Eastern midnight date
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      activityMap[key] = { sessions: 0, messages: 0 }
    }
    for (const s of recentSessions) {
      // Convert session's UTC createdAt to Eastern date key
      const eastern = easternMidnight(s.createdAt)
      const key = `${eastern.getFullYear()}-${String(eastern.getMonth() + 1).padStart(2, '0')}-${String(eastern.getDate()).padStart(2, '0')}`
      if (activityMap[key]) {
        activityMap[key].sessions += 1
        activityMap[key].messages += s.messageCount
      }
    }
    const activityChart = Object.entries(activityMap).map(([date, v]) => ({ date, ...v }))

    // Mode breakdown
    const modeCounts: Record<string, number> = {}
    for (const s of recentSessions) {
      modeCounts[s.mode] = (modeCounts[s.mode] || 0) + 1
    }

    // Streak calculation — use Eastern calendar dates so midnight rolls at Eastern time
    const allActivity = await db.$queryRaw<{ day: Date }[]>`
      SELECT DISTINCT DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') as day
      FROM "TutorSession"
      WHERE "userId" = ${userId}
      UNION
      SELECT DISTINCT DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') as day
      FROM "Note"
      WHERE "userId" = ${userId}
      ORDER BY day DESC
      LIMIT 60
    `
    let streak = 0
    const today = startOfDay
    for (let i = 0; i < allActivity.length; i++) {
      const expected = new Date(today)
      expected.setDate(today.getDate() - i)
      const actual = pgDateToEasternMidnight(new Date(allActivity[i].day))
      if (actual.getTime() === expected.getTime()) {
        streak++
      } else {
        break
      }
    }

    // Flashcard due count
    const flashcardsDue = await db.flashcard.count({
      where: { userId, nextReviewAt: { lte: now } },
    })

    // Flashcard correct review rate this week
    const correctReviewsThisWeek = await db.flashcardReview.count({
      where: {
        flashcard: { userId },
        reviewedAt: { gte: startOfWeek },
        rating: { gte: 3 },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        totals: {
          notes: totalNotes,
          sessions: totalSessions,
          tokensThisMonth: tokenStats._sum.totalTokensUsed || 0,
          messagesThisMonth: tokenStats._sum.messageCount || 0,
        },
        thisWeek: {
          notes: notesThisWeek,
          sessions: sessionsThisWeek,
        },
        streak,
        activityChart,
        subjectBreakdown: subjectBreakdown.map((s) => ({
          subject: s.subject || 'General',
          count: s._count.id,
        })),
        modeCounts,
        mastery: {
          scores: (learningProfile?.masteryScores as Record<string, number>) ?? {},
          weakAreas: learningProfile?.weakAreas ?? [],
          strongAreas: learningProfile?.strongAreas ?? [],
          currentStreak: learningProfile?.currentStreak ?? streak,
          totalPracticeAnswered: learningProfile?.totalPracticeAnswered ?? 0,
          averageAccuracy: learningProfile?.averageAccuracy ?? 0,
        },
        recentQuizzes: recentQuizzes.map((q) => ({
          id: q.id,
          title: q.title,
          subject: q.subject,
          score: q.score ?? 0,
          totalQuestions: q.totalQuestions,
          correctAnswers: q.correctAnswers,
          completedAt: q.completedAt?.toISOString() ?? null,
          difficulty: q.difficulty,
        })),
        flashcards: {
          total: flashcardStats._count.id,
          due: flashcardsDue,
          reviewsThisWeek: flashcardReviewsThisWeek,
          correctThisWeek: correctReviewsThisWeek,
          avgEaseFactor: flashcardStats._avg.easeFactor ?? 0,
        },
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
