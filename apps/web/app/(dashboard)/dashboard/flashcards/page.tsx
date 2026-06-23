'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Brain, Plus, ChevronRight, RotateCcw, CheckCircle2, XCircle, Zap, BookOpen, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Flashcard {
  id: string
  front: string
  back: string
  subject: string | null
  tags: string[]
  interval: number
  repetitions: number
  nextReviewAt: string
  totalReviews: number
  correctReviews: number
  noteId: string | null
}

interface Note {
  id: string
  title: string
  subject: string | null
}

type ReviewMode = 'idle' | 'reviewing' | 'done'

const RATING_LABELS = [
  { rating: 1, label: 'No idea', emoji: '😰', color: 'bg-red-500 hover:bg-red-600', short: 'Again' },
  { rating: 3, label: 'Got it with effort', emoji: '😅', color: 'bg-amber-500 hover:bg-amber-600', short: 'Hard' },
  { rating: 4, label: 'Correct', emoji: '😊', color: 'bg-blue-500 hover:bg-blue-600', short: 'Good' },
  { rating: 5, label: 'Perfect!', emoji: '🎯', color: 'bg-green-500 hover:bg-green-600', short: 'Easy' },
]

function intervalLabel(interval: number) {
  if (interval === 0) return 'New'
  if (interval === 1) return 'Tomorrow'
  if (interval < 7) return `${interval}d`
  if (interval < 30) return `${Math.round(interval / 7)}w`
  return `${Math.round(interval / 30)}mo`
}

export default function FlashcardsPage() {
  const [cards, setCards] = useState<Flashcard[]>([])
  const [dueCards, setDueCards] = useState<Flashcard[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [dueCount, setDueCount] = useState(0)

  // Review session state
  const [mode, setMode] = useState<ReviewMode>('idle')
  const [sessionCards, setSessionCards] = useState<Flashcard[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 })
  const [submitting, setSubmitting] = useState(false)

  // Generate modal state
  const [showGenerate, setShowGenerate] = useState(false)
  const [selectedNoteId, setSelectedNoteId] = useState('')
  const [cardCount, setCardCount] = useState(8)

  const loadCards = useCallback(() => {
    return Promise.all([
      fetch('/api/flashcards').then((r) => r.json()),
      fetch('/api/flashcards?due=true').then((r) => r.json()),
      fetch('/api/notes').then((r) => r.json()),
    ]).then(([all, due, notesRes]) => {
      if (all.success) { setCards(all.data); setDueCount(all.dueCount ?? 0) }
      if (due.success) setDueCards(due.data)
      if (notesRes.success) setNotes(notesRes.data.slice(0, 20))
    })
  }, [])

  useEffect(() => {
    loadCards().finally(() => setLoading(false))
  }, [loadCards])

  const startReview = () => {
    if (dueCards.length === 0) return
    setSessionCards([...dueCards])
    setCurrentIdx(0)
    setFlipped(false)
    setSessionStats({ correct: 0, total: 0 })
    setMode('reviewing')
  }

  const handleRate = async (rating: number) => {
    if (submitting) return
    setSubmitting(true)
    const card = sessionCards[currentIdx]
    const isCorrect = rating >= 3

    try {
      await fetch('/api/flashcards/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flashcardId: card.id, rating }),
      })
    } catch {
      // continue even if network hiccup
    }

    setSessionStats((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }))

    const next = currentIdx + 1
    if (next >= sessionCards.length) {
      setMode('done')
    } else {
      setCurrentIdx(next)
      setFlipped(false)
    }
    setSubmitting(false)
  }

  const generateCards = async () => {
    if (!selectedNoteId) return
    setGenerating(true)
    try {
      const res = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: selectedNoteId, count: cardCount }),
      })
      const json = await res.json()
      if (json.success) {
        setShowGenerate(false)
        setSelectedNoteId('')
        await loadCards()
      }
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // === REVIEW SESSION ===
  if (mode === 'reviewing' && sessionCards.length > 0) {
    const card = sessionCards[currentIdx]
    const progress = ((currentIdx) / sessionCards.length) * 100

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{currentIdx + 1} / {sessionCards.length}</span>
            <span>{sessionStats.correct} correct so far</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Flashcard */}
        <div
          className="cursor-pointer select-none"
          onClick={() => !flipped && setFlipped(true)}
        >
          <Card className={cn(
            'min-h-[280px] p-8 flex flex-col items-center justify-center text-center transition-all',
            !flipped && 'border-primary/30 bg-primary/5 hover:border-primary/60',
            flipped && 'border-green-500/30 bg-green-500/5',
          )}>
            {!flipped ? (
              <>
                <div className="mb-4">
                  <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">Question</span>
                </div>
                <p className="text-xl font-semibold leading-relaxed">{card.front}</p>
                {card.subject && (
                  <span className="mt-4 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{card.subject}</span>
                )}
                <p className="mt-6 text-sm text-muted-foreground flex items-center gap-1.5">
                  <ChevronRight className="w-4 h-4" />
                  Tap to reveal answer
                </p>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <span className="text-xs bg-green-500/10 text-green-600 px-3 py-1 rounded-full font-medium">Answer</span>
                </div>
                <p className="text-lg leading-relaxed">{card.back}</p>
              </>
            )}
          </Card>
        </div>

        {/* Rating buttons */}
        {flipped ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground font-medium">How well did you know it?</p>
            <div className="grid grid-cols-4 gap-2">
              {RATING_LABELS.map(({ rating, short, emoji, color }) => (
                <Button
                  key={rating}
                  disabled={submitting}
                  onClick={() => handleRate(rating)}
                  className={cn('text-white font-semibold gap-1 flex-col h-14', color)}
                >
                  <span className="text-base">{emoji}</span>
                  <span className="text-xs">{short}</span>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setFlipped(true)}>
            Show Answer
          </Button>
        )}
      </div>
    )
  }

  // === SESSION DONE ===
  if (mode === 'done') {
    const pct = Math.round((sessionStats.correct / sessionStats.total) * 100)
    const emoji = pct >= 80 ? '🎉' : pct >= 60 ? '💪' : '📚'
    return (
      <div className="max-w-lg mx-auto space-y-6 text-center py-8">
        <div className="text-6xl">{emoji}</div>
        <div>
          <h2 className="text-2xl font-bold">Session Complete!</h2>
          <p className="text-muted-foreground mt-1">
            You reviewed {sessionStats.total} card{sessionStats.total !== 1 ? 's' : ''}
          </p>
        </div>
        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-500">{sessionStats.correct}</p>
              <p className="text-xs text-muted-foreground">Correct</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{pct}%</p>
              <p className="text-xs text-muted-foreground">Accuracy</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{sessionStats.total - sessionStats.correct}</p>
              <p className="text-xs text-muted-foreground">To review again</p>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className={cn('h-3 rounded-full transition-all', pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-400')}
              style={{ width: `${pct}%` }}
            />
          </div>
        </Card>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => { setMode('idle'); loadCards() }}>
            <RotateCcw className="w-4 h-4 mr-2" /> Back to cards
          </Button>
          {dueCards.length > 0 && (
            <Button onClick={startReview}>
              <Brain className="w-4 h-4 mr-2" /> Review again
            </Button>
          )}
        </div>
      </div>
    )
  }

  // === MAIN VIEW ===
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Flashcards 🃏</h1>
          <p className="text-muted-foreground mt-1">
            Spaced repetition — review at the perfect time to maximise memory.
          </p>
        </div>
        <Button onClick={() => setShowGenerate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Generate from note
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{cards.length}</p>
          <p className="text-xs text-muted-foreground">Total cards</p>
        </Card>
        <Card className="p-4 text-center">
          <p className={cn('text-2xl font-bold', dueCount > 0 ? 'text-amber-500' : 'text-green-500')}>{dueCount}</p>
          <p className="text-xs text-muted-foreground">Due for review</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-500">
            {cards.length > 0 ? Math.round((cards.reduce((a, c) => a + (c.totalReviews > 0 ? c.correctReviews / c.totalReviews : 0), 0) / cards.length) * 100) : 0}%
          </p>
          <p className="text-xs text-muted-foreground">Avg accuracy</p>
        </Card>
      </div>

      {/* Review session CTA */}
      {dueCount > 0 && (
        <Card className="p-5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Brain className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="font-semibold">{dueCount} card{dueCount !== 1 ? 's' : ''} due for review</p>
                <p className="text-sm text-muted-foreground">Now is the optimal time to review — don&apos;t break the chain!</p>
              </div>
            </div>
            <Button onClick={startReview} className="shrink-0 gap-2">
              <Zap className="w-4 h-4" /> Start Review
            </Button>
          </div>
        </Card>
      )}

      {/* Cards list */}
      {cards.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <Layers className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-semibold">No flashcards yet</p>
          <p className="text-sm text-muted-foreground">Generate cards from your notes to start building your deck.</p>
          <Button variant="outline" onClick={() => setShowGenerate(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Generate from a note
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">All Cards ({cards.length})</h2>
          {cards.map((card) => {
            const isDue = new Date(card.nextReviewAt) <= new Date()
            const accuracy = card.totalReviews > 0 ? Math.round((card.correctReviews / card.totalReviews) * 100) : null
            return (
              <Card key={card.id} className={cn('p-3 flex items-start gap-3', isDue && 'border-amber-500/30')}>
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                  isDue ? 'bg-amber-500/10' : 'bg-muted'
                )}>
                  {isDue ? <Zap className="w-4 h-4 text-amber-500" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{card.front}</p>
                  <p className="text-xs text-muted-foreground truncate">{card.back}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {card.subject && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{card.subject}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Next: {intervalLabel(card.interval)}
                    </span>
                    {accuracy !== null && (
                      <span className={cn(
                        'text-xs',
                        accuracy >= 80 ? 'text-green-500' : accuracy >= 60 ? 'text-amber-500' : 'text-red-400'
                      )}>
                        {accuracy}% accuracy
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await fetch(`/api/flashcards?id=${card.id}`, { method: 'DELETE' })
                    setCards((prev) => prev.filter((c) => c.id !== card.id))
                    setDueCards((prev) => prev.filter((c) => c.id !== card.id))
                  }}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0"
                  title="Delete card"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </Card>
            )
          })}
        </div>
      )}

      {/* Generate modal */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 space-y-5 mx-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg">Generate Flashcards from Note</h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Select note</label>
                <select
                  value={selectedNoteId}
                  onChange={(e) => setSelectedNoteId(e.target.value)}
                  className="w-full text-sm bg-background text-foreground border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="" style={{ backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}>Choose a note…</option>
                  {notes.map((n) => (
                    <option key={n.id} value={n.id} style={{ backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}>
                      {n.title}{n.subject ? ` (${n.subject})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Number of cards: <span className="text-primary">{cardCount}</span>
                </label>
                <input
                  type="range"
                  min={4}
                  max={20}
                  step={2}
                  value={cardCount}
                  onChange={(e) => setCardCount(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>4</span><span>20</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowGenerate(false)} disabled={generating}>
                Cancel
              </Button>
              <Button onClick={generateCards} disabled={!selectedNoteId || generating} className="gap-2">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                {generating ? 'Generating…' : 'Generate'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
