'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Bookmark,
  BookmarkPlus,
  Trash2,
  Edit2,
  Code,
  Zap,
  Image as ImageIcon,
  Trophy,
  Layers,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Note } from '@/hooks/useNotes'

interface NoteCardProps {
  note: Note
  onEdit?: (note: Note) => void
  onDelete?: (noteId: string) => void
  onToggleBookmark?: (noteId: string) => void
}

export function NoteCard({
  note,
  onEdit,
  onDelete,
  onToggleBookmark,
}: NoteCardProps) {
  const router = useRouter()
  const [makingCards, setMakingCards] = useState(false)
  const [cardsMade, setCardsMade] = useState(false)
  const preview = note.content
    .replace(/[#*_`\[\]()]/g, '')
    .substring(0, 100)

  const makeFlashcards = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (makingCards || cardsMade) return
    setMakingCards(true)
    try {
      await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: note.id, count: 8 }),
      })
      setCardsMade(true)
    } finally {
      setMakingCards(false)
    }
  }

  const quizMe = (e: React.MouseEvent) => {
    e.stopPropagation()
    const params = new URLSearchParams({ topic: note.title })
    if (note.subject) params.set('subject', note.subject)
    router.push(`/dashboard/quiz?${params}`)
  }

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="font-semibold line-clamp-2">{note.title}</h3>
            {note.subject && (
              <p className="text-xs text-muted-foreground">{note.subject}</p>
            )}
          </div>
          <button
            onClick={() => onToggleBookmark?.(note.id)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {note.isBookmarked ? (
              <Bookmark className="h-5 w-5 fill-current text-primary" />
            ) : (
              <BookmarkPlus className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Preview */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {preview}
          {note.content.length > 100 ? '...' : ''}
        </p>

        {/* Features */}
        <div className="flex gap-2 flex-wrap">
          {note.hasMath && (
            <div className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
              <Zap className="h-3 w-3" />
              Math
            </div>
          )}
          {note.hasCode && (
            <div className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
              <Code className="h-3 w-3" />
              Code
            </div>
          )}
          {note.hasImages && (
            <div className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
              <ImageIcon className="h-3 w-3" />
              Images
            </div>
          )}
        </div>

        {/* Tags */}
        {note.tags.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {note.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(note.updatedAt), {
              addSuffix: true,
            })}
          </p>
          <div className="flex gap-1">
            {/* Quiz me */}
            <button
              onClick={quizMe}
              title="Quiz me on this"
              className="p-1.5 rounded-md text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
            >
              <Trophy className="h-3.5 w-3.5" />
            </button>
            {/* Make flashcards */}
            <button
              onClick={makeFlashcards}
              disabled={makingCards || cardsMade}
              title={cardsMade ? 'Flashcards created!' : 'Make flashcards'}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                cardsMade
                  ? 'text-green-500'
                  : 'text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10'
              )}
            >
              {makingCards
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : cardsMade
                  ? <CheckCircle2 className="h-3.5 w-3.5" />
                  : <Layers className="h-3.5 w-3.5" />}
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit?.(note)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete?.(note.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
