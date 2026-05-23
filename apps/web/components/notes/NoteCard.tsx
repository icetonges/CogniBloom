'use client'

import { useState } from 'react'
import { Bookmark, BookmarkPlus, Trash2, Edit2, Code, Zap, Image as ImageIcon, Trophy, Layers, Loader2, CheckCircle2, ExternalLink, Brain } from 'lucide-react'
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

// Deterministic color per subject (hashes subject string to an index)
const SUBJECT_COLORS = [
  { from: '#6366f1', to: '#8b5cf6', border: 'rgba(99,102,241,0.35)',   bg: 'rgba(99,102,241,0.07)'  },
  { from: '#10b981', to: '#0ea5e9', border: 'rgba(16,185,129,0.35)',   bg: 'rgba(16,185,129,0.07)'  },
  { from: '#f59e0b', to: '#ef4444', border: 'rgba(245,158,11,0.35)',   bg: 'rgba(245,158,11,0.07)'  },
  { from: '#ec4899', to: '#a855f7', border: 'rgba(236,72,153,0.35)',   bg: 'rgba(236,72,153,0.07)'  },
  { from: '#0ea5e9', to: '#6366f1', border: 'rgba(14,165,233,0.35)',   bg: 'rgba(14,165,233,0.07)'  },
  { from: '#14b8a6', to: '#10b981', border: 'rgba(20,184,166,0.35)',   bg: 'rgba(20,184,166,0.07)'  },
]

function subjectColor(subject?: string | null) {
  if (!subject) return SUBJECT_COLORS[0]
  let hash = 0
  for (const c of subject) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length]
}

export function NoteCard({ note, onEdit, onDelete, onToggleBookmark }: NoteCardProps) {
  const router = useRouter()
  const [makingCards, setMakingCards] = useState(false)
  const [cardsMade, setCardsMade] = useState(false)
  const preview = note.content.replace(/<[^>]+>/g, '').replace(/[#*_`\[\]()]/g, '').substring(0, 100)
  const color = subjectColor(note.subject)

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
    <div
      role="button"
      tabIndex={0}
      onClick={() => note.slug ? router.push(`/dashboard/notes/${note.slug}`) : onEdit?.(note)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (note.slug) router.push(`/dashboard/notes/${note.slug}`)
          else onEdit?.(note)
        }
      }}
      className="group rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200 hover:scale-[1.01] hover:-translate-y-0.5 cursor-pointer"
      style={{
        background: color.bg,
        border: `1px solid ${color.border}`,
        boxShadow: `0 4px 20px ${color.from}12`,
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Colored accent dot + title */}
          <div className="flex items-start gap-2">
            <div
              className="w-2 h-2 rounded-full mt-1.5 shrink-0"
              style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})`, boxShadow: `0 0 6px ${color.from}80` }}
            />
            <h3 className="font-bold text-sm leading-snug line-clamp-2">{note.title}</h3>
          </div>
          {note.subject && (
            <span
              className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md mt-1.5"
              style={{ background: `${color.from}20`, color: color.from }}
            >
              {note.subject}
            </span>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onToggleBookmark?.(note.id) }}
          className="shrink-0 p-1 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
        >
          {note.isBookmarked
            ? <Bookmark className="h-4 w-4 fill-current text-primary" />
            : <BookmarkPlus className="h-4 w-4" />}
        </button>
      </div>

      {/* ── Preview ── */}
      {preview && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {preview}{note.content.length > 100 ? '…' : ''}
        </p>
      )}

      {/* ── Feature pills ── */}
      {(note.hasMath || note.hasCode || note.hasImages) && (
        <div className="flex gap-1.5 flex-wrap">
          {note.hasMath && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }}>
              <Zap className="h-2.5 w-2.5" /> Math
            </span>
          )}
          {note.hasCode && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Code className="h-2.5 w-2.5" /> Code
            </span>
          )}
          {note.hasImages && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(14,165,233,0.12)', color: '#7dd3fc', border: '1px solid rgba(14,165,233,0.2)' }}>
              <ImageIcon className="h-2.5 w-2.5" /> Images
            </span>
          )}
        </div>
      )}

      {/* ── Tags ── */}
      {note.tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {note.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'inherit' }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] mt-auto">
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
          </p>
          {/* AI analysis indicator */}
          {note.aiAnalyzedAt && (
            <span title="AI analyzed" className="text-[10px] flex items-center gap-0.5" style={{ color: '#a5b4fc' }}>
              <Brain className="h-2.5 w-2.5" /> AI
            </span>
          )}
          {/* Published indicator */}
          {note.publishedSlug && (
            <a
              href={`/notes/view/${note.publishedSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              title="View published page"
              className="text-[10px] flex items-center gap-0.5 hover:underline"
              style={{ color: '#10b981' }}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-2.5 w-2.5" /> Published
            </a>
          )}
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Quiz */}
          <button onClick={quizMe} title="Quiz me on this"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
            <Trophy className="h-3.5 w-3.5" />
          </button>

          {/* Flashcards */}
          <button onClick={makeFlashcards} disabled={makingCards || cardsMade}
            title={cardsMade ? 'Flashcards created!' : 'Make flashcards'}
            className={cn('p-1.5 rounded-lg transition-colors',
              cardsMade ? 'text-emerald-400' : 'text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10'
            )}>
            {makingCards
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : cardsMade
                ? <CheckCircle2 className="h-3.5 w-3.5" />
                : <Layers className="h-3.5 w-3.5" />}
          </button>

          {/* View published page or publish shortcut */}
          {note.publishedSlug ? (
            <a
              href={`/notes/view/${note.publishedSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              title="View published page"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}

          {/* Edit */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (note.slug) router.push(`/dashboard/notes/${note.slug}`)
              else onEdit?.(note)
            }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>

          {/* Delete */}
          <button onClick={(e) => { e.stopPropagation(); onDelete?.(note.id) }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
