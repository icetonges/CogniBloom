'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2, Plus, Trash2, Trophy, Star, Flame, Zap,
  BookOpen, Medal, Award, GraduationCap, X, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  totalBadges: number
}

interface CustomAward {
  id: string
  title: string
  description: string
  emoji: string
  date: string  // ISO string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_TITLES: Record<number, string> = {
  1: 'Seedling', 2: 'Sprout', 3: 'Sapling', 4: 'Branch',
  5: 'Rising Star', 6: 'Learner', 7: 'Scholar', 8: 'Expert',
  9: 'Mentor', 10: 'Star Student', 15: 'Prodigy', 20: 'Sage',
}

const AWARD_EMOJIS = ['🏆', '🥇', '🎖️', '🌟', '⭐', '🎓', '🏅', '💡', '🚀', '🔥', '💎', '🎯', '📚', '✍️', '🧠', '🎤']
const STORAGE_KEY = 'cognibloom_award_wall'

const MILESTONE_BADGES = [
  { xp: 100,   emoji: '🌱', label: 'First 100 XP',       desc: 'Earned your first 100 XP' },
  { xp: 500,   emoji: '⚡', label: '500 XP Club',         desc: 'Reached 500 total XP' },
  { xp: 1000,  emoji: '🌟', label: '1K XP Scholar',       desc: 'Crossed 1,000 XP milestone' },
  { xp: 2500,  emoji: '🏆', label: '2,500 XP Champion',   desc: 'Mastered 2,500 XP earned' },
  { xp: 5000,  emoji: '💎', label: 'Diamond Learner',     desc: '5,000 XP — elite territory' },
  { xp: 10000, emoji: '👑', label: 'Legendary Scholar',   desc: '10,000 XP — legendary status' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLevelTitle(level: number): string {
  const keys = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => b - a)
  for (const k of keys) {
    if (level >= k) return LEVEL_TITLES[k] ?? 'Seedling'
  }
  return 'Seedling'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function loadCustomAwards(): CustomAward[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as CustomAward[]
  } catch {
    return []
  }
}

function saveCustomAwards(awards: CustomAward[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(awards))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ icon, value, label, color }: {
  icon: React.ReactNode; value: string | number; label: string; color: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-1 rounded-2xl px-5 py-4 border', color)}>
      <div className="text-2xl">{icon}</div>
      <div className="text-2xl font-black leading-none">{value}</div>
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
    </div>
  )
}

function BadgeTrophy({ badge }: { badge: BadgeItem }) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-b from-amber-500/10 to-amber-500/5 border border-amber-500/30 hover:border-amber-500/60 transition-all group">
      <div className="text-4xl group-hover:scale-110 transition-transform">{badge.emoji}</div>
      <div className="text-center">
        <p className="text-sm font-bold leading-tight">{badge.name}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{badge.description}</p>
        {badge.earnedAt && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
            {formatDate(badge.earnedAt)}
          </p>
        )}
      </div>
    </div>
  )
}

function MilestoneBadge({ milestone, earned }: {
  milestone: typeof MILESTONE_BADGES[0]; earned: boolean
}) {
  return (
    <div className={cn(
      'flex flex-col items-center gap-2 p-3 rounded-xl border transition-all',
      earned
        ? 'bg-primary/10 border-primary/40'
        : 'bg-muted/30 border-border opacity-50'
    )}>
      <span className="text-3xl">{milestone.emoji}</span>
      <p className="text-xs font-bold text-center leading-tight">{milestone.label}</p>
      <p className="text-[10px] text-muted-foreground text-center">{milestone.desc}</p>
    </div>
  )
}

function CustomAwardCard({ award, onDelete }: { award: CustomAward; onDelete: () => void }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-br from-primary/8 to-secondary/8 border border-primary/20 hover:border-primary/40 transition-all group">
      <span className="text-3xl shrink-0">{award.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm leading-tight">{award.title}</p>
        {award.description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{award.description}</p>
        )}
        <p className="text-[10px] text-primary/70 mt-1">{formatDate(award.date)}</p>
      </div>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-500/10 hover:text-red-500 text-muted-foreground"
        title="Remove"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── Add Award Modal ──────────────────────────────────────────────────────────

function AddAwardModal({ onAdd, onClose }: {
  onAdd: (award: Omit<CustomAward, 'id'>) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('🏆')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = () => {
    if (!title.trim()) return
    onAdd({ title: title.trim(), description: description.trim(), emoji, date: new Date(date).toISOString() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" /> Add Accomplishment
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Emoji picker */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Choose an icon</label>
          <div className="flex flex-wrap gap-2">
            {AWARD_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={cn(
                  'text-xl w-9 h-9 rounded-lg transition-all flex items-center justify-center',
                  emoji === e
                    ? 'bg-primary/20 border-2 border-primary scale-110'
                    : 'bg-muted hover:bg-muted/70 border border-transparent'
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="e.g. Aced the Math Final Exam"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            maxLength={80}
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Description <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Scored 98% on the end-of-year exam"
            rows={2}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            maxLength={200}
          />
        </div>

        {/* Date */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim()} className="flex-1 gap-2">
            <Check className="w-3.5 h-3.5" /> Add to Wall
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AwardWallPage() {
  const [data, setData] = useState<GamificationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [customAwards, setCustomAwards] = useState<CustomAward[]>([])
  const [showModal, setShowModal] = useState(false)

  // Load gamification data
  useEffect(() => {
    fetch('/api/gamification')
      .then((r) => r.json())
      .then(({ data: d }) => setData(d))
      .finally(() => setLoading(false))
  }, [])

  // Load custom awards from localStorage
  useEffect(() => {
    setCustomAwards(loadCustomAwards())
  }, [])

  const addAward = (award: Omit<CustomAward, 'id'>) => {
    const newAward: CustomAward = { ...award, id: Date.now().toString() }
    const updated = [newAward, ...customAwards]
    setCustomAwards(updated)
    saveCustomAwards(updated)
  }

  const deleteAward = (id: string) => {
    const updated = customAwards.filter((a) => a.id !== id)
    setCustomAwards(updated)
    saveCustomAwards(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const levelTitle = data ? getLevelTitle(data.level) : 'Seedling'
  const earnedMilestones = MILESTONE_BADGES.filter((m) => (data?.xp ?? 0) >= m.xp)

  return (
    <div className="space-y-8 pb-10">
      {showModal && (
        <AddAwardModal
          onAdd={addAward}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Hero Banner ── */}
      <div className="relative rounded-3xl overflow-hidden p-8"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.12) 50%, rgba(236,72,153,0.08) 100%)',
          border: '1px solid rgba(99,102,241,0.25)',
        }}
      >
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)', transform: 'translate(30%, -30%)' }} />

        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-white font-black text-4xl shadow-2xl"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 40px rgba(99,102,241,0.5)' }}>
              D
            </div>
            {data && (
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white text-sm font-black border-2 border-card shadow">
                {data.level}
              </div>
            )}
          </div>

          {/* Name & title */}
          <div className="text-center sm:text-left">
            <h1 className="text-4xl font-black tracking-tight">Daniel's Award Wall</h1>
            <p className="text-primary font-bold text-lg mt-0.5">{levelTitle}</p>
            <p className="text-muted-foreground text-sm mt-1">
              Every badge earned, every milestone reached — all in one place.
            </p>
          </div>

          {/* Quick stats */}
          {data && (
            <div className="sm:ml-auto flex gap-3 shrink-0 flex-wrap justify-center">
              <StatPill
                icon={<Zap className="w-5 h-5 text-primary" />}
                value={data.xp.toLocaleString()}
                label="Total XP"
                color="border-primary/20 bg-primary/5"
              />
              <StatPill
                icon={<Flame className="w-5 h-5 text-amber-500" />}
                value={`🔥 ${data.streak}`}
                label="Day Streak"
                color="border-amber-500/20 bg-amber-500/5"
              />
              <StatPill
                icon={<Trophy className="w-5 h-5 text-amber-400" />}
                value={`${data.earnedBadges.length}/${data.totalBadges}`}
                label="Badges"
                color="border-amber-400/20 bg-amber-400/5"
              />
            </div>
          )}
        </div>

        {/* XP bar */}
        {data && (
          <div className="relative mt-6">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Level {data.level}</span>
              <span>{data.xpInLevel.toLocaleString()} / {data.xpNeeded.toLocaleString()} XP to Level {data.level + 1}</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${data.progressPct}%`,
                  background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
                  boxShadow: '0 0 10px rgba(99,102,241,0.6)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Earned Badges Trophy Case ── */}
      {data && data.earnedBadges.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-bold">Trophy Case</h2>
            <span className="text-sm text-muted-foreground">
              {data.earnedBadges.length} badge{data.earnedBadges.length !== 1 ? 's' : ''} earned
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {data.earnedBadges.map((badge) => (
              <BadgeTrophy key={badge.id} badge={badge} />
            ))}
          </div>
        </section>
      )}

      {data && data.earnedBadges.length === 0 && (
        <Card className="p-8 text-center space-y-2">
          <p className="text-4xl">🔒</p>
          <p className="font-semibold">No badges yet</p>
          <p className="text-sm text-muted-foreground">Complete quizzes, take notes, and keep your streak to earn your first badge!</p>
        </Card>
      )}

      {/* ── XP Milestone Wall ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Star className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">XP Milestones</h2>
          <span className="text-sm text-muted-foreground">
            {earnedMilestones.length}/{MILESTONE_BADGES.length} reached
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {MILESTONE_BADGES.map((m) => (
            <MilestoneBadge
              key={m.xp}
              milestone={m}
              earned={(data?.xp ?? 0) >= m.xp}
            />
          ))}
        </div>
      </section>

      {/* ── Custom Accomplishments ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-5 h-5 text-secondary" />
            <h2 className="text-xl font-bold">Personal Accomplishments</h2>
          </div>
          <Button
            size="sm"
            onClick={() => setShowModal(true)}
            className="gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Award
          </Button>
        </div>

        {customAwards.length === 0 ? (
          <Card className="p-8 text-center space-y-3 border-dashed">
            <p className="text-4xl">🏅</p>
            <div>
              <p className="font-semibold">Your personal award wall is empty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add real-life accomplishments — aced a test, won a competition, finished a project, mastered a skill.
              </p>
            </div>
            <Button variant="outline" onClick={() => setShowModal(true)} className="gap-2">
              <Plus className="w-3.5 h-3.5" /> Add Your First Award
            </Button>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {customAwards.map((award) => (
              <CustomAwardCard
                key={award.id}
                award={award}
                onDelete={() => deleteAward(award.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Locked badges peek ── */}
      {data && data.totalBadges - data.earnedBadges.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <Medal className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-muted-foreground">
              {data.totalBadges - data.earnedBadges.length} more badges to unlock
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Keep completing quizzes, writing notes, and maintaining your streak to unlock them all.
          </p>
          <Button variant="outline" size="sm" onClick={() => window.location.href = '/dashboard/achievements'}>
            <BookOpen className="w-3.5 h-3.5 mr-2" /> View All Badges
          </Button>
        </section>
      )}
    </div>
  )
}
