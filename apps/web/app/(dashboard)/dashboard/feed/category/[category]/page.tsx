'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2, RefreshCw, ExternalLink, BookOpen, Layers,
  CheckCircle2, Trophy, ChevronLeft, ChevronDown, ChevronUp,
  Cpu, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CATEGORY_META } from '@/lib/feed/sources'

interface FeedItem {
  id: string
  category: string
  sourceName: string | null
  title: string
  summary: string
  body: string | null
  url: string | null
  imageUrl: string | null
  emoji: string
  tags: string[]
  difficulty: string
  estimatedMinutes: number
  contentType: string
  author: string | null
  publishedAt: string | null
  isAiGenerated: boolean
  createdAt: string
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-green-500/10 text-green-700 dark:text-green-400',
  medium: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  hard: 'bg-red-400/10 text-red-600 dark:text-red-400',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const todayStr = now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === todayStr) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function CategoryFeedCard({ item }: { item: FeedItem }) {
  const [expanded, setExpanded] = useState(false)
  const [savedNote, setSavedNote] = useState(false)
  const [savedFlashcard, setSavedFlashcard] = useState(false)
  const [saving, setSaving] = useState<'note' | 'flashcard' | null>(null)
  const router = useRouter()

  const saveAsNote = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setSaving('note')
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          content: `# ${item.title}\n\n${item.summary}${item.body ? `\n\n${item.body}` : ''}${item.url ? `\n\n**Source:** [Read more](${item.url})` : ''}`,
          subject: item.category,
          tags: item.tags,
        }),
      })
      setSavedNote(true)
    } finally {
      setSaving(null)
    }
  }

  const makeFlashcard = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setSaving('flashcard')
    try {
      await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          front: item.title,
          back: (item.body || item.summary).slice(0, 400),
          subject: item.category,
          tags: item.tags,
        }),
      })
      setSavedFlashcard(true)
    } finally {
      setSaving(null)
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-5 hover:border-primary/40 transition-colors">
      {/* Image */}
      {item.imageUrl && (
        <div className="w-full h-36 rounded-md overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Top row: emoji + badges */}
      <div
        className="flex items-start justify-between gap-2 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-2xl select-none">{item.emoji}</span>
        <div className="flex flex-col items-end gap-1">
          <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize', DIFFICULTY_COLORS[item.difficulty] ?? DIFFICULTY_COLORS['medium'])}>
            {item.difficulty}
          </span>
          {item.isAiGenerated && (
            <span className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Cpu className="w-2.5 h-2.5" /> AI
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        {item.sourceName && (
          <p className="text-xs text-muted-foreground mb-0.5">{item.sourceName}</p>
        )}
        <h3 className="font-semibold leading-snug text-sm">{item.title}</h3>
      </div>

      {/* Summary / body */}
      <p
        className={cn('text-sm text-muted-foreground leading-relaxed cursor-pointer', !expanded && 'line-clamp-3')}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded && item.body ? item.body : item.summary}
      </p>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-primary self-start -mt-1 hover:underline"
      >
        {expanded
          ? <><ChevronUp className="w-3 h-3" /> Show less</>
          : <><ChevronDown className="w-3 h-3" /> Read more</>}
      </button>

      {/* Tags */}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 -mt-1">
          {item.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Source link */}
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-600 hover:underline self-start -mt-1"
        >
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
          Read full article
        </a>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>⏱ ~{item.estimatedMinutes} min</span>
          {item.publishedAt && (
            <span>· {formatDate(item.publishedAt)}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/quiz?topic=${encodeURIComponent(item.title)}`) }}
            title="Quiz me on this"
            className="p-1.5 rounded-md text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
          >
            <Trophy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={makeFlashcard}
            disabled={saving === 'flashcard' || savedFlashcard}
            title={savedFlashcard ? 'Saved!' : 'Save as flashcard'}
            className={cn('p-1.5 rounded-md transition-colors', savedFlashcard ? 'text-green-500' : 'text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10')}
          >
            {saving === 'flashcard' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : savedFlashcard ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={saveAsNote}
            disabled={saving === 'note' || savedNote}
            title={savedNote ? 'Saved!' : 'Save to notes'}
            className={cn('p-1.5 rounded-md transition-colors', savedNote ? 'text-green-500' : 'text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10')}
          >
            {saving === 'note' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : savedNote ? <CheckCircle2 className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </Card>
  )
}

export default function CategoryFeedPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.category as string

  const meta = CATEGORY_META.find((c) => c.slug === slug)

  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFallback, setIsFallback] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadFeed = useCallback(async (reset = false) => {
    if (reset) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/feed/${slug}?page=1&pageSize=12`)
      if (!res.ok) throw new Error('Failed to load feed')
      const { data, meta: m } = await res.json()
      setItems(data)
      setHasMore(m.hasMore ?? false)
      setIsFallback(m.isFallback ?? false)
      setPage(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [slug])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const next = page + 1
      const res = await fetch(`/api/feed/${slug}?page=${next}&pageSize=12`)
      if (!res.ok) return
      const { data, meta: m } = await res.json()
      setItems((prev) => [...prev, ...data])
      setHasMore(m.hasMore ?? false)
      setPage(next)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => { loadFeed() }, [loadFeed])

  if (!meta) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Unknown category: {slug}</p>
        <Button onClick={() => router.push('/dashboard/feed')}>← Back to Feed</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard/feed')}
          className="mt-1 -ml-2 gap-1 text-muted-foreground"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          All Feeds
        </Button>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">
            {meta.emoji} {meta.label}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{meta.description}</p>
          {isFallback && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Showing most recent items — today&apos;s feed will appear after the next ingest run.
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadFeed(true)}
          disabled={refreshing}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          {refreshing ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {/* Category nav strip */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted">
        {CATEGORY_META.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => router.push(`/dashboard/feed/category/${cat.slug}`)}
            className={cn(
              'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
              cat.slug === slug
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            )}
          >
            <span>{cat.emoji}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <p className="text-sm">Loading {meta.label} feed…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-destructive text-sm">{error}</p>
          <Button onClick={() => loadFeed()}>Retry</Button>
        </div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <p className="text-4xl mb-4">{meta.emoji}</p>
          <p className="font-medium mb-1">No {meta.label} items yet</p>
          <p className="text-sm mb-4">The daily ingest hasn&apos;t run for this category yet.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/feed/sources')}
            className="gap-2"
          >
            <Zap className="w-3.5 h-3.5" />
            View source status
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <CategoryFeedCard key={item.id} item={item} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={loadingMore}
                className="gap-2"
              >
                {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-center text-muted-foreground pb-4">
        Content sourced from real feeds and AI. Always verify important facts from original sources.
      </p>
    </div>
  )
}
