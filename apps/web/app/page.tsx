import Link from 'next/link'
import { db } from '@/lib/db'
import { DANIEL_USER_ID } from '@/lib/user'
import { xpToLevel, xpForLevel } from '@/lib/gamification'
import { ArrowRight, Sparkles } from 'lucide-react'

export const dynamic = 'force-dynamic'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLevelTitle(level: number): string {
  const titles: [number, string][] = [
    [20, 'Sage'], [15, 'Prodigy'], [10, 'Star Student'],
    [8, 'Expert'], [5, 'Rising Star'], [3, 'Scholar'], [1, 'Seedling'],
  ]
  return titles.find(([min]) => level >= min)?.[1] ?? 'Seedling'
}

// ─── CSS 3D Gyroscope Orb ─────────────────────────────────────────────────────

function GyroscopeOrb({ level, title }: { level: number; title: string }) {
  const ring = (cls: string, size: number, color: string, glow: string, width = 1.5) => ({
    className: cls,
    style: {
      position: 'absolute' as const,
      width: size,
      height: size,
      top: '50%',
      left: '50%',
      marginLeft: -size / 2,
      marginTop: -size / 2,
      borderRadius: '50%',
      border: `${width}px solid ${color}`,
      boxShadow: glow,
    },
  })

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: 420, height: 420, perspective: '700px' }}
    >
      {/* Ambient glow behind the orb */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 65% 65% at 50% 50%, rgba(99,102,241,0.22) 0%, rgba(139,92,246,0.08) 45%, transparent 70%)',
          filter: 'blur(8px)',
        }}
      />

      {/* 3D scene */}
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Outer ring — near-horizontal, slow */}
        <div
          {...ring('gyro-outer', 340, 'rgba(99,102,241,0.72)', '0 0 28px rgba(99,102,241,0.4), inset 0 0 10px rgba(99,102,241,0.08)')}
        />

        {/* Mid ring — medium tilt */}
        <div
          {...ring('gyro-mid', 250, 'rgba(139,92,246,0.65)', '0 0 18px rgba(139,92,246,0.32)')}
        />

        {/* Inner ring — near-vertical */}
        <div
          {...ring('gyro-inner', 168, 'rgba(165,180,252,0.55)', '0 0 14px rgba(165,180,252,0.25)', 1)}
        />

        {/* Vertical ring — spins on Y */}
        <div
          {...ring('gyro-vert', 286, 'rgba(99,102,241,0.38)', '0 0 10px rgba(99,102,241,0.15)', 1)}
        />

        {/* Orbit dot — traces the outer ring's plane */}
        <div
          className="orbit-dot"
          style={{
            position: 'absolute',
            width: 10,
            height: 10,
            top: '50%',
            left: '50%',
            marginLeft: -5,
            marginTop: -5,
            borderRadius: '50%',
            background: '#a5b4fc',
            boxShadow: '0 0 18px 7px rgba(165,180,252,0.75)',
          }}
        />

        {/* Core glowing sphere */}
        <div
          className="animate-core"
          style={{
            position: 'absolute',
            width: 92,
            height: 92,
            top: '50%',
            left: '50%',
            marginLeft: -46,
            marginTop: -46,
            borderRadius: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              'radial-gradient(circle at 35% 32%, rgba(255,255,255,0.95) 0%, rgba(196,181,253,0.85) 18%, rgba(99,102,241,0.55) 50%, rgba(17,12,50,0.92) 85%)',
            boxShadow:
              '0 0 55px 20px rgba(99,102,241,0.6), 0 0 110px 40px rgba(99,102,241,0.18), inset 0 1px 0 rgba(255,255,255,0.35)',
          }}
        >
          <span
            style={{
              fontSize: 30,
              fontWeight: 900,
              color: 'white',
              lineHeight: 1,
              textShadow: '0 0 24px rgba(255,255,255,0.95)',
              fontFamily: 'inherit',
            }}
          >
            {level}
          </span>
          <span
            style={{
              fontSize: 7.5,
              fontWeight: 700,
              letterSpacing: '0.18em',
              color: '#c4b5fd',
              textTransform: 'uppercase',
              marginTop: 3,
            }}
          >
            {title.slice(0, 7)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Floating note card ───────────────────────────────────────────────────────

function FloatingCard({
  title,
  subject,
  rotate,
  delay,
  colorFrom,
  colorTo,
}: {
  title: string
  subject?: string | null
  rotate: string
  delay: string
  colorFrom: string
  colorTo: string
}) {
  return (
    <div
      className="animate-float w-44 rounded-2xl p-4 select-none pointer-events-none"
      style={
        {
          '--card-rotate': rotate,
          transform: `rotate(${rotate})`,
          animationDelay: delay,
          background: `linear-gradient(135deg, ${colorFrom}f0, ${colorTo}cc)`,
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow:
            '0 24px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
        } as React.CSSProperties
      }
    >
      <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center mb-2.5">
        <Sparkles className="w-3 h-3 text-white" />
      </div>
      <p className="text-white font-bold text-xs leading-snug line-clamp-2 mb-1.5">
        {title}
      </p>
      {subject && (
        <p className="text-white/55 text-[10px] font-semibold">{subject}</p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const userId = DANIEL_USER_ID

  const [recentNotes, totalNotes, profile, earnedBadges, sessions] =
    await Promise.all([
      db.note.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, title: true, subject: true },
      }),
      db.note.count({ where: { userId } }),
      db.learningProfile.findUnique({
        where: { userId },
        select: { xp: true, level: true, currentStreak: true },
      }),
      db.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
      db.tutorSession.count({ where: { userId } }),
    ])

  const xp = profile?.xp ?? 0
  const level = profile?.level ?? xpToLevel(xp)
  const streak = profile?.currentStreak ?? 0
  const title = getLevelTitle(level)
  const levelStart = xpForLevel(level)
  const levelEnd = xpForLevel(level + 1)
  const xpPct = Math.min(
    Math.round(((xp - levelStart) / (levelEnd - levelStart)) * 100),
    100,
  )

  return (
    <main
      className="min-h-screen font-display overflow-x-hidden"
      style={{ background: '#060810', color: '#f1f5f9' }}
    >
      {/* ── Background layers ──────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        {/* Deep base */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 90% 70% at 50% -5%, rgba(30,27,75,0.85) 0%, #060810 65%)',
          }}
        />
        {/* Left nebula */}
        <div
          className="absolute"
          style={{
            top: '0%',
            left: '-20%',
            width: '65%',
            height: '80%',
            background:
              'radial-gradient(ellipse, rgba(99,102,241,0.11) 0%, transparent 70%)',
          }}
        />
        {/* Right nebula */}
        <div
          className="absolute"
          style={{
            top: '5%',
            right: '-15%',
            width: '55%',
            height: '75%',
            background:
              'radial-gradient(ellipse, rgba(139,92,246,0.09) 0%, transparent 70%)',
          }}
        />
        {/* Fine dot grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(99,102,241,0.25) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
            opacity: 0.35,
          }}
        />
        {/* Grain texture */}
        <div
          className="grain-layer absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
          }}
        />
        {/* Edge vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 55%, transparent 35%, rgba(0,0,0,0.65) 100%)',
          }}
        />
      </div>

      {/* ── Nav ────────────────────────────────────────────────────── */}
      <nav
        className="relative z-50 flex items-center justify-between px-6 sm:px-12 py-5"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 0 16px rgba(99,102,241,0.5)',
            }}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-black tracking-tight text-white">
            CogniBloom
          </span>
        </div>
        <Link href="/dashboard">
          <button
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 0 20px rgba(99,102,241,0.4)',
              color: 'white',
            }}
          >
            Enter App <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section
        className="relative z-10 flex items-center"
        style={{ minHeight: 'calc(100vh - 78px)' }}
      >
        <div className="w-full px-6 sm:px-12 xl:px-20 py-10">
          <div className="grid lg:grid-cols-2 gap-10 xl:gap-16 items-center">

            {/* ── Left: text content ── */}
            <div className="space-y-8 max-w-xl">

              {/* Streak pill */}
              {streak > 0 && (
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
                  style={{
                    background: 'rgba(245,158,11,0.11)',
                    border: '1px solid rgba(245,158,11,0.28)',
                    color: '#fbbf24',
                  }}
                >
                  <span className="animate-streak">🔥</span>
                  {streak}-day streak — you&apos;re on fire!
                </div>
              )}

              {/* Headline */}
              <div>
                <h1
                  className="font-black leading-[1.05] tracking-tight"
                  style={{ fontSize: 'clamp(2.8rem, 5.5vw, 5rem)' }}
                >
                  <span className="text-white block">Keep Learning,</span>
                  <span className="text-shimmer">Daniel.</span>
                </h1>
                <p
                  className="mt-5 text-lg leading-relaxed"
                  style={{ color: '#64748b', maxWidth: '38ch' }}
                >
                  Your personal AI tutor, notes, quizzes and flashcards —
                  all in one place. Level up every single day.
                </p>
              </div>

              {/* Stat chips */}
              <div className="flex flex-wrap gap-3">
                {[
                  { value: totalNotes,          label: 'Notes written', icon: '📝', color: '#818cf8' },
                  { value: sessions,             label: 'AI sessions',   icon: '🤖', color: '#a78bfa' },
                  { value: earnedBadges.length,  label: 'Badges earned', icon: '🏆', color: '#fbbf24' },
                  { value: `Lv ${level}`,        label: title,           icon: '⭐', color: '#34d399' },
                ].map(({ value, label, icon, color }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <span className="text-base leading-none">{icon}</span>
                    <div>
                      <p
                        className="text-sm font-black leading-none"
                        style={{ color }}
                      >
                        {value}
                      </p>
                      <p
                        className="text-[10px] mt-0.5 font-medium"
                        style={{ color: '#475569' }}
                      >
                        {label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* XP progress bar */}
              <div style={{ maxWidth: 320 }}>
                <div
                  className="flex justify-between text-xs mb-2"
                  style={{ color: '#475569' }}
                >
                  <span>
                    Level {level} → {level + 1}
                  </span>
                  <span>{xpPct}%</span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.07)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${xpPct}%`,
                      background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
                      boxShadow: '0 0 8px rgba(99,102,241,0.6)',
                    }}
                  />
                </div>
                <p
                  className="text-[10px] mt-1.5"
                  style={{ color: '#334155' }}
                >
                  {xp.toLocaleString()} XP total
                </p>
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard">
                  <button
                    className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      boxShadow: '0 8px 32px rgba(99,102,241,0.45)',
                      fontSize: '1rem',
                    }}
                  >
                    Open Dashboard <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
                <Link href="/dashboard/achievements">
                  <button
                    className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#e2e8f0',
                      fontSize: '1rem',
                    }}
                  >
                    My Achievements ✨
                  </button>
                </Link>
              </div>
            </div>

            {/* ── Right: 3D Gyroscope + floating note cards ── */}
            <div
              className="relative flex items-center justify-center"
              style={{ height: 520 }}
            >
              {/* Top-left floating card */}
              {recentNotes[0] && (
                <div
                  className="absolute"
                  style={{ left: '0%', top: '2%', zIndex: 4 }}
                >
                  <FloatingCard
                    title={recentNotes[0].title}
                    subject={recentNotes[0].subject}
                    rotate="-8deg"
                    delay="0s"
                    colorFrom="#6366f1"
                    colorTo="#8b5cf6"
                  />
                </div>
              )}

              {/* Bottom-left floating card */}
              {recentNotes[1] && (
                <div
                  className="absolute"
                  style={{ left: '2%', bottom: '5%', zIndex: 4 }}
                >
                  <FloatingCard
                    title={recentNotes[1].title}
                    subject={recentNotes[1].subject}
                    rotate="5deg"
                    delay="1.5s"
                    colorFrom="#10b981"
                    colorTo="#0ea5e9"
                  />
                </div>
              )}

              {/* Gyroscope orb */}
              <GyroscopeOrb level={level} title={title} />

              {/* Top-right floating card */}
              {recentNotes[2] && (
                <div
                  className="absolute"
                  style={{ right: '0%', top: '8%', zIndex: 4 }}
                >
                  <FloatingCard
                    title={recentNotes[2].title}
                    subject={recentNotes[2].subject}
                    rotate="6deg"
                    delay="0.9s"
                    colorFrom="#f59e0b"
                    colorTo="#ef4444"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer
        className="relative z-10 text-center py-6 px-6 border-t text-xs"
        style={{
          color: '#1e293b',
          borderColor: 'rgba(255,255,255,0.04)',
        }}
      >
        Built for{' '}
        <span style={{ color: '#818cf8' }}>Daniel</span> — curiosity is your
        superpower 🌱
      </footer>
    </main>
  )
}
