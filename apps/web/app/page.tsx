import Link from 'next/link'
import { db } from '@/lib/db'
import { DANIEL_USER_ID } from '@/lib/user'
import { xpToLevel, xpForLevel, BADGES } from '@/lib/gamification'
import { formatDistanceToNow } from 'date-fns'
import { ArrowRight, Sparkles, Flame } from 'lucide-react'

export const dynamic = 'force-dynamic'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLevelTitle(level: number): string {
  const titles: [number, string][] = [
    [20, 'Sage'], [15, 'Prodigy'], [10, 'Star Student'],
    [8, 'Expert'], [5, 'Rising Star'], [3, 'Scholar'], [1, 'Seedling'],
  ]
  return titles.find(([min]) => level >= min)?.[1] ?? 'Seedling'
}

function masteryColor(score: number): string {
  if (score >= 0.85) return '#10b981'
  if (score >= 0.65) return '#6366f1'
  if (score >= 0.45) return '#f59e0b'
  return '#ef4444'
}

// ─── Glowing orb ─────────────────────────────────────────────────────────────

function GlowOrb({ level }: { level: number }) {
  return (
    <div className="relative w-72 h-72 sm:w-96 sm:h-96 flex items-center justify-center">
      {/* Outer slow-rotating ring */}
      <div
        className="absolute inset-0 rounded-full animate-orb-rotate"
        style={{
          background: 'conic-gradient(from 0deg, transparent 60%, rgba(99,102,241,0.6) 80%, transparent 100%)',
          padding: '2px',
        }}
      >
        <div className="w-full h-full rounded-full" style={{ background: '#060810' }} />
      </div>

      {/* Second faster counter-rotating ring */}
      <div
        className="absolute rounded-full animate-orb-rotate"
        style={{
          inset: '12px',
          background: 'conic-gradient(from 180deg, transparent 50%, rgba(139,92,246,0.5) 75%, transparent 100%)',
          animationDuration: '12s',
          animationDirection: 'reverse',
        }}
      >
        <div className="w-full h-full rounded-full" style={{ background: '#060810' }} />
      </div>

      {/* Glow halo */}
      <div
        className="absolute rounded-full animate-glow-pulse"
        style={{
          inset: '24px',
          background: 'radial-gradient(circle at 40% 40%, rgba(139,92,246,0.8) 0%, rgba(99,102,241,0.6) 35%, rgba(30,27,75,0.9) 70%, transparent 100%)',
        }}
      />

      {/* Inner bright core */}
      <div
        className="absolute rounded-full animate-orb-pulse"
        style={{
          inset: '48px',
          background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.9) 0%, rgba(167,139,250,0.8) 20%, rgba(99,102,241,0.4) 50%, transparent 80%)',
          boxShadow: '0 0 60px 20px rgba(99,102,241,0.5), inset 0 0 30px rgba(255,255,255,0.2)',
        }}
      />

      {/* Level text */}
      <div className="relative z-10 text-center select-none">
        <div className="text-5xl sm:text-6xl font-black text-white"
          style={{ textShadow: '0 0 30px rgba(255,255,255,0.8)' }}>
          {level}
        </div>
        <div className="text-xs font-bold tracking-[0.2em] text-indigo-300 uppercase mt-1">
          {getLevelTitle(level)}
        </div>
      </div>

      {/* Orbiting dot */}
      <div
        className="absolute w-3 h-3 rounded-full animate-orb-rotate"
        style={{
          background: '#a5b4fc',
          boxShadow: '0 0 12px 4px rgba(165,180,252,0.8)',
          top: '8px', left: '50%', marginLeft: '-6px',
          transformOrigin: '6px 136px',
          animationDuration: '6s',
        }}
      />
    </div>
  )
}

// ─── Floating note card ───────────────────────────────────────────────────────

function NoteCard({
  title, subject, tags, rotate, delay, colorFrom, colorTo, zIndex,
}: {
  title: string; subject?: string | null; tags: string[]
  rotate: string; delay: string; colorFrom: string; colorTo: string; zIndex: number
}) {
  return (
    <div
      className="animate-float absolute w-48 sm:w-56 rounded-2xl p-4 cursor-default select-none"
      style={{
        '--card-rotate': rotate,
        transform: `rotate(${rotate})`,
        animationDelay: delay,
        background: `linear-gradient(135deg, ${colorFrom}dd, ${colorTo}cc)`,
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        zIndex,
      } as React.CSSProperties}
    >
      <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center mb-3">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <p className="text-white font-bold text-sm leading-snug line-clamp-2 mb-2">{title}</p>
      {subject && <p className="text-white/70 text-xs font-medium">{subject}</p>}
      {tags.slice(0, 2).map((t) => (
        <span key={t}
          className="inline-block text-[10px] bg-white/15 text-white/80 px-2 py-0.5 rounded-full mt-1 mr-1">
          {t}
        </span>
      ))}
    </div>
  )
}

// ─── Badge chip ───────────────────────────────────────────────────────────────

function BadgeChip({ emoji, name }: { emoji: string; name: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
      style={{
        background: 'rgba(99,102,241,0.15)',
        border: '1px solid rgba(99,102,241,0.3)',
        color: '#e0e7ff',
      }}>
      <span className="text-base">{emoji}</span>
      {name}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const userId = DANIEL_USER_ID
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const [recentNotes, notesToday, totalNotes, profile, earnedBadges, sessions] = await Promise.all([
    db.note.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: { id: true, title: true, subject: true, tags: true, createdAt: true, content: true },
    }),
    db.note.count({ where: { userId, createdAt: { gte: today } } }),
    db.note.count({ where: { userId } }),
    db.learningProfile.findUnique({
      where: { userId },
      select: { xp: true, level: true, currentStreak: true, longestStreak: true, masteryScores: true, strongAreas: true },
    }),
    db.userBadge.findMany({
      where: { userId },
      orderBy: { earnedAt: 'desc' },
      take: 8,
      select: { badgeId: true },
    }),
    db.tutorSession.count({ where: { userId } }),
  ])

  // Recalculate streak from raw activity
  const allActivity = await db.$queryRaw<{ day: Date }[]>`
    SELECT DISTINCT DATE("createdAt") AS day FROM "TutorSession" WHERE "userId" = ${userId}
    UNION
    SELECT DISTINCT DATE("createdAt") AS day FROM "Note" WHERE "userId" = ${userId}
    ORDER BY day DESC LIMIT 60
  `
  let streak = 0
  for (let i = 0; i < allActivity.length; i++) {
    const exp = new Date(today); exp.setDate(today.getDate() - i)
    if (new Date(allActivity[i].day).toDateString() === exp.toDateString()) streak++
    else break
  }

  const xp = profile?.xp ?? 0
  const level = profile?.level ?? xpToLevel(xp)
  const levelStart = xpForLevel(level)
  const levelEnd   = xpForLevel(level + 1)
  const xpPct      = Math.min(Math.round(((xp - levelStart) / (levelEnd - levelStart)) * 100), 100)

  const masteryEntries = Object.entries(
    (profile?.masteryScores as Record<string, number>) ?? {}
  ).sort(([, a], [, b]) => b - a).slice(0, 4)

  const earnedBadgeDefs = earnedBadges
    .map((r) => BADGES.find((b) => b.id === r.badgeId))
    .filter(Boolean) as typeof BADGES

  const CARD_CONFIGS = [
    { rotate: '-8deg', delay: '0s',   colorFrom: '#6366f1', colorTo: '#8b5cf6', left: '-4%', top: '10%', zIndex: 2 },
    { rotate:  '5deg', delay: '1.2s', colorFrom: '#0ea5e9', colorTo: '#6366f1', left:  '5%', top: '40%', zIndex: 1 },
    { rotate: '-4deg', delay: '0.7s', colorFrom: '#10b981', colorTo: '#0ea5e9', left: '12%', top: '62%', zIndex: 3 },
    { rotate:  '7deg', delay: '2s',   colorFrom: '#f59e0b', colorTo: '#ef4444', left: '-6%', top: '74%', zIndex: 2 },
  ]

  return (
    <main className="min-h-screen font-display" style={{ background: '#060810', color: '#f1f5f9' }}>

      {/* ── Background layers ──────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute inset-0" style={{ background: '#060810' }} />
        <div className="absolute" style={{
          top: '-20%', left: '-10%', width: '60%', height: '70%',
          background: 'radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)',
        }} />
        <div className="absolute" style={{
          bottom: '-10%', right: '-5%', width: '50%', height: '60%',
          background: 'radial-gradient(ellipse, rgba(139,92,246,0.1) 0%, transparent 70%)',
        }} />
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.7) 100%)',
        }} />
      </div>

      {/* ── Nav ────────────────────────────────────────────────────── */}
      <nav className="relative z-50 flex items-center justify-between px-6 sm:px-12 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-black tracking-tight text-white">CogniBloom</span>
        </div>
        <Link href="/dashboard">
          <button
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 20px rgba(99,102,241,0.4)', color: 'white' }}
          >
            Enter App <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative z-10 min-h-[90vh] flex items-center">
        <div className="w-full px-6 sm:px-12 xl:px-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left */}
            <div className="space-y-8 max-w-xl">
              {streak > 0 && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
                  style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', color: '#fcd34d' }}>
                  <span className="animate-streak">🔥</span>
                  {streak}-day streak — keep it going!
                </div>
              )}

              <div>
                <h1 className="font-black leading-[1.05] tracking-tight"
                  style={{ fontSize: 'clamp(2.6rem, 6vw, 5rem)' }}>
                  <span className="text-white">Keep Learning,</span><br />
                  <span className="text-shimmer">Daniel.</span>
                </h1>
                <p className="mt-5 text-lg leading-relaxed max-w-md" style={{ color: '#64748b' }}>
                  Your personal AI tutor, notes, quizzes and flashcards — all in one place.
                  Level up your knowledge every single day.
                </p>
              </div>

              {/* Quick stats */}
              <div className="flex flex-wrap gap-4">
                {[
                  { value: totalNotes,          label: 'Notes written',  color: '#6366f1' },
                  { value: sessions,             label: 'AI sessions',   color: '#8b5cf6' },
                  { value: earnedBadgeDefs.length, label: 'Badges earned', color: '#f59e0b' },
                ].map(({ value, label, color }) => (
                  <div key={label} className="text-center px-5 py-3 rounded-2xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="text-2xl font-black" style={{ color }}>{value}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#475569' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard">
                  <button
                    className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 8px 32px rgba(99,102,241,0.45)', fontSize: '1rem' }}>
                    Open Dashboard <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
                <Link href="/dashboard/achievements">
                  <button
                    className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', fontSize: '1rem' }}>
                    My Achievements ✨
                  </button>
                </Link>
              </div>
            </div>

            {/* Right: orb + floating cards */}
            <div className="relative h-[440px] sm:h-[560px] flex items-center justify-center">
              <GlowOrb level={level} />
              {recentNotes.slice(0, 4).map((note, i) => {
                const cfg = CARD_CONFIGS[i]
                return (
                  <div key={note.id} className="absolute" style={{ left: cfg.left, top: cfg.top, zIndex: cfg.zIndex }}>
                    <NoteCard
                      title={note.title} subject={note.subject} tags={note.tags}
                      rotate={cfg.rotate} delay={cfg.delay}
                      colorFrom={cfg.colorFrom} colorTo={cfg.colorTo} zIndex={cfg.zIndex}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Today's activity bar ────────────────────────────────────── */}
      <section className="relative z-10 px-6 sm:px-12 xl:px-20 py-6">
        <div className="rounded-2xl p-6 flex flex-wrap gap-6 items-center justify-between"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.2)' }}>
              <span className="text-lg">📅</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#475569' }}>Today</p>
              <p className="text-white font-bold">
                {notesToday === 0
                  ? "No notes yet today — start writing! 📝"
                  : `${notesToday} note${notesToday > 1 ? 's' : ''} written today`}
              </p>
            </div>
          </div>

          <div className="flex-1 min-w-[200px] max-w-xs">
            <div className="flex justify-between text-xs mb-2" style={{ color: '#475569' }}>
              <span>Level {level} · {getLevelTitle(level)}</span>
              <span>{xp - levelStart} / {levelEnd - levelStart} XP</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full"
                style={{ width: `${xpPct}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)', boxShadow: '0 0 8px rgba(99,102,241,0.6)' }} />
            </div>
            <p className="text-xs mt-1" style={{ color: '#334155' }}>{xp.toLocaleString()} total XP</p>
          </div>

          <Link href="/dashboard/chat">
            <button className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }}>
              Start AI Tutor →
            </button>
          </Link>
        </div>
      </section>

      {/* ── Recent notes ────────────────────────────────────────────── */}
      {recentNotes.length > 0 && (
        <section className="relative z-10 px-6 sm:px-12 xl:px-20 py-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-white">Recent Notes</h2>
              <p className="text-sm mt-0.5" style={{ color: '#475569' }}>Your latest thoughts and learning</p>
            </div>
            <Link href="/dashboard/notes"
              className="text-sm font-semibold transition-colors"
              style={{ color: '#818cf8' }}>
              View all →
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentNotes.map((note, i) => {
              const palette = [
                { from: '#6366f1', to: '#8b5cf6' },
                { from: '#0ea5e9', to: '#6366f1' },
                { from: '#10b981', to: '#0ea5e9' },
                { from: '#f59e0b', to: '#ef4444' },
              ]
              const { from, to } = palette[i % palette.length]
              const preview = note.content.replace(/[#*`\[\]]/g, '').slice(0, 80)
              return (
                <Link key={note.id} href="/dashboard/notes">
                  <div className="rounded-2xl p-5 h-full cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 group"
                    style={{
                      background: `linear-gradient(145deg, ${from}22, ${to}18)`,
                      border: `1px solid ${from}40`,
                      boxShadow: `0 4px 24px ${from}20`,
                    }}>
                    <div className="w-8 h-8 rounded-lg mb-3 flex items-center justify-center font-black text-white text-xs"
                      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
                      {note.title[0].toUpperCase()}
                    </div>
                    <p className="font-bold text-white text-sm line-clamp-2 mb-2 group-hover:text-indigo-200 transition-colors">
                      {note.title}
                    </p>
                    {preview && (
                      <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: '#475569' }}>{preview}…</p>
                    )}
                    <div className="flex items-center justify-between mt-4">
                      {note.subject && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-lg"
                          style={{ background: `${from}30`, color: from }}>
                          {note.subject}
                        </span>
                      )}
                      <span className="text-[10px] ml-auto" style={{ color: '#334155' }}>
                        {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Achievements + Mastery ─────────────────────────────────── */}
      <section className="relative z-10 px-6 sm:px-12 xl:px-20 py-8">
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Achievements card */}
          <div className="rounded-2xl p-7"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl text-white"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 8px 24px rgba(99,102,241,0.45)' }}>
                  {level}
                </div>
                {streak > 0 && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: '#f59e0b' }}>
                    <Flame className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-xl font-black text-white">Level {level} — {getLevelTitle(level)}</p>
                <p className="text-sm" style={{ color: '#475569' }}>{xp.toLocaleString()} XP · {streak} day streak</p>
              </div>
            </div>

            {/* XP bar */}
            <div className="mb-6">
              <div className="flex justify-between text-xs mb-2" style={{ color: '#334155' }}>
                <span>Progress to level {level + 1}</span>
                <span>{xpPct}%</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${xpPct}%`, background: 'linear-gradient(90deg, #6366f1, #a78bfa)', boxShadow: '0 0 12px rgba(99,102,241,0.5)' }} />
              </div>
            </div>

            {earnedBadgeDefs.length > 0 ? (
              <>
                <p className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: '#475569' }}>
                  {earnedBadgeDefs.length} / {BADGES.length} badges earned
                </p>
                <div className="flex flex-wrap gap-2">
                  {earnedBadgeDefs.map((b) => <BadgeChip key={b.id} emoji={b.emoji} name={b.name} />)}
                </div>
              </>
            ) : (
              <p className="text-sm" style={{ color: '#334155' }}>
                Complete quizzes, write notes, and chat to earn your first badge!
              </p>
            )}

            <Link href="/dashboard/achievements">
              <button className="mt-5 w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
                View all achievements →
              </button>
            </Link>
          </div>

          {/* Mastery card */}
          <div className="rounded-2xl p-7"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <h3 className="text-lg font-black text-white mb-1">Subject Mastery</h3>
            <p className="text-sm mb-6" style={{ color: '#475569' }}>Based on your quiz performance</p>

            {masteryEntries.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-4xl mb-3">🎯</p>
                <p className="text-sm" style={{ color: '#475569' }}>Take quizzes to track your mastery!</p>
                <Link href="/dashboard/quiz">
                  <button className="mt-4 px-5 py-2 rounded-xl text-sm font-bold"
                    style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
                    Take a Quiz →
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-5">
                {masteryEntries.map(([subject, score]) => {
                  const pct = Math.round(score * 100)
                  const color = masteryColor(score)
                  const label = pct >= 85 ? 'Mastered' : pct >= 65 ? 'Proficient' : pct >= 45 ? 'Developing' : 'Learning'
                  return (
                    <div key={subject}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-white capitalize text-sm">{subject}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium" style={{ color }}>{label}</span>
                          <span className="text-sm font-black text-white">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)`, boxShadow: `0 0 8px ${color}60` }} />
                      </div>
                    </div>
                  )
                })}
                {profile?.strongAreas && profile.strongAreas.length > 0 && (
                  <div className="pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <p className="text-xs mb-2" style={{ color: '#475569' }}>💪 Strong areas</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.strongAreas.map((a) => (
                        <span key={a} className="text-xs px-2.5 py-1 rounded-full capitalize"
                          style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 sm:px-12 xl:px-20 py-16 text-center">
        <div className="max-w-2xl mx-auto rounded-3xl p-10"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
            border: '1px solid rgba(99,102,241,0.25)',
            boxShadow: '0 0 80px rgba(99,102,241,0.1)',
          }}>
          <p className="text-4xl mb-4">🌱</p>
          <h2 className="text-3xl font-black text-white mb-3">Ready to bloom?</h2>
          <p className="mb-8" style={{ color: '#64748b' }}>
            Every note, every quiz, every session — it all adds up.
            Your future self will thank you.
          </p>
          <Link href="/dashboard">
            <button
              className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl font-black text-white text-lg transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 8px 40px rgba(99,102,241,0.5)' }}>
              Enter CogniBloom <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="relative z-10 text-center py-8 px-6 text-xs border-t"
        style={{ color: '#334155', borderColor: 'rgba(255,255,255,0.05)' }}>
        <p>Dedicated to <span style={{ color: '#818cf8' }}>Daniel</span> — curiosity is your superpower. Keep blooming. 🌱</p>
        <p className="mt-1">© 2026 CogniBloom. Built with love to fuel great minds.</p>
      </footer>
    </main>
  )
}
