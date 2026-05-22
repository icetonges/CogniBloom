'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Loader2, X } from 'lucide-react'
import { useNotes } from '@/hooks/useNotes'
import type { Note, CreateNoteInput, UpdateNoteInput } from '@/hooks/useNotes'

interface NoteEditorProps {
  note?: Note | null
  onClose?: () => void
  onSave?: (note: Note) => void
}

export function NoteEditor({ note, onClose, onSave }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title || '')
  const [content, setContent] = useState(note?.content || '')
  const [subject, setSubject] = useState(note?.subject || '')
  const [tags, setTags] = useState(note?.tags.join(', ') || '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const notesHook = useNotes()

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const tagArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      let savedNote: Note

      if (note) {
        // Update existing note
        const updateData: UpdateNoteInput = {
          title,
          content,
          subject: subject || undefined,
          tags: tagArray,
        }
        savedNote = await notesHook.updateNote(note.id, updateData)
      } else {
        // Create new note
        const createData: CreateNoteInput = {
          title,
          content,
          subject: subject || undefined,
          tags: tagArray,
        }
        savedNote = await notesHook.createNote(createData)
      }

      onSave?.(savedNote)
      onClose?.()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save note'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {note ? 'Edit Note' : 'New Note'}
        </h2>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="text-sm font-medium">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            disabled={isSaving}
          />
        </div>

        {/* Subject */}
        <div>
          <label className="text-sm font-medium">Subject (optional)</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Math, Science, Language, etc."
            disabled={isSaving}
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-sm font-medium">Tags (comma-separated)</label>
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="important, review, exam"
            disabled={isSaving}
          />
        </div>

        {/* Content */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium">Content</label>
            <span className="text-xs text-muted-foreground">
              {content.trim() ? content.trim().split(/\s+/).length : 0} words · {content.length} chars
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Supports Markdown, LaTeX ($...$), and code blocks (```...```)
          </p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note here... (Markdown supported)"
            className="w-full h-64 p-3 border border-input rounded-md font-mono text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            disabled={isSaving}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-4 border-t">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Note'
          )}
        </Button>
      </div>

      {/* Helper Text */}
      <div className="pt-4 border-t space-y-2 text-sm text-muted-foreground">
        <p>
          <strong>Tips:</strong>
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>Use Markdown for formatting (# heading, **bold**, etc.)</li>
          <li>Use $...$ or \(...\) for inline math (LaTeX)</li>
          <li>Use ```language...``` for code blocks</li>
          <li>Your note will be automatically analyzed for content features</li>
        </ul>
      </div>
    </Card>
  )
}
