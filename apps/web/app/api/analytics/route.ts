import { NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'

// GET /api/analytics — return learning stats for the authenticated user
export async function GET() {
  try {
    const userId = DANIEL_USER_ID

    const now = new Date()
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0)
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 6); startOfWeek.setHours(0, 0, 0, 0)
    const startOfMonth = new Date(now); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)

    const [
      totalNotes,
      totalSessions,
      notesThisWeek,
      sessionsThisWeek,
      recentSessions,
      subjectBreakdown,
      tokenStats,
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
    ])

    // Build day-by-day activity (last 7 days)
    const activityMap: Record<string, { sessions: number; messages: number }> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      activityMap[d.toISOString().slice(0, 10)] = { sessions: 0, messages: 0 }
    }
    for (const s of recentSessions) {
      const key = s.createdAt.toISOString().slice(0, 10)
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

    // Streak calculation (consecutive days with at least 1 session or note)
    const allActivity = await db.$queryRaw<{ day: Date }[]>`
      SELECT DISTINCT DATE("createdAt") as day
      FROM "TutorSession"
      WHERE "userId" = ${userId}
      UNION
      SELECT DISTINCT DATE("createdAt") as day
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
      const actual = new Date(allActivity[i].day)
      if (actual.toDateString() === expected.toDateString()) {
        streak++
      } else {
        break
      }
    }

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
      },
    })
  } catch (error) {
    console.error('[analytics GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
