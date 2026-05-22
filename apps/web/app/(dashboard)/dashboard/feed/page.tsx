'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FeedItem } from '@/app/api/feed/route'

const DIFFICULTY_COLORS = {
  easy: 'bg-green-500/10 text-green-700 dark:text-green-400',
  medium: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  hard: 'bg-red-400/10 text-red-600 dark:text-red-400',
}

export default function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

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

  useEffect(() => { loadFeed() }, [])

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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Daily Feed 📚</h1>
          <p className="text-muted-foreground mt-1">
            Fresh learning bites, generated just for you.
            {generatedAt && (
              <span className="text-xs ml-2 opacity-60">
                Generated {new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadFeed(true)}
          disabled={refreshing}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Feed grid */}
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

      <p className="text-xs text-center text-muted-foreground pb-4">
        🤖 All content is AI-generated for educational purposes. Always verify important facts.
      </p>
    </div>
  )
}

function FeedCard({ item }: { item: FeedItem }) {
  const [expanded, setExpanded] = useState(false)

  const typeLabel: Record<FeedItem['type'], string> = {
    fact: 'Fun Fact',
    challenge: 'Challenge',
    vocabulary: 'Vocabulary',
    puzzle: 'Puzzle',
    tip: 'Study Tip',
  }

  return (
    <Card
      className="p-5 flex flex-col gap-3 hover:border-primary/40 transition-colors cursor-pointer"
      onClick={() => setExpanded((v) => !v)}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-3xl">{item.emoji}</span>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
            {typeLabel[item.type]}
          </span>
          <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize', DIFFICULTY_COLORS[item.difficulty])}>
            {item.difficulty}
          </span>
        </div>
      </div>

      {/* Title */}
      <div>
        <p className="text-xs font-medium text-primary mb-0.5">{item.subject}</p>
        <h3 className="font-semibold leading-snug">{item.title}</h3>
      </div>

      {/* Body — truncated unless expanded */}
      <p className={cn('text-sm text-muted-foreground leading-relaxed', !expanded && 'line-clamp-3')}>
        {item.body}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-xs text-muted-foreground">⏱ ~{item.estimatedMinutes} min</span>
        <span className="text-xs text-primary">{expanded ? 'Show less ↑' : 'Read more ↓'}</span>
      </div>
    </Card>
  )
}
