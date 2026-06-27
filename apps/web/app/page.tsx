import Link from 'next/link'
import { db } from '@/lib/db'
import { DANIEL_USER_ID } from '@/lib/user'
import { xpToLevel } from '@/lib/gamification'
import { chatWithFallback } from '@/lib/ai/fallback'
import { ArrowRight, Sparkles, CalendarDays, BookOpen } from 'lucide-react'

export const dynamic = 'force-dynamic'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLevelTitle(level: number): string {
  const titles: [number, string][] = [
    [20, 'Sage'], [15, 'Prodigy'], [10, 'Star Student'],
    [8, 'Expert'], [5, 'Rising Star'], [3, 'Scholar'], [1, 'Seedling'],
  ]
  return titles.find(([min]) => level >= min)?.[1] ?? 'Seedling'
}

/** Extract the AI-generated publish title from the stored HTML. */
function extractAiTitle(html: string | null, fallback: string): string {
  if (!html) return fallback
  const m = html.match(/<h1[^>]*pub-title[^>]*>([\s\S]{0,300})<\/h1>/)
  if (m) {
    return m[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()
  }
  return fallback
}

function stripHtml(html: string | null): string {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140)
}

// ─── Daily multilingual inspirational quotes ──────────────────────────────────

interface DailyQuoteData {
  language: string
  original: string
  english: string | null
  source: string
}

const LANG_CYCLE = ['en', 'zh', 'es', 'fr', 'de'] as const
type Lang = typeof LANG_CYCLE[number]

const LANG_LABELS: Record<Lang, string> = {
  en: 'English', zh: 'Chinese', es: 'Spanish', fr: 'French', de: 'German',
}

// Fallback pool used when AI generation fails or DB isn't ready
const FALLBACK_POOL: Record<Lang, DailyQuoteData[]> = {
  en: [
    { language: 'en', original: 'An investment in knowledge pays the best interest.', english: null, source: 'Benjamin Franklin' },
    { language: 'en', original: 'The beautiful thing about learning is that nobody can take it away from you.', english: null, source: 'B.B. King' },
    { language: 'en', original: 'Tell me and I forget. Teach me and I remember. Involve me and I learn.', english: null, source: 'Benjamin Franklin' },
    { language: 'en', original: 'Live as if you were to die tomorrow. Learn as if you were to live forever.', english: null, source: 'Mahatma Gandhi' },
    { language: 'en', original: 'The more that you read, the more things you will know.', english: null, source: 'Dr. Seuss' },
  ],
  zh: [
    { language: 'zh', original: '学而不思则罔，思而不学则殆。', english: 'Learning without thought is labor lost; thought without learning is perilous.', source: '孔子 · Confucius' },
    { language: 'zh', original: '千里之行，始于足下。', english: 'A journey of a thousand miles begins with a single step.', source: '老子 · Lao Tzu' },
    { language: 'zh', original: '书山有路勤为径，学海无涯苦作舟。', english: 'On the mountain of books, diligence is the path; in the sea of learning, hard work is your boat.', source: '韩愈 · Han Yu' },
    { language: 'zh', original: '三人行，必有我师。', english: 'Among any three people walking, I will find my teacher.', source: '孔子 · Confucius' },
    { language: 'zh', original: '活到老，学到老。', english: 'Live and learn — learning has no end.', source: '中国谚语 · Chinese Proverb' },
  ],
  es: [
    { language: 'es', original: 'Dime y lo olvido, enséñame y lo recuerdo, involúcrame y lo aprendo.', english: 'Tell me and I forget, teach me and I remember, involve me and I learn.', source: 'Benjamin Franklin' },
    { language: 'es', original: 'El conocimiento es la única riqueza que crece al compartirse.', english: 'Knowledge is the only wealth that grows when shared.', source: 'Proverbio Español' },
    { language: 'es', original: 'Quien tiene imaginación, con qué facilidad levanta palacios en el aire.', english: 'He who has imagination finds it easy to build palaces in the air.', source: 'Gustavo Adolfo Bécquer' },
    { language: 'es', original: 'No hay camino para la sabiduría; la sabiduría es el camino.', english: 'There is no path to wisdom; wisdom is the path.', source: 'Proverbio' },
    { language: 'es', original: 'Aprender es descubrir que algo es posible.', english: 'Learning is discovering that something is possible.', source: 'Fritz Perls' },
  ],
  fr: [
    { language: 'fr', original: 'La connaissance s\'acquiert par l\'expérience, tout le reste n\'est que de l\'information.', english: 'Knowledge is acquired through experience; everything else is just information.', source: 'Albert Einstein' },
    { language: 'fr', original: 'L\'éducation est l\'arme la plus puissante pour changer le monde.', english: 'Education is the most powerful weapon you can use to change the world.', source: 'Nelson Mandela' },
    { language: 'fr', original: 'Dis-moi et j\'oublie, enseigne-moi et je me souviens, implique-moi et j\'apprends.', english: 'Tell me and I forget, teach me and I remember, involve me and I learn.', source: 'Benjamin Franklin' },
    { language: 'fr', original: 'Le génie, c\'est 1% d\'inspiration et 99% de transpiration.', english: 'Genius is 1% inspiration and 99% perspiration.', source: 'Thomas Edison' },
    { language: 'fr', original: 'Apprendre sans réfléchir est vain, réfléchir sans apprendre est dangereux.', english: 'Learning without reflecting is vain; reflecting without learning is dangerous.', source: 'Confucius' },
  ],
  de: [
    { language: 'de', original: 'Wer aufhört zu lernen, ist alt. Wer immer lernt, bleibt jung.', english: 'He who stops learning is old. He who keeps learning stays young.', source: 'Henry Ford' },
    { language: 'de', original: 'Bildung ist nicht das Befüllen von Fässern, sondern das Entzünden von Flammen.', english: 'Education is not filling buckets, but lighting fires.', source: 'W.B. Yeats' },
    { language: 'de', original: 'Wissen ist Macht.', english: 'Knowledge is power.', source: 'Francis Bacon' },
    { language: 'de', original: 'Der Kluge lernt aus allem und von jedem, der Normale aus seinen Erfahrungen.', english: 'The wise learn from everything and everyone; the ordinary only from their own experience.', source: 'Sokrates · Socrates' },
    { language: 'de', original: 'Lernen ist wie Rudern gegen den Strom: Hört man damit auf, treibt man zurück.', english: 'Learning is like rowing against the current: if you stop, you drift back.', source: 'Laotse · Lao Tzu' },
  ],
}

function getDayOfYear(): number {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000)
}

async function getOrCreateDailyQuote(): Promise<DailyQuoteData> {
  const nyDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const day = getDayOfYear()
  const lang = LANG_CYCLE[day % LANG_CYCLE.length]!
  const fallbacks = FALLBACK_POOL[lang]!
  const fallback = fallbacks[day % fallbacks.length]!

  try {
    // Fast path: today's quote already in DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (db as any).dailyQuote.findUnique({ where: { date: nyDate } }) as DailyQuoteData | null
    if (existing) return existing

    // Generate a fresh quote via AI
    const isEn = lang === 'en'
    const prompt = `Generate a unique, inspiring quote about learning, curiosity, or intellectual growth${isEn ? '' : ` written in ${LANG_LABELS[lang]}`}.
Return ONLY valid JSON, no other text:
{
  "original": "${isEn ? 'the quote in English' : `the quote in ${LANG_LABELS[lang]}`}",${isEn ? '' : '\n  "english": "accurate English translation",'}
  "source": "Real Author Name · Brief attribution (e.g., Confucius, Albert Einstein, Latin Proverb)"
}
Rules: attributed to a real person or well-known proverb; 1–2 sentences; inspiring for a curious teenager; no invented attributions.`

    const result = await Promise.race([
      chatWithFallback({ messages: [{ role: 'user', content: prompt }], temperature: 0.85, maxTokens: 180 })
        .then(r => r)
        .catch(() => null),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 7000)),
    ])

    let quoteData: DailyQuoteData = fallback
    if (result) {
      const jsonMatch = result.content.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { original?: string; english?: string; source?: string }
        if (parsed.original && parsed.source) {
          quoteData = { language: lang, original: parsed.original, english: parsed.english ?? null, source: parsed.source }
        }
      }
    }

    // Save to DB — upsert protects against race conditions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).dailyQuote.upsert({
      where: { date: nyDate },
      create: { date: nyDate, ...quoteData },
      update: { source: quoteData.source }, // no-op on race; keeps record
    }).catch(() => {/* ignore save errors */})

    return quoteData
  } catch {
    // Table not yet created or any other DB error — use fallback silently
    return fallback
  }
}

function NavQuote({ quote }: { quote: DailyQuoteData }) {
  const isEnglish = quote.language === 'en'
  return (
    <div
      className="flex items-center gap-3 px-4 py-2 rounded-xl w-full"
      style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.16)', backdropFilter: 'blur(8px)', minWidth: 0, overflow: 'hidden' }}
    >
      <span style={{ fontSize: '0.58rem', letterSpacing: '0.12em', color: '#7c83e6', fontWeight: 700, textTransform: 'uppercase' as const, flexShrink: 0 }}>
        ✨ Today
      </span>
      <div className="flex-1 min-w-0">
        {!isEnglish && (
          <p className="text-xs font-bold truncate" style={{ color: '#c4b5fd' }}>{quote.original}</p>
        )}
        <p className="text-xs font-semibold truncate" style={{ color: '#f1f5f9' }}>
          &ldquo;{isEnglish ? quote.original : (quote.english ?? quote.original)}&rdquo;
        </p>
      </div>
      <span className="text-[10px] flex-shrink-0 hidden lg:block" style={{ color: '#64748b', fontWeight: 600 }}>
        &mdash; {quote.source}
      </span>
    </div>
  )
}

// ─── CSS 3D Gyroscope Orb ─────────────────────────────────────────────────────

function GyroscopeOrb({ level, title }: { level: number; title: string }) {
  const ring = (cls: string, size: number, color: string, glow: string, width = 1.5) => ({
    className: cls,
    style: {
      position: 'absolute' as const,
      width: size, height: size,
      top: '50%', left: '50%',
      marginLeft: -size / 2, marginTop: -size / 2,
      borderRadius: '50%',
      border: `${width}px solid ${color}`,
      boxShadow: glow,
    },
  })

  return (
    <div className="relative flex-shrink-0" style={{ width: 280, height: 280, perspective: '700px' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 65% 65% at 50% 50%, rgba(99,102,241,0.22) 0%, rgba(139,92,246,0.08) 45%, transparent 70%)', filter: 'blur(8px)' }} />
      <div style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}>
        <div {...ring('gyro-outer', 228, 'rgba(99,102,241,0.72)', '0 0 28px rgba(99,102,241,0.4), inset 0 0 10px rgba(99,102,241,0.08)')} />
        <div {...ring('gyro-mid', 166, 'rgba(139,92,246,0.65)', '0 0 18px rgba(139,92,246,0.32)')} />
        <div {...ring('gyro-inner', 110, 'rgba(165,180,252,0.55)', '0 0 14px rgba(165,180,252,0.25)', 1)} />
        <div {...ring('gyro-vert', 190, 'rgba(99,102,241,0.38)', '0 0 10px rgba(99,102,241,0.15)', 1)} />
        <div className="orbit-dot" style={{ position: 'absolute', width: 8, height: 8, top: '50%', left: '50%', marginLeft: -4, marginTop: -4, borderRadius: '50%', background: '#a5b4fc', boxShadow: '0 0 14px 5px rgba(165,180,252,0.75)' }} />
        <div className="animate-core" style={{ position: 'absolute', width: 64, height: 64, top: '50%', left: '50%', marginLeft: -32, marginTop: -32, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 35% 32%, rgba(255,255,255,0.95) 0%, rgba(196,181,253,0.85) 18%, rgba(99,102,241,0.55) 50%, rgba(17,12,50,0.92) 85%)', boxShadow: '0 0 40px 14px rgba(99,102,241,0.6), 0 0 80px 28px rgba(99,102,241,0.18), inset 0 1px 0 rgba(255,255,255,0.35)' }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: 'white', lineHeight: 1, textShadow: '0 0 20px rgba(255,255,255,0.95)' }}>{level}</span>
          <span style={{ fontSize: 6, fontWeight: 700, letterSpacing: '0.18em', color: '#c4b5fd', textTransform: 'uppercase', marginTop: 2 }}>{title.slice(0, 7)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Floating note card ───────────────────────────────────────────────────────

function FloatingCard({ title, subject, rotate, delay, colorFrom, colorTo, href }: {
  title: string; subject?: string | null; rotate: string; delay: string; colorFrom: string; colorTo: string; href?: string
}) {
  const card = (
    <div
      className="animate-float w-36 rounded-xl p-3 select-none"
      style={{ '--card-rotate': rotate, transform: `rotate(${rotate})`, animationDelay: delay, background: `linear-gradient(135deg, ${colorFrom}f0, ${colorTo}cc)`, border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 18px 36px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)', cursor: href ? 'pointer' : 'default' } as React.CSSProperties}
    >
      <div className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center mb-2">
        <Sparkles className="w-2.5 h-2.5 text-white" />
      </div>
      <p className="text-white font-bold text-[11px] leading-snug line-clamp-2 mb-1">{title}</p>
      {subject && <p className="text-white/55 text-[9px] font-semibold">{subject}</p>}
    </div>
  )
  if (href) return <Link href={href}>{card}</Link>
  return card
}

// ─── Published Diary Card ─────────────────────────────────────────────────────

const DIARY_COLORS = [
  { border: 'rgba(99,102,241,0.3)',  badge: 'rgba(99,102,241,0.12)',  badgeText: '#a5b4fc', accent: '#6366f1' },
  { border: 'rgba(16,185,129,0.3)', badge: 'rgba(16,185,129,0.12)', badgeText: '#34d399', accent: '#10b981' },
  { border: 'rgba(245,158,11,0.3)', badge: 'rgba(245,158,11,0.12)', badgeText: '#fbbf24', accent: '#f59e0b' },
  { border: 'rgba(14,165,233,0.3)', badge: 'rgba(14,165,233,0.12)', badgeText: '#38bdf8', accent: '#0ea5e9' },
  { border: 'rgba(244,63,94,0.3)',  badge: 'rgba(244,63,94,0.12)',  badgeText: '#fb7185', accent: '#f43f5e' },
  { border: 'rgba(139,92,246,0.3)', badge: 'rgba(139,92,246,0.12)', badgeText: '#c4b5fd', accent: '#8b5cf6' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const userId = DANIEL_USER_ID

  const [recentNotes, totalNotes, profile, earnedBadges, sessions, publishedNotes, dailyQuote] =
    await Promise.all([
      db.note.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 4, select: { id: true, slug: true, title: true, subject: true } }),
      db.note.count({ where: { userId } }),
      db.learningProfile.findUnique({ where: { userId }, select: { xp: true, level: true, currentStreak: true } }),
      db.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
      db.tutorSession.count({ where: { userId } }),
      db.note.findMany({
        where: { userId, publishedSlug: { not: null } },
        orderBy: { publishedAt: 'desc' },
        take: 6,
        select: { id: true, title: true, subject: true, publishedSlug: true, publishedAt: true, tutorSummary: true, publishedHtml: true },
      }),
      getOrCreateDailyQuote(),
    ])

  const xp = profile?.xp ?? 0
  const level = profile?.level ?? xpToLevel(xp)
  const streak = profile?.currentStreak ?? 0
  const title = getLevelTitle(level)

  return (
    <main className="min-h-screen font-display overflow-x-hidden" style={{ background: '#060810', color: '#f1f5f9', overflowX: 'hidden' }}>

      {/* ── Background layers ── */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 90% 70% at 50% -5%, rgba(30,27,75,0.85) 0%, #060810 65%)' }} />
        <div className="absolute" style={{ top: '0%', left: '-20%', width: '65%', height: '80%', background: 'radial-gradient(ellipse, rgba(99,102,241,0.11) 0%, transparent 70%)' }} />
        <div className="absolute" style={{ top: '5%', right: '-15%', width: '55%', height: '75%', background: 'radial-gradient(ellipse, rgba(139,92,246,0.09) 0%, transparent 70%)' }} />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.25) 1px, transparent 1px)', backgroundSize: '36px 36px', opacity: 0.35 }} />
        <div className="grain-layer absolute inset-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 55%, transparent 35%, rgba(0,0,0,0.65) 100%)' }} />
      </div>

      {/* ── Nav ── */}
      <nav className="relative z-50 flex items-center gap-4 px-6 sm:px-10 py-4">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 16px rgba(99,102,241,0.5)' }}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-black tracking-tight text-white">CogniBloom</span>
        </div>
        <div className="flex-1 hidden sm:block"><NavQuote quote={dailyQuote} /></div>
        <Link href="/dashboard" className="flex-shrink-0">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:scale-105 active:scale-95" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 20px rgba(99,102,241,0.4)', color: 'white' }}>
            Open App <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </nav>

      {/* ── Mobile daily quote ── */}
      <div className="relative z-10 block sm:hidden px-4 pb-3 overflow-hidden"><NavQuote quote={dailyQuote} /></div>

      {/* ── Hero — compact ── */}
      <section className="relative z-10 pb-4 sm:pb-6">
        <div className="w-full px-4 sm:px-12 xl:px-20">
          <div className="grid lg:grid-cols-2 gap-8 items-start">

            {/* ── Left: text + orb ── */}
            <div className="flex flex-col gap-5 max-w-xl">

              {/* Streak + headline row */}
              <div className="flex flex-wrap items-center gap-3">
                {streak > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(245,158,11,0.11)', border: '1px solid rgba(245,158,11,0.28)', color: '#fbbf24' }}>
                    <span className="animate-streak">🔥</span> {streak}-day streak
                  </div>
                )}
              </div>

              {/* CTAs — two buttons */}
              <div className="flex flex-wrap gap-2">
                <Link href="/dashboard/planner">
                  <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 text-sm" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 6px 24px rgba(99,102,241,0.45)' }}>
                    <CalendarDays className="w-4 h-4" /> Daily Planner
                  </button>
                </Link>
                <Link href="/dashboard">
                  <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-200 hover:scale-105 active:scale-95 text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0' }}>
                    Dashboard <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              </div>

              {/* Compact stat row */}
              <div className="flex flex-wrap gap-2">
                {[
                  { value: totalNotes,         label: 'Notes',   icon: '📝', color: '#818cf8', href: '/dashboard/notes' },
                  { value: sessions,            label: 'AI chats',icon: '🤖', color: '#a78bfa', href: '/dashboard/chat' },
                  { value: earnedBadges.length, label: 'Badges',  icon: '🏆', color: '#fbbf24', href: '/dashboard/achievements' },
                  { value: `Lv ${level}`,       label: title,     icon: '⭐', color: '#34d399', href: '/dashboard/achievements' },
                ].map(({ value, label, icon, color, href }) => (
                  <Link key={label} href={href}>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-200 hover:scale-105" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <span className="text-sm leading-none">{icon}</span>
                      <span className="text-xs font-black" style={{ color }}>{value}</span>
                      <span className="text-[10px] font-medium" style={{ color: '#475569' }}>{label}</span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Orb — 85% scale, centered, cards spread wide */}
              <div className="relative flex items-center justify-center h-60 mt-3 hidden md:flex overflow-visible">
                <div className="scale-[0.85]" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  {/* Floating cards around orb */}
                  <div className="relative" style={{ width: 320, height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* Top-left */}
                    {recentNotes[0] && (
                      <div className="absolute" style={{ left: '-120px', top: '-30px', zIndex: 4 }}>
                        <FloatingCard title={recentNotes[0].title} subject={recentNotes[0].subject} rotate="-7deg" delay="0s" colorFrom="#6366f1" colorTo="#8b5cf6" href={`/dashboard/notes/${recentNotes[0].slug ?? recentNotes[0].id}`} />
                      </div>
                    )}
                    {/* Top-right */}
                    {recentNotes[1] && (
                      <div className="absolute" style={{ right: '-120px', top: '-30px', zIndex: 4 }}>
                        <FloatingCard title={recentNotes[1].title} subject={recentNotes[1].subject} rotate="6deg" delay="0.8s" colorFrom="#10b981" colorTo="#0ea5e9" href={`/dashboard/notes/${recentNotes[1].slug ?? recentNotes[1].id}`} />
                      </div>
                    )}
                    <GyroscopeOrb level={level} title={title} />
                    {/* Bottom-left */}
                    {recentNotes[2] && (
                      <div className="absolute" style={{ left: '-115px', bottom: '-30px', zIndex: 4 }}>
                        <FloatingCard title={recentNotes[2].title} subject={recentNotes[2].subject} rotate="5deg" delay="1.6s" colorFrom="#f59e0b" colorTo="#ef4444" href={`/dashboard/notes/${recentNotes[2].slug ?? recentNotes[2].id}`} />
                      </div>
                    )}
                    {/* Bottom-right */}
                    {recentNotes[3] && (
                      <div className="absolute" style={{ right: '-115px', bottom: '-30px', zIndex: 4 }}>
                        <FloatingCard title={recentNotes[3].title} subject={recentNotes[3].subject} rotate="-5deg" delay="2.2s" colorFrom="#ec4899" colorTo="#8b5cf6" href={`/dashboard/notes/${recentNotes[3].slug ?? recentNotes[3].id}`} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right: published diary preview (top 3) ── */}
            {publishedNotes.length > 0 && (
              <div className="flex flex-col gap-3 pt-4 lg:pt-2">
                <div className="flex items-center gap-2 mb-1 pt-2 lg:pt-0 border-t lg:border-none" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <BookOpen className="w-3.5 h-3.5" style={{ color: '#6366f1' }} />
                  <span className="text-[10px] font-800 uppercase tracking-widest" style={{ color: '#475569', letterSpacing: '0.1em' }}>Learning Chronicle</span>
                </div>
                {publishedNotes.slice(0, 2).map((note, i) => {
                  const c = DIARY_COLORS[i % DIARY_COLORS.length]!
                  const aiTitle = extractAiTitle(note.publishedHtml, note.title)
                  const preview = stripHtml(note.tutorSummary)
                  return (
                    <Link key={note.id} href={`/notes/view/${note.publishedSlug!}`} target="_blank">
                      <div className="rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${c.border}`, cursor: 'pointer' }}>
                        {note.subject && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mb-2" style={{ background: c.badge, color: c.badgeText }}>
                            {note.subject}
                          </span>
                        )}
                        <p className="text-xs font-bold leading-snug line-clamp-2 text-white mb-1">{aiTitle}</p>
                        {preview && <p className="text-[10px] leading-relaxed line-clamp-2" style={{ color: '#475569' }}>{preview}</p>}
                        <p className="text-[9px] mt-1.5 font-semibold" style={{ color: c.accent }}>
                          {note.publishedAt ? new Date(note.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''} · Open diary →
                        </p>
                      </div>
                    </Link>
                  )
                })}
                <Link href="/dashboard/notes/archive" className="block text-center text-[10px] font-bold mt-2 transition-opacity hover:opacity-70" style={{ color: '#6366f1' }}>
                  View all published entries →
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 text-center py-4 px-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <p className="text-sm font-semibold" style={{ color: '#64748b' }}>
          Built for{' '}
          <span style={{ color: '#a5b4fc', fontWeight: 800 }}>Daniel</span>
          {' '}&mdash; curiosity is your superpower 🌱
        </p>
      </footer>
    </main>
  )
}
