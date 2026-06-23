'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2, Brain, Eye, CheckCircle2, Sparkles, TrendingUp,
  CalendarClock, RefreshCw, Target, BookOpen, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { REVIEW_RATINGS, intervalLabel } from '@/lib/review'

interface DueNote {
  noteId: string
  title: string
  subject: string | null
  tags: string[]
  content: string
  preview: string
  isNew: boolean
  interval: number
  repetitions: number
  nextReviewAt: string | null
}

interface ReviewStats {
  totalNotes: number
  scheduled: number
  dueCount: number
  reviewedToday: number
  avgRetention: number
  upcoming: { date: string; count: number }[]
}

type Mode = 'idle' | 'reviewing' | 'done'

export default function DailyReviewPage() {
  const [due, setDue] = useState<DueNote[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [loading, setLoading] = useState(true)

  const [mode, setMode] = useState<Mode>('idle')
  const [queue, setQueue] = useState<DueNote[]>([])
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [safeHtml, setSafeHtml] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sessionStats, setSessionStats] = useState({ recalled: 0, total: 0 })

  const load = useCallback(() => {
    setLoading(true)
    return fetch('/api/review')
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setDue(res.data)
          setStats(res.stats)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Sanitize the current note's HTML when it is revealed
  const current = queue[idx]
  useEffect(() => {
    if (!revealed || !current?.content) { setSafeHtml(''); return }
    import('dompurify').then(({ default: DOMPurify }) => {
      setSafeHtml(
        DOMPurify.sanitize(current.content, {
          ALLOWED_TAGS: [
            'p', 'br', 'strong', 'em', 'u', 's', 'del', 'ins',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
            'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'hr', 'div', 'span', 'mark', 'sup', 'sub',
          ],
          ALLOWED_ATTR: [
            'href', 'src', 'alt', 'title', 'class', 'id',
            'target', 'rel', 'width', 'height', 'colspan', 'rowspan',
          ],
          ALLOW_DATA_ATTR: false,
        })
      )
    })
  }, [revealed, current])

  const startSession = () => {
    if (due.length === 0) return
    setQueue(due)
    setIdx(0)
    setRevealed(false)
    setSessionStats({ recalled: 0, total: 0 })
    setMode('reviewing')
  }

  const grade = async (rating: number) => {
    if (!current || submitting) return
    setSubmitting(true)
    try {
      await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: current.noteId, rating }),
      })
    } catch { /* keep going even if save fails */ }
    setSessionStats((s) => ({ recalled: s.recalled + (rating >= 3 ? 1 : 0), total: s.total + 1 }))
    setSubmitting(false)

    if (idx + 1 >= queue.length) {
      setMode('done')
      load()
    } else {
      setIdx(idx + 1)
      setRevealed(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ---------- REVIEW SESSION ----------
  if (mode === 'reviewing' && current) {
    const progress = ((idx) / queue.length) * 100
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        {/* progress */}
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('idle')} className="text-sm text-muted-foreground hover:text-foreground">
            ← Exit
          </button>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-sm font-medium text-muted-foreground tabular-nums">
            {idx + 1} / {queue.length}
          </span>
        </div>

        <Card className="p-6 md:p-8 min-h-[360px] flex flex-col">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {current.subject && (
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
                {current.subject}
              </span>
            )}
            {current.isNew ? (
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-500">
                New
              </span>
            ) : (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">
                Seen {current.repetitions}×
              </span>
            )}
          </div>

          <h2 className="text-xl md:text-2xl font-bold mb-2">{current.title}</h2>

          {!revealed ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Brain className="w-7 h-7 text-primary" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <p className="font-semibold">Try to recall this note from memory</p>
                <p className="text-sm text-muted-foreground">
                  Retrieving the answer <em>before</em> you see it is what strengthens the memory.
                  Take a few seconds, then reveal to check yourself.
                </p>
              </div>
              <Button onClick={() => setRevealed(true)} size="lg" className="gap-2">
                <Eye className="w-4 h-4" /> Reveal note
              </Button>
            </div>
          ) : (
            <>
              <div
                className="flex-1 prose prose-sm dark:prose-invert max-w-none overflow-y-auto
                  prose-headings:font-bold prose-headings:tracking-tight
                  prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                  prose-p:text-muted-foreground prose-p:leading-relaxed
                  prose-li:text-muted-foreground
                  prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                  prose-pre:bg-[rgba(255,255,255,0.04)] prose-pre:border prose-pre:border-white/10
                  prose-strong:text-foreground prose-a:text-primary
                  prose-img:rounded-xl prose-img:max-w-full"
                dangerouslySetInnerHTML={{ __html: safeHtml || current.content }}
              />
              <div className="mt-6 pt-5 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground text-center mb-3">
                  How well did you recall it? This sets when you&apos;ll see it next.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {REVIEW_RATINGS.map((r) => (
                    <button
                      key={r.rating}
                      disabled={submitting}
                      onClick={() => grade(r.rating)}
                      className={cn(
                        'flex flex-col items-center gap-1 py-3 rounded-xl text-white font-semibold transition-all disabled:opacity-50',
                        r.color
                      )}
                    >
                      <span className="text-lg">{r.emoji}</span>
                      <span className="text-sm">{r.short}</span>
                    </button>
                  ))}
                </div>
                <div className="flex justify-between mt-2 px-1 text-[10px] text-muted-foreground">
                  <span>Reset to tomorrow</span>
                  <span>Longer interval →</span>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    )
  }

  // ---------- SESSION DONE ----------
  if (mode === 'done') {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Review complete</h2>
          <p className="text-muted-foreground mt-1">
            You recalled {sessionStats.recalled} of {sessionStats.total} notes. Each one is now
            rescheduled on its forgetting curve.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          {due.length > 0 ? (
            <Button onClick={startSession} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Review {due.length} more
            </Button>
          ) : (
            <Button onClick={() => setMode('idle')} variant="outline">Back to overview</Button>
          )}
          <Link href="/dashboard/notes"><Button variant="outline" className="gap-2"><BookOpen className="w-4 h-4" /> Notes</Button></Link>
        </div>
      </div>
    )
  }

  // ---------- IDLE / OVERVIEW ----------
  const retentionPct = Math.round((stats?.avgRetention ?? 0) * 100)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" /> Daily Review
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Spaced repetition over your notes — beat the forgetting curve.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Target} color="text-rose-400" label="Due now" value={String(stats?.dueCount ?? 0)} />
        <StatCard icon={CheckCircle2} color="text-emerald-400" label="Reviewed today" value={String(stats?.reviewedToday ?? 0)} />
        <StatCard icon={TrendingUp} color="text-blue-400" label="Avg retention" value={`${retentionPct}%`} />
        <StatCard icon={CalendarClock} color="text-violet-400" label="In schedule" value={`${stats?.scheduled ?? 0}/${stats?.totalNotes ?? 0}`} />
      </div>

      {/* start review CTA */}
      <Card className="p-6 bg-gradient-to-br from-primary/[0.07] to-secondary/[0.05] border-primary/15">
        {due.length > 0 ? (
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-lg font-bold">{due.length} {due.length === 1 ? 'note' : 'notes'} ready for review</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                A short active-recall session keeps these memories from decaying.
              </p>
            </div>
            <Button onClick={startSession} size="lg" className="gap-2">
              <Sparkles className="w-4 h-4" /> Start review
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-lg font-bold">All caught up</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {stats?.totalNotes ? 'Nothing due right now — come back tomorrow.' : 'Save some notes and they will appear here for review.'}
            </p>
          </div>
        )}
      </Card>

      {/* 7-day forecast */}
      {stats && stats.upcoming.some((u) => u.count > 0) && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-muted-foreground" /> Next 7 days
          </h3>
          <div className="flex items-end justify-between gap-2 h-24">
            {stats.upcoming.map((u, i) => {
              const max = Math.max(...stats.upcoming.map((x) => x.count), 1)
              const h = u.count === 0 ? 4 : Math.max(8, (u.count / max) * 80)
              const d = new Date(u.date)
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{u.count || ''}</span>
                  <div className="w-full rounded-md bg-primary/70" style={{ height: `${h}px` }} />
                  <span className="text-[10px] text-muted-foreground">
                    {i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* upcoming due list preview */}
      {due.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">In today&apos;s queue</h3>
          <div className="space-y-1">
            {due.slice(0, 6).map((n) => (
              <div key={n.noteId} className="flex items-center gap-3 py-1.5 text-sm">
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate font-medium">{n.title}</span>
                {n.subject && <span className="text-xs text-muted-foreground shrink-0">{n.subject}</span>}
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                  {n.isNew ? 'New' : intervalLabel(n.interval)}
                </span>
              </div>
            ))}
            {due.length > 6 && (
              <p className="text-xs text-muted-foreground pt-1 pl-6">+ {due.length - 6} more</p>
            )}
          </div>
        </Card>
      )}

      {/* the science */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Why this works
        </h3>
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <ScienceBlock title="Forgetting curve" body="Memory decays exponentially. Reviewing right before you'd forget resets the curve and makes each memory more durable." />
          <ScienceBlock title="Spacing effect" body="Expanding intervals between reviews beat cramming. Each note's schedule stretches as you recall it well (SM-2)." />
          <ScienceBlock title="Active recall" body="Retrieving an answer from memory before checking it builds far stronger traces than re-reading ever could." />
        </div>
      </Card>
    </div>
  )
}

function StatCard({ icon: Icon, color, label, value }: { icon: React.ElementType; color: string; label: string; value: string }) {
  return (
    <Card className="p-4">
      <Icon className={cn('w-5 h-5 mb-2', color)} />
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  )
}

function ScienceBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="font-semibold mb-1">{title}</p>
      <p className="text-muted-foreground text-xs leading-relaxed">{body}</p>
    </div>
  )
}
