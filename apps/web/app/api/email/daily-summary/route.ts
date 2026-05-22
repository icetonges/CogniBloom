import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendDailySummary } from '@/lib/email'
import { DANIEL_USER_ID, APP_USER, ALL_SUMMARY_RECIPIENTS } from '@/lib/user'

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
    const today = new Date()
    const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0)
    const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - 6); startOfWeek.setHours(0, 0, 0, 0)

    const [notesCreated, sessionsCompleted, recentNotes, tokenStats, subjects] = await Promise.all([
      db.note.count({ where: { userId, createdAt: { gte: startOfDay } } }),
      db.tutorSession.count({ where: { userId, createdAt: { gte: startOfDay } } }),
      db.note.findMany({
        where: { userId, createdAt: { gte: startOfDay } },
        select: { title: true, subject: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      db.tutorSession.aggregate({
        where: { userId, createdAt: { gte: startOfDay } },
        _sum: { totalTokensUsed: true },
      }),
      db.note.groupBy({
        by: ['subject'],
        where: { userId, createdAt: { gte: startOfWeek }, subject: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ])

    // Streak calculation
    const allActivity = await db.$queryRaw<{ day: Date }[]>`
      SELECT DISTINCT DATE("createdAt") as day
      FROM "TutorSession" WHERE "userId" = ${userId}
      UNION
      SELECT DISTINCT DATE("createdAt") as day
      FROM "Note" WHERE "userId" = ${userId}
      ORDER BY day DESC LIMIT 60
    `
    let streak = 0
    const todayStart = new Date(startOfDay)
    for (let i = 0; i < allActivity.length; i++) {
      const expected = new Date(todayStart)
      expected.setDate(todayStart.getDate() - i)
      const actual = new Date(allActivity[i].day)
      if (actual.toDateString() === expected.toDateString()) streak++
      else break
    }

    const dateStr = today.toLocaleDateString('en-AU', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    await sendDailySummary(ALL_SUMMARY_RECIPIENTS, {
      studentName: APP_USER.name,
      date: dateStr,
      notesCreated,
      sessionsCompleted,
      streak,
      topSubjects: subjects.map((s) => s.subject ?? 'General'),
      tokensUsed: tokenStats._sum.totalTokensUsed ?? 0,
      recentNotes: recentNotes.map((n) => ({ title: n.title, subject: n.subject ?? undefined })),
    })

    return NextResponse.json({
      success: true,
      message: `Daily summary sent to ${ALL_SUMMARY_RECIPIENTS.length} recipient(s)`,
      recipients: ALL_SUMMARY_RECIPIENTS,
    })
  } catch (error) {
    console.error('[email/daily-summary]', error)
    return NextResponse.json({ error: 'Failed to send summary' }, { status: 500 })
  }
}
