import { NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { xpToLevel, xpForLevel, BADGES } from '@/lib/gamification'

export const dynamic = 'force-dynamic'

// GET /api/gamification — returns XP, level, badge progress for the dashboard
export async function GET() {
  try {
    const userId = DANIEL_USER_ID

    const [profile, earnedRows] = await Promise.all([
      db.learningProfile.findUnique({
        where: { userId },
        select: { xp: true, level: true, currentStreak: true, longestStreak: true },
      }),
      db.userBadge.findMany({
        where: { userId },
        select: { badgeId: true, earnedAt: true },
        orderBy: { earnedAt: 'desc' },
      }),
    ])

    const totalXP = profile?.xp ?? 0
    const level = profile?.level ?? xpToLevel(totalXP)

    // XP progress within the current level
    const levelStart = xpForLevel(level)
    const levelEnd = xpForLevel(level + 1)
    const xpInLevel = totalXP - levelStart
    const xpNeeded = levelEnd - levelStart
    const progressPct = Math.min(Math.round((xpInLevel / xpNeeded) * 100), 100)

    const earnedMap = new Map(earnedRows.map((r) => [r.badgeId, r.earnedAt]))

    const badges = BADGES.map((b) => ({
      ...b,
      earned: earnedMap.has(b.id),
      earnedAt: earnedMap.get(b.id) ?? null,
    }))

    // Group badges for the response
    const earned = badges.filter((b) => b.earned).sort(
      (a, b) => new Date(b.earnedAt!).getTime() - new Date(a.earnedAt!).getTime()
    )
    const locked = badges.filter((b) => !b.earned)

    return NextResponse.json({
      success: true,
      data: {
        xp: totalXP,
        level,
        xpInLevel,
        xpNeeded,
        progressPct,
        streak: profile?.currentStreak ?? 0,
        longestStreak: profile?.longestStreak ?? 0,
        earnedBadges: earned,
        lockedBadges: locked,
        totalBadges: BADGES.length,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
