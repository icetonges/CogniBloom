'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Loader2, X, Sparkles, BookOpen, AlertCircle, ChevronRight } from 'lucide-react'
import { useNotes } from '@/hooks/useNotes'
import { cn } from '@/lib/utils'
import type { Note, CreateNoteInput, UpdateNoteInput } from '@/hooks/useNotes'

interface NoteReview {
  summary: string
  keyPoints: string[]
  weakAreas: string[]
  masteryEstimate: number
  recommendations: string[]
}

interface NoteEditorProps {
  note?: Note | null
  onClose?: () => void
  onSave?: (note: Note) => void
}

const SUBJECT_SUGGESTIONS = ['Math', 'Science', 'English', 'History', 'Coding', 'Language', 'Geography']

export function NoteEditor({ note, onClose, onSave }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [subject, setSubject] = useState(note?.subject ?? '')
  const [tags, setTags] = useState(note?.tags.join(', ') ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)
  const [review, setReview] = useState<NoteReview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedNoteId, setSavedNoteId] = useState<string | null>(note?.id ?? null)

  const notesHook = useNotes()

  const parseTagArray = () =>
    tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0)

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      let savedNote: Note
      if (note) {
        const updateData: UpdateNoteInput = { title, content, subject: subject || undefined, tags: parseTagArray() }
        savedNote = await notesHook.updateNote(note.id, updateData)
      } else {
        const createData: CreateNoteInput = { title, content, subject: subject || undefined, tags: parseTagArray() }
        savedNote = await notesHook.createNote(createData)
      }
      setSavedNoteId(savedNote.id)
      onSave?.(savedNote)
      onClose?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveAndReview = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required')
      return
    }
    setIsSaving(true)
    setError(null)
    let targetId = savedNoteId

    try {
      let savedNote: Note
      if (note) {
        const updateData: UpdateNoteInput = { title, content, subject: subject || undefined, tags: parseTagArray() }
        savedNote = await notesHook.updateNote(note.id, updateData)
      } else {
        const createData: CreateNoteInput = { title, content, subject: subject || undefined, tags: parseTagArray() }
        savedNote = await notesHook.createNote(createData)
      }
      targetId = savedNote.id
      setSavedNoteId(targetId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note')
      setIsSaving(false)
      return
    }
    setIsSaving(false)

    // Now generate AI review
    if (!targetId) return
    setIsReviewing(true)
    try {
      const res = await fetch(`/api/notes/${targetId}/review`, { method: 'POST' })
      const json = await res.json() as { success: boolean; data: NoteReview }
      if (json.success && json.data) setReview(json.data)
    } catch {
      setError('AI review failed — your note was saved successfully.')
    } finally {
      setIsReviewing(false)
    }
  }

  const masteryPct = review ? Math.round(review.masteryEstimate * 100) : 0
  const masteryColor =
    masteryPct >= 75 ? 'text-green-500' : masteryPct >= 50 ? 'text-amber-500' : 'text-red-500'

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <Card className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{note ? 'Edit Note' : 'New Note'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title..." disabled={isSaving} />
          </div>

          {/* Subject */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Subject <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Math, Science, Language…" disabled={isSaving} />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SUBJECT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSubject(s)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border transition-colors',
                    subject === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tags <span className="text-muted-foreground font-normal">(comma-separated)</span></label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="important, review, exam" disabled={isSaving} />
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">Content</label>
              <span className="text-xs text-muted-foreground">
                {content.trim() ? content.trim().split(/\s+/).length : 0} words · {content.length} chars
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Supports Markdown, LaTeX ($...$), and code blocks (```lang...```)
            </p>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note here…"
              className="w-full h-64 p-3 border border-input rounded-md font-mono text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
              disabled={isSaving}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t flex-wrap">
          <Button variant="outline" onClick={onClose} disabled={isSaving || isReviewing}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handleSaveAndReview} disabled={isSaving || isReviewing} className="gap-1.5">
            {isReviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isReviewing ? 'Reviewing…' : 'Save + AI Review'}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isReviewing}>
            {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save Note'}
          </Button>
        </div>
      </Card>

      {/* AI Review Panel */}
      {review && (
        <Card className="p-5 space-y-4 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">AI Note Review</h3>
            <span className={cn('ml-auto text-sm font-bold', masteryColor)}>
              {masteryPct}% mastery
            </span>
          </div>

          {/* Mastery bar */}
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={cn('h-2 rounded-full transition-all', masteryPct >= 75 ? 'bg-green-500' : masteryPct >= 50 ? 'bg-amber-500' : 'bg-red-500')}
              style={{ width: `${masteryPct}%` }}
            />
          </div>

          <p className="text-sm text-muted-foreground">{review.summary}</p>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Key points */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> Key Concepts
              </p>
              <ul className="space-y-1">
                {review.keyPoints.map((p, i) => (
                  <li key={i} className="text-sm flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">•</span> {p}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                <ChevronRight className="w-3 h-3" /> Next Steps
              </p>
              <ul className="space-y-1">
                {review.recommendations.map((r, i) => (
                  <li key={i} className="text-sm flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5">→</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {review.weakAreas.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <p className="text-xs font-semibold text-amber-600 mb-1">Areas to strengthen</p>
              <ul className="space-y-0.5">
                {review.weakAreas.map((w, i) => (
                  <li key={i} className="text-sm text-muted-foreground">⚠ {w}</li>
                ))}
              </ul>
            </div>
          )}

          <Button size="sm" variant="outline" onClick={onClose} className="w-full">
            Done — close editor
          </Button>
        </Card>
      )}
    </div>
  )
}
