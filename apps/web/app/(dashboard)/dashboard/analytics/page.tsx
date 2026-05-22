'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Loader2, BookOpen, MessageSquare, Zap, Flame, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Analytics {
  totals: { notes: number; sessions: number; tokensThisMonth: number; messagesThisMonth: number }
  thisWeek: { notes: number; sessions: number }
  streak: number
  activityChart: { date: string; sessions: number; messages: number }[]
  subjectBreakdown: { subject: string; count: number }[]
  modeCounts: Record<string, number>
}

const MODE_LABELS: Record<string, string> = {
  GENERAL: 'General', MATH: 'Math', CODING: 'Coding',
  LANGUAGE: 'Language', SCIENCE: 'Science',
  HOMEWORK_HELPER: 'Homework', SOCRATIC_COACH: 'Socratic', QUIZ: 'Quiz',
}

const SUBJECT_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500',
  'bg-amber-500', 'bg-pink-500', 'bg-cyan-500',
]

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then(({ data }) => setData(data))
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !data) {
    return <p className="text-destructive py-10 text-center">{error || 'No data'}</p>
  }

  const maxMessages = Math.max(...data.activityChart.map((d) => d.messages), 1)
  const maxSubjectCount = Math.max(...data.subjectBreakdown.map((s) => s.count), 1)

  const topMode = Object.entries(data.modeCounts).sort(([, a], [, b]) => b - a)[0]?.[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Learning Analytics 📊</h1>
        <p className="text-muted-foreground mt-1">Track your progress and see how you're growing.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<BookOpen className="w-5 h-5 text-blue-500" />} title="Total Notes" value={data.totals.notes} sub="all time" color="blue" />
        <StatCard icon={<MessageSquare className="w-5 h-5 text-purple-500" />} title="AI Sessions" value={data.totals.sessions} sub="all time" color="purple" />
        <StatCard icon={<Flame className="w-5 h-5 text-orange-500" />} title="Streak" value={`🔥 ${data.streak}`} sub="days active" color="amber" />
        <StatCard icon={<Zap className="w-5 h-5 text-green-500" />} title="This Week" value={data.thisWeek.sessions} sub="sessions" color="green" />
      </div>

      {/* Activity chart + Subject breakdown */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* 7-day activity bar chart */}
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> 7-Day Activity
          </h2>
          <div className="flex items-end gap-2 h-32">
            {data.activityChart.map((day) => {
              const height = maxMessages > 0 ? Math.max((day.messages / maxMessages) * 100, day.messages > 0 ? 8 : 0) : 0
              const label = new Date(day.date + 'T12:00:00').toLocaleDateString([], { weekday: 'short' })
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center" style={{ height: '100px' }}>
                    <div
                      className={cn('w-full rounded-t-sm transition-all', day.messages > 0 ? 'bg-primary' : 'bg-muted')}
                      style={{ height: `${height}%`, minHeight: day.messages > 0 ? '6px' : '0' }}
                      title={`${day.messages} messages, ${day.sessions} sessions`}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {data.thisWeek.sessions} sessions · {data.totals.messagesThisMonth} messages this month
          </p>
        </Card>

        {/* Subject breakdown */}
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Notes by Subject</h2>
          {data.subjectBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No notes yet — start taking notes!</p>
          ) : (
            <div className="space-y-3">
              {data.subjectBreakdown.map((s, i) => (
                <div key={s.subject} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{s.subject}</span>
                    <span className="text-muted-foreground">{s.count} note{s.count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={cn('h-2 rounded-full transition-all', SUBJECT_COLORS[i % SUBJECT_COLORS.length])}
                      style={{ width: `${(s.count / maxSubjectCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* AI tutor usage */}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">AI Tutor Usage</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-primary">{data.totals.tokensThisMonth.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">tokens this month</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-500">{data.totals.messagesThisMonth}</p>
            <p className="text-xs text-muted-foreground">messages this month</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-500">{topMode ? (MODE_LABELS[topMode] || topMode) : '—'}</p>
            <p className="text-xs text-muted-foreground">favourite mode</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-500">{data.thisWeek.notes}</p>
            <p className="text-xs text-muted-foreground">notes this week</p>
          </div>
        </div>

        {/* Mode breakdown mini pills */}
        {Object.keys(data.modeCounts).length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {Object.entries(data.modeCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([mode, count]) => (
                <span key={mode} className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">
                  {MODE_LABELS[mode] || mode}: {count}
                </span>
              ))}
          </div>
        )}
      </Card>

      {/* Encouragement */}
      <Card className="p-5 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🌱</span>
          <div>
            <p className="font-semibold">Keep going, Daniel!</p>
            <p className="text-sm text-muted-foreground">
              {data.streak > 0
                ? `You're on a ${data.streak}-day streak — consistency is the secret to mastery!`
                : 'Start a streak today — even 5 minutes of learning adds up over time!'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

function StatCard({ icon, title, value, sub, color }: {
  icon: React.ReactNode; title: string; value: number | string; sub: string
  color: 'blue' | 'purple' | 'amber' | 'green'
}) {
  const bg = { blue: 'bg-blue-500/10', purple: 'bg-purple-500/10', amber: 'bg-amber-500/10', green: 'bg-green-500/10' }[color]
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', bg)}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{title}</p>
        <p className="text-xl font-bold leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </Card>
  )
}
