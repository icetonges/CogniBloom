'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Loader2, Trophy, Star, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface BadgeItem {
  id: string
  name: string
  emoji: string
  description: string
  category: string
  earned: boolean
  earnedAt: string | null
}

interface GamificationData {
  xp: number
  level: number
  xpInLevel: number
  xpNeeded: number
  progressPct: number
  streak: number
  longestStreak: number
  earnedBadges: BadgeItem[]
  lockedBadges: BadgeItem[]
  totalBadges: number
}

const CATEGORY_LABELS: Record<string, string> = {
  notes: '📝 Notes',
  quizzes: '🏆 Quizzes',
  sessions: '🤖 AI Sessions',
  flashcards: '🃏 Flashcards',
  streak: '🔥 Streak',
  level: '⭐ Level',
}

const LEVEL_TITLES: Record<number, string> = {
  1: 'Seedling', 2: 'Sprout', 3: 'Sapling', 4: 'Branch',
  5: 'Rising Star', 6: 'Learner', 7: 'Scholar', 8: 'Expert',
  9: 'Mentor', 10: 'Star Student', 15: 'Prodigy', 20: 'Sage',
}

function getLevelTitle(level: number): string {
  const keys = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => b - a)
  for (const k of keys) {
    if (level >= k) return LEVEL_TITLES[k]
  }
  return 'Seedling'
}

function LevelRing({ level, progressPct }: { level: number; progressPct: number }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progressPct / 100) * circumference

  return (
    <div className="relative w-36 h-36 flex items-center justify-center mx-auto">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 128 128">
        {/* Track */}
        <circle cx="64" cy="64" r={radius} fill="none" stroke="currentColor" strokeWidth="8"
          className="text-muted" strokeOpacity={0.3} />
        {/* Progress */}
        <circle cx="64" cy="64" r={radius} fill="none" stroke="url(#xp-grad)" strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <defs>
          <linearGradient id="xp-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="text-center z-10">
        <div className="text-3xl font-black text-primary leading-none">{level}</div>
        <div className="text-xs text-muted-foreground mt-0.5 font-medium">LEVEL</div>
      </div>
    </div>
  )
}

export default function AchievementsPage() {
  const [data, setData] = useState<GamificationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/gamification')
      .then((r) => r.json())
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) return <p className="text-center py-12 text-muted-foreground">Could not load achievements.</p>

  const categories = Object.keys(CATEGORY_LABELS)
  const allBadges = [...data.earnedBadges, ...data.lockedBadges]
  const filtered = activeCategory
    ? allBadges.filter((b) => b.category === activeCategory)
    : allBadges

  const levelTitle = getLevelTitle(data.level)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Trophy className="w-7 h-7 text-amber-500" />
          Achievements
        </h1>
        <p className="text-muted-foreground mt-1">
          Track your XP, level up, and earn badges for every milestone.
        </p>
      </div>

      {/* Level + XP card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Level ring */}
          <div className="shrink-0">
            <LevelRing level={data.level} progressPct={data.progressPct} />
            <p className="text-center text-sm font-semibold mt-2 text-primary">{levelTitle}</p>
          </div>

          {/* XP stats */}
          <div className="flex-1 w-full space-y-4">
            <div>
              <div className="flex justify-between items-end mb-1.5">
                <span className="text-sm font-medium">XP Progress to Level {data.level + 1}</span>
                <span className="text-xs text-muted-foreground">
                  {data.xpInLevel} / {data.xpNeeded} XP
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-700"
                  style={{ width: `${data.progressPct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-2xl font-black text-primary">{data.xp.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total XP</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-2xl font-black text-amber-500">🔥 {data.streak}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Day streak</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-2xl font-black text-green-500">
                  {data.earnedBadges.length}<span className="text-sm font-medium text-muted-foreground">/{data.totalBadges}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Badges earned</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* XP Guide */}
      <Card className="p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">How to earn XP</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {[
            { action: 'Create a note', xp: '+10 XP' },
            { action: 'AI tutor session', xp: '+15 XP' },
            { action: 'Complete a quiz', xp: '+20 XP' },
            { action: 'Perfect quiz score', xp: '+30 XP bonus' },
            { action: 'Review a flashcard', xp: '+3 XP' },
            { action: 'Streak day bonus', xp: '+5 XP/day' },
          ].map(({ action, xp }) => (
            <div key={action} className="flex justify-between items-center bg-muted/40 rounded-lg px-3 py-2">
              <span className="text-muted-foreground">{action}</span>
              <span className="font-semibold text-primary shrink-0 ml-2">{xp}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Recently earned */}
      {data.earnedBadges.length > 0 && (
        <div>
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            Recently earned
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1 snap-x">
            {data.earnedBadges.slice(0, 8).map((badge) => (
              <Card key={badge.id} className="shrink-0 snap-start p-4 w-36 text-center space-y-1.5 border-amber-500/30 bg-amber-500/5">
                <div className="text-3xl">{badge.emoji}</div>
                <p className="text-xs font-semibold leading-tight">{badge.name}</p>
                {badge.earnedAt && (
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(badge.earnedAt), { addSuffix: true })}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            activeCategory === null ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          All ({allBadges.length})
        </button>
        {categories.map((cat) => {
          const count = allBadges.filter((b) => b.category === cat).length
          if (count === 0) return null
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                activeCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {CATEGORY_LABELS[cat]} ({count})
            </button>
          )
        })}
      </div>

      {/* Full badge grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {filtered.map((badge) => (
          <Card
            key={badge.id}
            className={cn(
              'p-4 text-center space-y-2 transition-all',
              badge.earned
                ? 'border-primary/20 bg-primary/5 hover:border-primary/40'
                : 'opacity-50 grayscale'
            )}
          >
            <div className="relative inline-block">
              <span className="text-3xl">{badge.emoji}</span>
              {!badge.earned && (
                <Lock className="w-3.5 h-3.5 text-muted-foreground absolute -bottom-0.5 -right-1" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">{badge.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{badge.description}</p>
            </div>
            {badge.earned && badge.earnedAt && (
              <p className="text-[10px] text-primary font-medium">
                Earned {formatDistanceToNow(new Date(badge.earnedAt), { addSuffix: true })}
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Longest streak footnote */}
      {data.longestStreak > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          🏅 Longest streak ever: <strong>{data.longestStreak} day{data.longestStreak !== 1 ? 's' : ''}</strong>
        </p>
      )}
    </div>
  )
}
