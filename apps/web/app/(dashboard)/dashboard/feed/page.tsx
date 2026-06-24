'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2, RefreshCw, BookOpen, Trophy, Layers, CheckCircle2,
  ChevronDown, ChevronUp, ExternalLink, History, Settings2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import type { FeedItem } from '@/app/api/feed/route'
import { CATEGORY_META } from '@/lib/feed/meta'

const DIFFICULTY_COLORS = {
  easy: 'bg-green-500/10 text-green-700 dark:text-green-400',
  medium: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  hard: 'bg-red-400/10 text-red-600 dark:text-red-400',
}

const TYPE_LABELS: Record<FeedItem['type'], string> = {
  fact: 'Fun Fact',
  challenge: 'Challenge',
  vocabulary: 'Vocabulary',
  puzzle: 'Puzzle',
  tip: 'Study Tip',
}

/** Format a date as "Today", "Yesterday", or "May 23" etc. */
function formatDateLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const todayStr = now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === todayStr) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

export default function FeedPage() {
  const router = useRouter()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  // History state
  const [historyItems, setHistoryItems] = useState<FeedItem[]>([])
  const [historyPage, setHistoryPage] = useState(2)
  const [hasMore, setHasMore] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const loadFeed = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/feed${refresh ? '?refresh=true' : ''}`)
      if (!res.ok) throw new Error('Failed to load feed')
      const { data, meta } = await res.json()
      setItems(data)
      setGeneratedAt(meta.generatedAt)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadHistory = async (page: number, append = false) => {
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/feed?page=${page}`)
      if (!res.ok) return
      const { data, meta } = await res.json()
      setHistoryItems((prev) => append ? [...prev, ...data] : data)
      setHasMore(meta.hasMore ?? false)
      setHistoryPage(page + 1)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => { loadFeed() }, [])

  const handleShowHistory = () => {
    if (!showHistory) {
      setShowHistory(true)
      if (historyItems.length === 0) loadHistory(2, false)
    } else {
      setShowHistory(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm">Generating your personalised learning feed...</p>
        <p className="text-xs opacity-60">This takes about 10 seconds on first load</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-destructive">{error}</p>
        <Button onClick={() => loadFeed()}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Daily Feed 📚</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Fresh learning bites, generated just for you.
            {generatedAt && (
              <span className="text-xs ml-2 opacity-60">
                {formatDateLabel(generatedAt)} · {new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/feed/sources')}
            className="gap-2"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Sources
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleShowHistory}
            className="gap-2"
          >
            <History className="w-3.5 h-3.5" />
            {showHistory ? 'Hide History' : 'History'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadFeed(true)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Category feed navigation */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Browse by Category</p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted">
          {CATEGORY_META.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => router.push(`/dashboard/feed/category/${cat.slug}`)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
            >
              <span>{cat.emoji}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Today's feed */}
      {items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <p>No feed items yet — hit Refresh to generate your first batch!</p>
          <Button className="mt-4" onClick={() => loadFeed(true)}>Generate Feed</Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Historical feed section */}
      {showHistory && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Previous Days</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {historyItems.length === 0 && loadingHistory && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {historyItems.length === 0 && !loadingHistory && (
            <p className="text-center text-sm text-muted-foreground py-6">No historical feed items yet.</p>
          )}

          {/* Group by date */}
          {(() => {
            const groups: Record<string, FeedItem[]> = {}
            for (const item of historyItems) {
              const label = item.createdAt ? formatDateLabel(item.createdAt) : 'Earlier'
              groups[label] = groups[label] ?? []
              groups[label]!.push(item)
            }
            return Object.entries(groups).map(([label, groupItems]) => (
              <div key={label} className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary/40 inline-block" />
                  {label}
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupItems.map((item) => (
                    <FeedCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            ))
          })()}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadHistory(historyPage, true)}
                disabled={loadingHistory}
                className="gap-2"
              >
                {loadingHistory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Load older entries
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-center text-muted-foreground pb-4">
        📡 Content sourced from real feeds and AI generation. Click any source link to read the full article.
      </p>
    </div>
  )
}

function FeedCard({ item }: { item: FeedItem }) {
  const [expanded, setExpanded] = useState(false)
  const [savedNote, setSavedNote] = useState(false)
  const [savedFlashcard, setSavedFlashcard] = useState(false)
  const [saving, setSaving] = useState<'note' | 'flashcard' | null>(null)
  const router = useRouter()
  const savingRef = useRef(false)

  const saveAsNote = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (savingRef.current) return
    savingRef.current = true
    setSaving('note')
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          content: `# ${item.title}\n\n${item.body}${item.sourceUrl ? `\n\n**Source:** [Read more on Wikipedia](${item.sourceUrl})` : ''}`,
          subject: item.subject,
          tags: [item.type, item.subject.toLowerCase()],
        }),
      })
      setSavedNote(true)
    } finally {
      setSaving(null)
      savingRef.current = false
    }
  }

  const makeFlashcard = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (savingRef.current) return
    savingRef.current = true
    setSaving('flashcard')
    try {
      await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ front: item.title, back: item.body.slice(0, 400), subject: item.subject, tags: [item.type] }),
      })
      setSavedFlashcard(true)
    } finally {
      setSaving(null)
      savingRef.current = false
    }
  }

  const quizMeOnThis = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/dashboard/quiz?topic=${encodeURIComponent(item.title)}&subject=${encodeURIComponent(item.subject)}`)
  }

  return (
    <Card className="p-5 flex flex-col gap-3 hover:border-primary/40 transition-colors">
      {/* Top row */}
      <div
        className="flex items-start justify-between gap-2 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-3xl select-none">{item.emoji}</span>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
            {TYPE_LABELS[item.type]}
          </span>
          <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize', DIFFICULTY_COLORS[item.difficulty])}>
            {item.difficulty}
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <p className="text-xs font-medium text-primary mb-0.5">{item.subject}</p>
        <h3 className="font-semibold leading-snug">{item.title}</h3>
      </div>

      {/* Body */}
      <p
        className={cn('text-sm text-muted-foreground leading-relaxed cursor-pointer', !expanded && 'line-clamp-3')}
        onClick={() => setExpanded((v) => !v)}
      >
        {item.body}
      </p>

      {/* Expand/collapse toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-primary self-start -mt-1 hover:underline"
      >
        {expanded
          ? <><ChevronUp className="w-3 h-3" /> Show less</>
          : <><ChevronDown className="w-3 h-3" /> Read more</>}
      </button>

      {/* Source link — always shown when available */}
      {item.sourceUrl && (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-600 hover:underline self-start -mt-1"
        >
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
          {item.sourceName
            ? `Read on ${item.sourceName}`
            : (() => {
                try {
                  const host = new URL(item.sourceUrl).hostname.replace(/^www\./, '')
                  return host.includes('wikipedia') ? 'Learn more on Wikipedia' : `Read on ${host}`
                } catch {
                  return 'Read full article'
                }
              })()}
        </a>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between mt-auto pt-1 border-t border-border">
        <span className="text-xs text-muted-foreground">⏱ ~{item.estimatedMinutes} min</span>
        <div className="flex items-center gap-1">
          {/* Quiz me */}
          <button
            onClick={quizMeOnThis}
            title="Quiz me on this"
            className="p-1.5 rounded-md text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
          >
            <Trophy className="w-3.5 h-3.5" />
          </button>

          {/* Flashcard */}
          <button
            onClick={makeFlashcard}
            disabled={saving === 'flashcard' || savedFlashcard}
            title={savedFlashcard ? 'Flashcard saved!' : 'Save as flashcard'}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              savedFlashcard
                ? 'text-green-500'
                : 'text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10'
            )}
          >
            {saving === 'flashcard'
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : savedFlashcard
                ? <CheckCircle2 className="w-3.5 h-3.5" />
                : <Layers className="w-3.5 h-3.5" />}
          </button>

          {/* Save as note */}
          <button
            onClick={saveAsNote}
            disabled={saving === 'note' || savedNote}
            title={savedNote ? 'Saved to notes!' : 'Save to my notes'}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              savedNote
                ? 'text-green-500'
                : 'text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10'
            )}
          >
            {saving === 'note'
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : savedNote
                ? <CheckCircle2 className="w-3.5 h-3.5" />
                : <BookOpen className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </Card>
  )
}
