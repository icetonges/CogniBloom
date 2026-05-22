export const dynamic = 'force-dynamic'

import { DANIEL_USER_ID } from '@/lib/user'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, TrendingUp, BookOpen, MessageSquare, Clock, Brain, Layers } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { formatDistanceToNow } from 'date-fns'

export default async function DashboardPage() {
  const userId = DANIEL_USER_ID

  // Fetch real stats
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
      select: { masteryScores: true, weakAreas: true, strongAreas: true },
    }),
    db.flashcard.count({ where: { userId, nextReviewAt: { lte: new Date() } } }),
  ])

  // Real streak calculation
  const allActivity = await db.$queryRaw<{ day: Date }[]>`
    SELECT DISTINCT DATE("createdAt") AS day FROM "TutorSession" WHERE "userId" = ${userId}
    UNION
    SELECT DISTINCT DATE("createdAt") AS day FROM "Note" WHERE "userId" = ${userId}
    ORDER BY day DESC LIMIT 60
  `
  let streak = 0
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0)
  for (let i = 0; i < allActivity.length; i++) {
    const expected = new Date(todayDate); expected.setDate(todayDate.getDate() - i)
    if (new Date(allActivity[i].day).toDateString() === expected.toDateString()) streak++
    else break
  }

  const masteryEntries = Object.entries(
    (learningProfile?.masteryScores as Record<string, number>) ?? {}
  ).sort(([, a], [, b]) => b - a).slice(0, 4)

  const greetingHour = new Date().getHours()
  const greeting =
    greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-4xl font-bold">{greeting}, Daniel! 👋</h1>
        <p className="text-muted-foreground text-lg">
          Ready to learn something amazing today?
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<BookOpen className="w-5 h-5 text-blue-500" />}
          title="Notes"
          value={String(noteCount)}
          subtitle="Total created"
          href="/dashboard/notes"
          color="blue"
        />
        <StatCard
          icon={<MessageSquare className="w-5 h-5 text-purple-500" />}
          title="Sessions"
          value={String(sessionCount)}
          subtitle="AI chats"
          href="/dashboard/chat"
          color="purple"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-green-500" />}
          title="Streak"
          value={streak > 0 ? `🔥 ${streak}` : '—'}
          subtitle="Days active"
          color="green"
        />
        <StatCard
          icon={<Layers className="w-5 h-5 text-amber-500" />}
          title="Cards Due"
          value={flashcardsDue > 0 ? String(flashcardsDue) : '✓'}
          subtitle={flashcardsDue > 0 ? 'Review now!' : 'All caught up'}
          href={flashcardsDue > 0 ? '/dashboard/flashcards' : undefined}
          color="amber"
        />
      </div>

      {/* Mastery Summary */}
      {masteryEntries.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" /> Subject Mastery
            </h2>
            <Link href="/dashboard/analytics">
              <Button variant="ghost" size="sm" className="text-xs">View all →</Button>
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {masteryEntries.map(([subject, score]) => {
              const pct = Math.round(score * 100)
              const barColor = pct >= 85 ? 'bg-green-500' : pct >= 65 ? 'bg-blue-500' : pct >= 45 ? 'bg-amber-500' : 'bg-red-400'
              return (
                <div key={subject} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium capitalize">{subject}</span>
                    <span className="text-muted-foreground font-bold">{pct}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Main grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Start Chat */}
        <Card className="md:col-span-2 p-6 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">AI Tutor</h2>
                <p className="text-sm text-muted-foreground">
                  Powered by Google Gemini · Grounded in your notes
                </p>
              </div>
            </div>
            <p className="text-muted-foreground">
              Ask anything — math, coding, science, language. The AI uses your own notes as
              context to give you personalised answers.
            </p>
            <div className="flex gap-3">
              <Link href="/dashboard/chat" className="flex-1">
                <Button className="w-full gap-2">
                  <Sparkles className="w-4 h-4" />
                  Start Chatting
                </Button>
              </Link>
              <Link href="/dashboard/notes">
                <Button variant="outline" className="gap-2">
                  <BookOpen className="w-4 h-4" />
                  Notes
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* Quick actions */}
        <Card className="p-6 space-y-3">
          <h2 className="text-lg font-bold">Quick Start</h2>
          {[
            { href: '/dashboard/chat', label: 'AI Tutor', emoji: '🤖' },
            { href: '/dashboard/quiz', label: 'Take a Quiz', emoji: '🏆' },
            { href: '/dashboard/flashcards', label: 'Flashcards', emoji: '🃏' },
            { href: '/dashboard/analytics', label: 'My Progress', emoji: '📊' },
          ].map(({ href, label, emoji }) => (
            <Link key={label} href={href}>
              <Button variant="outline" className="w-full justify-start gap-3 text-base h-11">
                <span>{emoji}</span>
                {label}
              </Button>
            </Link>
          ))}
        </Card>
      </div>

      {/* Recent Notes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Recent Notes</h2>
          <Link href="/dashboard/notes">
            <Button variant="ghost" size="sm">View all →</Button>
          </Link>
        </div>

        {recentNotes.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">No notes yet — create your first one!</p>
            <Link href="/dashboard/notes">
              <Button variant="outline" className="gap-2">
                <BookOpen className="w-4 h-4" /> Create Note
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {recentNotes.map((note) => (
              <Link key={note.id} href="/dashboard/notes">
                <Card className="p-4 hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <p className="font-semibold line-clamp-2 mb-2">{note.title}</p>
                  {note.subject && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {note.subject}
                    </span>
                  )}
                  <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon, title, value, subtitle, href, color,
}: {
  icon: React.ReactNode
  title: string
  value: string
  subtitle: string
  href?: string
  color: 'blue' | 'purple' | 'green' | 'amber'
}) {
  const bg = {
    blue: 'bg-blue-500/10',
    purple: 'bg-purple-500/10',
    green: 'bg-green-500/10',
    amber: 'bg-amber-500/10',
  }[color]

  const card = (
    <Card className={`p-4 flex items-center gap-3 ${href ? 'hover:border-primary/40 transition-colors cursor-pointer' : ''}`}>
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{title}</p>
        <p className="text-2xl font-bold leading-none my-0.5">{value}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
    </Card>
  )

  return href ? <Link href={href}>{card}</Link> : card
}
