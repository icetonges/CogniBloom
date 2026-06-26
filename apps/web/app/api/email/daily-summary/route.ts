import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendDailySummary } from '@/lib/email'
import { DANIEL_USER_ID, APP_USER, ALL_SUMMARY_RECIPIENTS } from '@/lib/user'
import { easternDateBoundaries, pgDateToEasternMidnight, toEasternDateString } from '@/lib/timezone'

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

    // Planner entries are stored with a pure UTC-midnight date anchor
    // derived from the Eastern calendar date (e.g. June 24 → Date.UTC(2026,5,24,0,0,0)).
    // `last24h` falls inside "yesterday" Eastern time, so its Eastern date string
    // gives us the correct calendar day to query.
    const yesterdayStr = toEasternDateString(last24h) // "MM/DD/YYYY"
    const [ym, yd, yy] = yesterdayStr.split('/').map(Number)
    const yesterdayPlannerDate = new Date(Date.UTC(yy!, ym! - 1, yd!))

    const [
      notesCreated,
      sessionsCompleted,
      recentNotes,
      subjects,
      flashcardsDue,
      flashcardsReviewed,
      quizzesToday,
      learningProfile,
      yesterdayHabits,
      reflectionNote,
    ] = await Promise.all([
      // Notes created in the last 24 h
      db.note.count({ where: { userId, createdAt: { gte: last24h } } }),
      // AI tutor sessions in the last 24 h
      db.tutorSession.count({ where: { userId, createdAt: { gte: last24h } } }),
      // Most recent notes (title + subject for the notes section)
      db.note.findMany({
        where: { userId, createdAt: { gte: last24h } },
        select: { title: true, subject: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Top subjects studied this week
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
      // Flashcard reviews completed in the last 24 h
      db.flashcardReview.count({
        where: { flashcard: { userId }, reviewedAt: { gte: last24h } },
      }),
      // Quizzes completed in the last 24 h
      db.quiz.findMany({
        where: { userId, status: 'completed', completedAt: { gte: last24h } },
        select: { score: true },
      }),
      // Learning profile for mastery highlight
      db.learningProfile.findUnique({
        where: { userId },
        select: { masteryScores: true },
      }),
      // Yesterday's habit tracker entries (routine-tagged planner items)
      db.plannerEntry.findMany({
        where: { userId, scope: 'day', date: yesterdayPlannerDate, tags: { has: 'routine' } },
        select: { title: true, status: true, startTime: true },
        orderBy: { startTime: 'asc' },
      }),
      // Daily reflection note written in the last 24 h
      db.note.findFirst({
        where: { userId, subject: 'Daily Reflection', createdAt: { gte: last24h } },
        select: { title: true, content: true },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    // ── Streak calculation — Eastern calendar dates ──
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
        anchor.setDate(anchor.getDate() - 1)
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

    // ── Quiz stats ──
    const quizzesTaken = quizzesToday.length
    const scoresWithValues = quizzesToday.map((q) => q.score).filter((s): s is number => s !== null)
    const avgQuizScore = scoresWithValues.length > 0
      ? scoresWithValues.reduce((a, b) => a + b, 0) / scoresWithValues.length
      : null

    // ── Mastery highlight (highest-scoring subject) ──
    let masteryHighlight: { subject: string; score: number } | null = null
    if (learningProfile?.masteryScores && typeof learningProfile.masteryScores === 'object') {
      const scores = learningProfile.masteryScores as Record<string, number>
      const entries = Object.entries(scores).filter(([, v]) => typeof v === 'number')
      if (entries.length > 0) {
        const [subject, score] = entries.reduce((best, cur) => cur[1] > best[1] ? cur : best)
        masteryHighlight = { subject, score }
      }
    }

    // ── Habit execution ──
    const completedHabits = yesterdayHabits
      .filter(h => h.status === 'done')
      .map(h => ({ title: h.title, time: h.startTime }))
    const missedHabits = yesterdayHabits
      .filter(h => h.status !== 'done')
      .map(h => ({ title: h.title, time: h.startTime }))

    // ── Daily reflection preview ──
    let dailyReflection: { title: string; preview: string } | null = null
    if (reflectionNote) {
      const raw = stripHtml(reflectionNote.content ?? '')
      // Show the first ~220 chars of meaningful content, skipping the title line
      const preview = raw.replace(/daily learning reflection/gi, '').replace(/^\s+/, '').slice(0, 220).trim()
      dailyReflection = {
        title: reflectionNote.title,
        preview: preview ? `${preview}…` : '(Reflection written — open the dashboard to read it.)',
      }
    }

    await sendDailySummary(ALL_SUMMARY_RECIPIENTS, {
      studentName: APP_USER.name,
      date: dateStr,
      notesCreated,
      sessionsCompleted,
      streak,
      topSubjects: subjects.map((s) => s.subject ?? 'General'),
      recentNotes: recentNotes.map((n) => ({ title: n.title, subject: n.subject ?? undefined })),
      flashcardsDue,
      flashcardsReviewed,
      quizzesTaken,
      avgQuizScore,
      masteryHighlight,
      habitsDone: completedHabits.length,
      habitsTotal: yesterdayHabits.length,
      completedHabits,
      missedHabits,
      dailyReflection,
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

// ─── Inline helper (server-side only, not exported from lib/email) ────────────
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
