'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, ExternalLink, BookOpen, Archive, Tag, Calendar, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PublishedNote {
  id: string
  title: string
  subject: string | null
  publishedSlug: string
  publishedAt: string | null
  createdAt: string
  tutorSummary: string | null
  tags: string[]
}

const SUBJECT_COLORS: Record<string, { border: string; badge: string; text: string }> = {}
const PALETTE = [
  { border: 'border-violet-500/30', badge: 'bg-violet-500/15 text-violet-300', text: 'text-violet-400' },
  { border: 'border-emerald-500/30', badge: 'bg-emerald-500/15 text-emerald-300', text: 'text-emerald-400' },
  { border: 'border-amber-500/30',  badge: 'bg-amber-500/15 text-amber-300',  text: 'text-amber-400'  },
  { border: 'border-sky-500/30',    badge: 'bg-sky-500/15 text-sky-300',    text: 'text-sky-400'    },
  { border: 'border-rose-500/30',   badge: 'bg-rose-500/15 text-rose-300',   text: 'text-rose-400'   },
  { border: 'border-teal-500/30',   badge: 'bg-teal-500/15 text-teal-300',   text: 'text-teal-400'   },
]
function colorFor(subject: string | null) {
  if (!subject) return PALETTE[0]!
  if (!SUBJECT_COLORS[subject]) {
    let h = 0
    for (const c of subject) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
    SUBJECT_COLORS[subject] = PALETTE[Math.abs(h) % PALETTE.length]!
  }
  return SUBJECT_COLORS[subject]!
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function stripHtml(html: string | null): string {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
}

export default function ArchivePage() {
  const [notes, setNotes] = useState<PublishedNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/notes/published')
      .then((r) => r.json())
      .then((res) => { if (res.success) setNotes(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 18px rgba(99,102,241,0.4)' }}
        >
          <Archive className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Published Archive
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? 'Loading…' : `${notes.length} published note${notes.length !== 1 ? 's' : ''} — each with a permanent public link`}
          </p>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium">No published notes yet.</p>
          <p className="text-sm text-muted-foreground/60 max-w-xs">
            Open any note, run AI analysis, then click <strong>Publish</strong> to add it here.
          </p>
          <Link
            href="/dashboard/notes"
            className="mt-2 px-5 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
          >
            Go to Notes
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => {
            const colors = colorFor(note.subject)
            const preview = stripHtml(note.tutorSummary)
            return (
              <div
                key={note.id}
                className={cn(
                  'group relative rounded-2xl border bg-card p-5 flex flex-col gap-3 transition-all duration-200',
                  'hover:shadow-lg hover:-translate-y-0.5',
                  colors.border
                )}
              >
                {/* Subject badge */}
                {note.subject && (
                  <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-0.5 w-fit', colors.badge)}>
                    <Tag className="w-3 h-3" />
                    {note.subject}
                  </span>
                )}

                {/* Title */}
                <h3 className="font-bold text-sm leading-snug line-clamp-2 flex-1">
                  {note.title}
                </h3>

                {/* AI tutor preview */}
                {preview && (
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed flex items-start gap-1.5">
                    <Brain className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', colors.text)} />
                    {preview}
                  </p>
                )}

                {/* Date row */}
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  Published {fmtDate(note.publishedAt)}
                </div>

                {/* Tags */}
                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {note.tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* View link */}
                <a
                  href={`/notes/view/${note.publishedSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'inline-flex items-center gap-1.5 text-xs font-semibold transition-colors',
                    colors.text, 'hover:opacity-80'
                  )}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open published page
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
