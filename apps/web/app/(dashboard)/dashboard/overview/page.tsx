export const dynamic = 'force-dynamic'

import { DANIEL_USER_ID } from '@/lib/user'
import { Sparkles, TrendingUp, BookOpen, MessageSquare, Clock, Brain, Layers, Medal, Flame, ArrowRight, Zap } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { formatDistanceToNow } from 'date-fns'
import { xpToLevel, xpForLevel } from '@/lib/gamification'
import { easternMidnight } from '@/lib/timezone'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLevelTitle(level: number): string {
  const titles: [number, string][] = [
    [20, 'Sage'], [15, 'Prodigy'], [10, 'Star Student'],
    [8, 'Expert'], [5, 'Rising Star'], [3, 'Scholar'], [1, 'Seedling'],
  ]
  return titles.find(([min]) => level >= min)?.[1] ?? 'Seedling'
}

// ─── Stat card ────────────────────────────────────────────────────────────────

type ColorKey = 'blue' | 'purple' | 'green' | 'amber'

const colorTokens: Record<ColorKey, { from: string; to: string; border: string; shadow: string; icon: string }> = {
  blue:   { from: '#3b82f6', to: '#6366f1', border: 'rgba(59,130,246,0.3)',   shadow: '0 8px 32px rgba(59,130,246,0.15)',   icon: 'rgba(59,130,246,0.15)'  },
  purple: { from: '#8b5cf6', to: '#a855f7', border: 'rgba(139,92,246,0.3)',   shadow: '0 8px 32px rgba(139,92,246,0.15)',   icon: 'rgba(139,92,246,0.15)'  },
  green:  { from: '#10b981', to: '#059669', border: 'rgba(16,185,129,0.3)',   shadow: '0 8px 32px rgba(16,185,129,0.15)',   icon: 'rgba(16,185,129,0.15)'  },
  amber:  { from: '#f59e0b', to: '#d97706', border: 'rgba(245,158,11,0.3)',   shadow: '0 8px 32px rgba(245,158,11,0.15)',   icon: 'rgba(245,158,11,0.15)'  },
}

function StatCard({
  icon, title, value, subtitle, href, color,
}: {
  icon: React.ReactNode
  title: string
  value: string
  subtitle: string
  href?: string
  color: ColorKey
}) {
  const t = colorTokens[color]

  const inner = (
    <div
      className="rounded-2xl p-5 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5"
      style={{
        background: `linear-gradient(145deg, ${t.from}18, ${t.to}0c)`,
        border: `1px solid ${t.border}`,
        boxShadow: t.shadow,
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        style={{ background: t.icon }}
      >
        {icon}
      </div>
      <p className="text-3xl font-black leading-none mb-1 text-foreground">{value}</p>
      <p className="text-sm font-semibold text-foreground/80">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  )

  return href ? <Link href={href}>{inner}</Link> : inner
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const userId = DANIEL_USER_ID

  const [noteCount, sessionCount, recentNotes, learningProfile, flashcardsDue] = await Promise.all([
    db.note.count({ where: { userId } }),
    db.tutorSession.count({ where: { userId } }),
    db.note.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 4,
      select: { id: true, title: true, subject: true, updatedAt: true, tags: true },
    }),
    db.learningProfile.findUnique({
      where: { userId },
      select: { masteryScores: true, weakAreas: true, strongAreas: true, xp: true, level: true },
    }),
    db.flashcard.count({ where: { userId, nextReviewAt: { lte: new Date() } } }),
  ])

  // Streak — Eastern calendar dates so midnight rolls at Eastern time
  const allActivity = await db.$queryRaw<{ day: Date }[]>`
    SELECT DISTINCT DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') AS day FROM "TutorSession" WHERE "userId" = ${userId}
    UNION
    SELECT DISTINCT DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') AS day FROM "Note" WHERE "userId" = ${userId}
    ORDER BY day DESC LIMIT 60
  `
  let streak = 0
  const todayDate = easternMidnight()
  for (let i = 0; i < allActivity.length; i++) {
    const exp = new Date(todayDate); exp.setDate(todayDate.getDate() - i)
    if (easternMidnight(new Date(allActivity[i].day)).getTime() === exp.getTime()) streak++
    else break
  }

  const masteryEntries = Object.entries(
    (learningProfile?.masteryScores as Record<string, number>) ?? {}
  ).sort(([, a], [, b]) => b - a).slice(0, 4)

  // Use Eastern hour so the greeting reflects Daniel's local time of day
  const hour = parseInt(new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }), 10)
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const greetEmoji = hour < 12 ? '🌅' : hour < 18 ? '☀️' : '🌙'

  // XP / level
  const xp = learningProfile?.xp ?? 0
  const level = learningProfile?.level ?? xpToLevel(xp)
  const levelTitle = getLevelTitle(level)
  const levelStart = xpForLevel(level)
  const levelEnd = xpForLevel(level + 1)
  const xpPct = Math.min(Math.round(((xp - levelStart) / (levelEnd - levelStart)) * 100), 100)

  // Focus tasks
  const masteryScores = (learningProfile?.masteryScores as Record<string, number>) ?? {}
  const activityToday = allActivity.length > 0 &&
    easternMidnight(new Date(allActivity[0].day)).getTime() === todayDate.getTime()

  const focusTasks: { emoji: string; text: string; href: string; urgent?: boolean }[] = []
  if (flashcardsDue > 0) {
    focusTasks.push({ emoji: '🃏', text: `Review ${flashcardsDue} flashcard${flashcardsDue > 1 ? 's' : ''} due today`, href: '/dashboard/flashcards', urgent: true })
  }
  const weakest = Object.entries(masteryScores).sort(([, a], [, b]) => a - b)[0]
  if (weakest) {
    focusTasks.push({ emoji: '🧠', text: `Boost ${weakest[0]} — currently ${Math.round(weakest[1] * 100)}%`, href: `/dashboard/quiz?topic=${encodeURIComponent(weakest[0])}&subject=${encodeURIComponent(weakest[0])}` })
  }
  if (streak > 0 && !activityToday) {
    focusTasks.push({ emoji: '🔥', text: `Protect your ${streak}-day streak — chat or write a note!`, href: '/dashboard/chat', urgent: true })
  }
  if (focusTasks.length === 0) {
    focusTasks.push({ emoji: '📚', text: "Check today's personalised learning feed", href: '/dashboard/feed' })
  }

  // Mastery color
  const masteryColor = (s: number) =>
    s >= 0.85 ? '#10b981' : s >= 0.65 ? '#6366f1' : s >= 0.45 ? '#f59e0b' : '#ef4444'

  // Note card palette
  const notePalette = [
    { from: '#6366f1', to: '#8b5cf6' },
    { from: '#0ea5e9', to: '#6366f1' },
    { from: '#10b981', to: '#0ea5e9' },
    { from: '#f59e0b', to: '#ef4444' },
  ]

  return (
    <div className="space-y-7">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-muted-foreground mb-1">{greetEmoji} {greeting}</p>
          <h1 className="text-4xl font-black tracking-tight">
            <span className="text-foreground">Hey, </span>
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Daniel
            </span>
            <span className="text-foreground"> 👋</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            {streak > 0
              ? <><span className="text-amber-500 font-semibold">🔥 {streak}-day streak!</span> Keep the momentum going.</>
              : 'Ready to learn something amazing today?'}
          </p>
        </div>
        <Link href="/dashboard/chat">
          <button
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}
          >
            <Sparkles className="w-4 h-4" />
            Ask AI Tutor
          </button>
        </Link>
      </div>

      {/* ── Focus tasks ─────────────────────────────────────────────── */}
      {focusTasks.length > 0 && (
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.04))',
            border: '1px solid rgba(99,102,241,0.15)',
          }}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            Today&apos;s Focus
          </p>
          <div className="flex flex-col gap-2">
            {focusTasks.map((task, i) => (
              <Link key={i} href={task.href}>
                <div
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.01]"
                  style={
                    task.urgent
                      ? { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: 'inherit' }
                      : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'inherit' }
                  }
                >
                  <span className="text-lg shrink-0">{task.emoji}</span>
                  <span className="flex-1 text-foreground/90">{task.text}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<BookOpen className="w-5 h-5 text-blue-400" />}   title="Notes"     value={String(noteCount)}    subtitle="Total created"                           href="/dashboard/notes"         color="blue"   />
        <StatCard icon={<MessageSquare className="w-5 h-5 text-violet-400" />} title="Sessions" value={String(sessionCount)} subtitle="AI chats"                               href="/dashboard/chat"          color="purple" />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}   title="Streak"   value={streak > 0 ? `🔥 ${streak}` : '—'}  subtitle="Days active"              color="green"  />
        <StatCard icon={<Layers className="w-5 h-5 text-amber-400" />}    title="Cards Due" value={flashcardsDue > 0 ? String(flashcardsDue) : '✓'} subtitle={flashcardsDue > 0 ? 'Review now!' : 'All caught up'} href={flashcardsDue > 0 ? '/dashboard/flashcards' : undefined} color="amber" />
      </div>

      {/* ── XP / Level ──────────────────────────────────────────────── */}
      <Link href="/dashboard/achievements">
        <div
          className="rounded-2xl p-5 transition-all hover:scale-[1.005] cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.06))',
            border: '1px solid rgba(99,102,241,0.2)',
            boxShadow: '0 4px 24px rgba(99,102,241,0.1)',
          }}
        >
          <div className="flex items-center gap-4">
            {/* Level orb */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shrink-0"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 0 24px rgba(99,102,241,0.5)',
              }}
            >
              {level}
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-black text-lg leading-none">Level {level}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
                    {levelTitle}
                  </span>
                  {streak > 0 && (
                    <span className="flex items-center gap-0.5 text-xs font-bold text-amber-400">
                      <Flame className="w-3 h-3" /> {streak}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Medal className="w-3 h-3" /> View achievements →
                </span>
              </div>

              <div className="w-full rounded-full overflow-hidden h-2.5" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${xpPct}%`,
                    background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
                    boxShadow: '0 0 10px rgba(99,102,241,0.6)',
                  }}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                {(xp - levelStart).toLocaleString()} / {(levelEnd - levelStart).toLocaleString()} XP to level {level + 1}
                <span className="ml-2 text-primary font-semibold">{xp.toLocaleString()} total</span>
              </p>
            </div>
          </div>
        </div>
      </Link>

      {/* ── Main grid: AI Tutor + Quick Start ─────────────────────── */}
      <div className="grid md:grid-cols-3 gap-5">
        {/* AI Tutor CTA */}
        <div
          className="md:col-span-2 rounded-2xl p-6 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))',
            border: '1px solid rgba(99,102,241,0.22)',
          }}
        >
          {/* Decorative glow */}
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />

          <div className="relative flex items-start gap-4 mb-5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}
            >
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black">AI Tutor</h2>
              <p className="text-sm text-muted-foreground">Powered by Gemini · Grounded in your notes</p>
            </div>
          </div>

          <p className="text-muted-foreground text-sm mb-5 leading-relaxed relative">
            Ask anything — math, coding, science, language. The AI uses your own notes as context to give you personalised, grounded answers.
          </p>

          <div className="relative flex gap-3">
            <Link href="/dashboard/chat" className="flex-1">
              <button
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}
              >
                <Sparkles className="w-4 h-4" />
                Start Chatting
              </button>
            </Link>
            <Link href="/dashboard/notes">
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'inherit' }}>
                <BookOpen className="w-4 h-4" />
                Notes
              </button>
            </Link>
          </div>
        </div>

        {/* Quick Start */}
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="text-base font-black mb-4">Quick Start</h2>
          <div className="space-y-2">
            {[
              { href: '/dashboard/chat',        label: 'AI Tutor',    emoji: '🤖', color: 'rgba(139,92,246,0.15)',  border: 'rgba(139,92,246,0.25)' },
              { href: '/dashboard/quiz',        label: 'Take a Quiz', emoji: '🏆', color: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.22)' },
              { href: '/dashboard/flashcards',  label: 'Flashcards',  emoji: '🃏', color: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.22)'  },
              { href: '/dashboard/analytics',   label: 'My Progress', emoji: '📊', color: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.22)' },
            ].map(({ href, label, emoji, color, border }) => (
              <Link key={label} href={href}>
                <div
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] cursor-pointer"
                  style={{ background: color, border: `1px solid ${border}` }}
                >
                  <span className="text-base">{emoji}</span>
                  <span className="text-foreground">{label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mastery ─────────────────────────────────────────────────── */}
      {masteryEntries.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-black flex items-center gap-2">
              <Brain className="w-4 h-4 text-pink-400" />
              Subject Mastery
            </h2>
            <Link href="/dashboard/analytics">
              <span className="text-xs font-semibold text-primary hover:underline">View all →</span>
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {masteryEntries.map(([subject, score]) => {
              const pct = Math.round(score * 100)
              const color = masteryColor(score)
              const label = pct >= 85 ? 'Mastered' : pct >= 65 ? 'Proficient' : pct >= 45 ? 'Developing' : 'Learning'
              return (
                <div key={subject}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold capitalize">{subject}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold" style={{ color }}>{label}</span>
                      <span className="text-sm font-black" style={{ color }}>{pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}99)`, boxShadow: `0 0 8px ${color}50` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Recent Notes ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black">Recent Notes</h2>
          <Link href="/dashboard/notes">
            <span className="text-sm font-semibold text-primary hover:underline">View all →</span>
          </Link>
        </div>

        {recentNotes.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p className="text-4xl mb-3">📝</p>
            <p className="text-muted-foreground mb-4">No notes yet — create your first one!</p>
            <Link href="/dashboard/notes">
              <button className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
                style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
                <BookOpen className="w-4 h-4" /> Create Note
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {recentNotes.map((note, i) => {
              const { from, to } = notePalette[i % notePalette.length]
              return (
                <Link key={note.id} href="/dashboard/notes">
                  <div
                    className="rounded-2xl p-4 h-full cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 group"
                    style={{
                      background: `linear-gradient(145deg, ${from}1a, ${to}10)`,
                      border: `1px solid ${from}35`,
                      boxShadow: `0 4px 20px ${from}15`,
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg mb-3 flex items-center justify-center font-black text-white text-xs"
                      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                    >
                      {note.title[0]?.toUpperCase() ?? '?'}
                    </div>
                    <p className="font-bold text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                      {note.title}
                    </p>
                    {note.subject && (
                      <span
                        className="te