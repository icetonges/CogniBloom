import { db } from '@/lib/db'

// ─── XP award amounts ─────────────────────────────────────────────────────────

export const XP = {
  NOTE_CREATED:        10,
  SESSION_COMPLETED:   15,
  QUIZ_COMPLETED:      20,
  QUIZ_PERFECT_BONUS:  30,   // extra XP for a 100% quiz score
  FLASHCARD_REVIEWED:   3,   // per card reviewed
  STREAK_BONUS:         5,   // extra per streak day (awarded on first activity of the day)
  FIRST_NOTE_TODAY:     5,   // bonus for the first note of each calendar day
} as const

export type XPEvent = keyof typeof XP

// ─── Level formula ────────────────────────────────────────────────────────────
// Level 1 = 0 XP, grows as floor(sqrt(totalXP / 50)) + 1
// Level 5  ≈  1 250 XP   Level 10 ≈  5 000 XP   Level 20 ≈ 20 000 XP

export function xpToLevel(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(xp, 0) / 50)) + 1
}

export function xpForLevel(level: number): number {
  return Math.pow(level - 1, 2) * 50
}

export function xpForNextLevel(currentXP: number): { current: number; needed: number; level: number } {
  const level = xpToLevel(currentXP)
  const current = currentXP - xpForLevel(level)
  const needed = xpForLevel(level + 1) - xpForLevel(level)
  return { current, needed, level }
}

// ─── Badge catalogue ──────────────────────────────────────────────────────────

export interface BadgeDef {
  id: string
  name: string
  emoji: string
  description: string
  category: 'notes' | 'quizzes' | 'sessions' | 'flashcards' | 'streak' | 'level'
}

export const BADGES: BadgeDef[] = [
  // Notes
  { id: 'first_note',     name: 'First Note',       emoji: '✍️',  description: 'Created your very first note',  category: 'notes' },
  { id: 'notes_10',       name: 'Note Taker',       emoji: '📝',  description: '10 notes created',              category: 'notes' },
  { id: 'notes_25',       name: 'Prolific Writer',  emoji: '📚',  description: '25 notes created',              category: 'notes' },
  { id: 'notes_50',       name: 'Knowledge Builder',emoji: '🏗️',  description: '50 notes created',              category: 'notes' },
  // Quizzes
  { id: 'first_quiz',     name: 'Quiz Starter',     emoji: '🎯',  description: 'Completed your first quiz',     category: 'quizzes' },
  { id: 'quiz_perfect',   name: 'Perfect Score',    emoji: '⭐',  description: 'Scored 100% on a quiz',         category: 'quizzes' },
  { id: 'quiz_10',        name: 'Quiz Champion',    emoji: '🏆',  description: 'Completed 10 quizzes',          category: 'quizzes' },
  // AI Sessions
  { id: 'first_session',  name: 'AI Explorer',      emoji: '🤖',  description: 'Completed your first AI session', category: 'sessions' },
  { id: 'sessions_10',    name: 'Regular Learner',  emoji: '💬',  description: '10 AI tutor sessions',          category: 'sessions' },
  { id: 'sessions_50',    name: 'Brain Power',      emoji: '🧠',  description: '50 AI tutor sessions',          category: 'sessions' },
  // Flashcards
  { id: 'flashcards_10',  name: 'Card Starter',     emoji: '🃏',  description: 'Reviewed 10 flashcards',        category: 'flashcards' },
  { id: 'flashcards_50',  name: 'Card Shark',       emoji: '⚡',  description: 'Reviewed 50 flashcards',        category: 'flashcards' },
  { id: 'flashcards_100', name: 'Flashcard Master', emoji: '🌊',  description: 'Reviewed 100 flashcards',       category: 'flashcards' },
  // Streak
  { id: 'streak_3',       name: 'Hat Trick',        emoji: '🎩',  description: '3-day learning streak',         category: 'streak' },
  { id: 'streak_7',       name: 'Study Week',       emoji: '📅',  description: '7-day learning streak',         category: 'streak' },
  { id: 'streak_14',      name: 'Two Weeks Strong', emoji: '🔥',  description: '14-day learning streak',        category: 'streak' },
  { id: 'streak_30',      name: 'Monthly Grind',    emoji: '💪',  description: '30-day learning streak',        category: 'streak' },
  // Level milestones
  { id: 'level_5',        name: 'Rising Star',      emoji: '🌟',  description: 'Reached level 5',               category: 'level' },
  { id: 'level_10',       name: 'Star Student',     emoji: '🌠',  description: 'Reached level 10',              category: 'level' },
  { id: 'level_20',       name: 'Sage',             emoji: '🦉',  description: 'Reached level 20',              category: 'level' },
]

export const BADGE_MAP = new Map(BADGES.map((b) => [b.id, b]))

// ─── Badge condition checker ──────────────────────────────────────────────────
// Returns the list of badge IDs that should now be awarded (not yet earned).

async function getNewBadges(userId: string, alreadyEarned: Set<string>): Promise<string[]> {
  const earned: string[] = []

  const check = (badgeId: string, condition: boolean) => {
    if (condition && !alreadyEarned.has(badgeId)) earned.push(badgeId)
  }

  const [noteCount, quizData, sessionCount, reviewCount, profile] = await Promise.all([
    db.note.count({ where: { userId } }),
    db.quiz.findMany({
      where: { userId, status: 'completed' },
      select: { score: true },
    }),
    db.tutorSession.count({ where: { userId } }),
    db.flashcardReview.count({
      where: { flashcard: { userId } },
    }),
    db.learningProfile.findUnique({
      where: { userId },
      select: { xp: true, level: true, currentStreak: true },
    }),
  ])

  const quizCount = quizData.length
  const hasPerfect = quizData.some((q) => q.score != null && q.score >= 1)
  const streak = profile?.currentStreak ?? 0
  const level = profile?.level ?? 1

  // Notes
  check('first_note',     noteCount >= 1)
  check('notes_10',       noteCount >= 10)
  check('notes_25',       noteCount >= 25)
  check('notes_50',       noteCount >= 50)
  // Quizzes
  check('first_quiz',     quizCount >= 1)
  check('quiz_perfect',   hasPerfect)
  check('quiz_10',        quizCount >= 10)
  // Sessions
  check('first_session',  sessionCount >= 1)
  check('sessions_10',    sessionCount >= 10)
  check('sessions_50',    sessionCount >= 50)
  // Flashcards
  check('flashcards_10',  reviewCount >= 10)
  check('flashcards_50',  reviewCount >= 50)
  check('flashcards_100', reviewCount >= 100)
  // Streak
  check('streak_3',       streak >= 3)
  check('streak_7',       streak >= 7)
  check('streak_14',      streak >= 14)
  check('streak_30',      streak >= 30)
  // Level
  check('level_5',        level >= 5)
  check('level_10',       level >= 10)
  check('level_20',       level >= 20)

  return earned
}

// ─── Main award function ──────────────────────────────────────────────────────

export interface AwardResult {
  xpGained: number
  totalXP: number
  level: number
  leveledUp: boolean
  newBadges: BadgeDef[]
}

export async function awardXP(
  userId: string,
  amount: number,
): Promise<AwardResult> {
  // Upsert the learning profile to ensure it exists
  const profile = await db.learningProfile.upsert({
    where: { userId },
    create: { userId, xp: 0, level: 1 },
    update: {},
    select: { xp: true, level: true },
  })

  const prevLevel = profile.level
  const newXP = profile.xp + amount
  const newLevel = xpToLevel(newXP)

  // Fetch badges already earned
  const earnedRows = await db.userBadge.findMany({
    where: { userId },
    select: { badgeId: true },
  })
  const alreadyEarned = new Set(earnedRows.map((r) => r.badgeId))

  // Determine new badges (must check BEFORE we update level so level-badge checks use newLevel)
  // Temporarily update level for the check
  const tempProfile = { ...profile, level: newLevel }
  void tempProfile  // mark as used

  // Update XP + level first
  await db.learningProfile.update({
    where: { userId },
    data: { xp: newXP, level: newLevel },
  })

  // Now check badges (they read from DB which now has updated level)
  const newBadgeIds = await getNewBadges(userId, alreadyEarned)

  // Insert new badges
  if (newBadgeIds.length > 0) {
    await db.userBadge.createMany({
      data: newBadgeIds.map((badgeId) => ({ userId, badgeId, id: crypto.randomUUID() })),
      skipDuplicates: true,
    })
  }

  return {
    xpGained: amount,
    totalXP: newXP,
    level: newLevel,
    leveledUp: newLevel > prevLevel,
    newBadges: newBadgeIds.map((id) => BADGE_MAP.get(id)!).filter(Boolean),
  }
}

// ─── Streak updater ───────────────────────────────────────────────────────────
// Recalculates the current streak from DB activity and persists it.
// Returns the streak length (used to compute streak XP bonus).

export async function updateStreak(userId: string): Promise<number> {
  const activity = await db.$queryRaw<{ day: Date }[]>`
    SELECT DISTINCT DATE("createdAt") AS day
    FROM "TutorSession" WHERE "userId" = ${userId}
    UNION
    SELECT DISTINCT DATE("createdAt") AS day
    FROM "Note" WHERE "userId" = ${userId}
    ORDER BY day DESC LIMIT 60
  `

  let streak = 0
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (let i = 0; i < activity.length; i++) {
    const expected = new Date(today); expected.setDate(today.getDate() - i)
    if (new Date(activity[i].day).toDateString() === expected.toDateString()) streak++
    else break
  }

  // Persist to profile (upsert to handle first-time case)
  await db.learningProfile.upsert({
    where: { userId },
    create: { userId, currentStreak: streak, longestStreak: streak },
    update: {
      currentStreak: streak,
      longestStreak: { set: streak },  // will be overridden below if needed
    },
  })

  // Ensure longestStreak is at least currentStreak
  await db.$executeRaw`
    UPDATE "LearningProfile"
    SET "longestStreak" = GREATEST("longestStreak", ${streak})
    WHERE "userId" = ${userId}
  `

  return streak
}
