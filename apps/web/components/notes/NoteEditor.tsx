'use client'

import { useState } from 'react'
import {
  Loader2, X, Sparkles, Layers, Trophy, Save,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useNotes } from '@/hooks/useNotes'
import { RichEditor } from './RichEditor'
import { NoteAnalysis } from './NoteAnalysis'
import { cn } from '@/lib/utils'
import type { Note, CreateNoteInput, UpdateNoteInput } from '@/hooks/useNotes'

interface NoteEditorProps {
  note?: Note | null
  onClose?: () => void
  onSave?: (note: Note) => void
  existingSubjects?: string[]
}

const SUBJECT_PRESETS = [
  'Math', 'AMC Math', 'Science', 'Physics', 'Chemistry', 'Biology',
  'English', 'History', 'Coding', 'Language', 'Geography', 'Economics',
]

export function NoteEditor({ note, onClose, onSave, existingSubjects = [] }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [subject, setSubject] = useState(note?.subject ?? '')
  const [tags, setTags] = useState(note?.tags.join(', ') ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<Note | null>(note ?? null)
  const [isGeneratingCards, setIsGeneratingCards] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(!!(note?.mindMap || note?.tutorSummary))

  const notesHook = useNotes()
  const router = useRouter()

  // Merge presets + DB subjects, deduplicate
  const allSubjects = Array.from(new Set([...SUBJECT_PRESETS, ...existingSubjects])).sort()

  const wordCount = content.replace(/<[^>]+>/g, '').trim().split(/\s+/).filter(Boolean).length

  const parseTagArray = () => tags.split(',').map((t) => t.trim()).filter(Boolean)

  const doSave = async (): Promise<Note> => {
    const tagArray = parseTagArray()
    const hasMath = /\$.*?\$|\\[.*?\\]|\\\(.*?\\\)/.test(content)
    const hasCode = /<code|<pre/.test(content)
    const hasImages = /<img/.test(content)

    if (note) {
      const data: UpdateNoteInput = {
        title, content, subject: subject.trim() || undefined, tags: tagArray,
      }
      return notesHook.updateNote(note.id, data)
    }
    const data: CreateNoteInput = {
      title, content, subject: subject.trim() || undefined, tags: tagArray,
    }
    // Pass rich content flags through the API body
    return notesHook.createNote({ ...data, hasMath, hasCode, hasImages } as CreateNoteInput)
  }

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    if (!content.replace(/<[^>]+>/g, '').trim()) { setError('Content is required'); return }
    setIsSaving(true); setError(null)
    try {
      const saved = await doSave()
      setSavedNote(saved)
      onSave?.(saved)
      setShowAnalysis(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveAndAnalyze = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    if (!content.replace(/<[^>]+>/g, '').trim()) { setError('Content is required'); return }
    setIsSaving(true); setError(null)
    try {
      const saved = await doSave()
      setSavedNote(saved)
      onSave?.(saved)
      setShowAnalysis(true)
      // Trigger analysis immediately after save
      await fetch(`/api/notes/${saved.id}/analyze`, { method: 'POST' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black tracking-tight">
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            {note ? 'Edit Note' : 'New Note'}
          </span>
        </h2>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="rounded-xl p-3 text-sm flex items-center gap-2"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Metadata ── */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Title */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 block">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title…"
            disabled={isSaving}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold focus:outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              color: 'inherit',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none' }}
          />
        </div>

        {/* Subject + Tags row */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 block">
              Subject <span className="font-normal normal-case">(type anything)</span>
            </label>
            {/* Free-text input with datalist suggestions */}
            <input
              list="subject-list"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="AMC Math, AP Chemistry, History…"
              disabled={isSaving}
              className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: 'inherit',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none' }}
            />
            <datalist id="subject-list">
              {allSubjects.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 block">
              Tags <span className="font-normal normal-case">(comma-separated)</span>
            </label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="important, exam, review"
              disabled={isSaving}
              className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: 'inherit',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
        </div>

        {/* Subject quick-pick chips */}
        <div className="flex flex-wrap gap-1.5">
          {SUBJECT_PRESETS.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSubject(s)}
              className={cn(
                'text-xs px-3 py-1 rounded-full font-semibold transition-all',
                subject === s ? 'text-white' : 'text-muted-foreground hover:text-foreground'
              )}
              style={subject === s
                ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 2px 10px rgba(99,102,241,0.35)' }
                : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Rich Editor ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Content</label>
          <span className="text-xs text-muted-foreground">{wordCount} words</span>
        </div>
        <RichEditor
          content={content}
          onChange={setContent}
          disabled={isSaving}
          noteId={savedNote?.id}
        />
      </div>

      {/* ── Actions ── */}
      <div
        className="rounded-2xl p-4 flex items-center gap-2 flex-wrap justify-between"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Left: secondary actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {savedNote && (
            <button
              disabled={isGeneratingCards || isSaving}
              onClick={async () => {
                setIsGeneratingCards(true)
                try {
                  await fetch('/api/flashcards', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ noteId: savedNote.id, count: 8 }),
                  })
                } finally { setIsGeneratingCards(false) }
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-semibold transition-all disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'inherit' }}
            >
              {isGeneratingCards ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
              Flashcards
            </button>
          )}
          {title.trim() && (
            <button
              onClick={() => {
                const params = new URLSearchParams({ topic: title.trim() })
                if (subject.trim()) params.set('subject', subject.trim())
                router.push(`/dashboard/quiz?${params}`)
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'inherit' }}
            >
              <Trophy className="h-3.5 w-3.5" /> Quiz me
            </button>
          )}
        </div>

        {/* Right: save actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-xs px-3 py-2 rounded-lg font-semibold text-muted-foreground hover:text-foreground transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-bold text-white transition-all disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
          <button
            onClick={handleSaveAndAnalyze}
            disabled={isSaving}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-bold text-white transition-all disabled:opacity-50 hover:scale-105"
            style={{
              background: isSaving ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: isSaving ? 'none' : '0 4px 16px rgba(99,102,241,0.4)',
            }}
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Save + AI Analysis
          </button>
        </div>
      </div>

      {/* ── AI Analysis Panel ── */}
      {showAnalysis && savedNote && (
        <NoteAnalysis
          noteId={savedNote.id}
          mindMap={savedNote.mindMap}
          reasoningHints={savedNote.reasoningHints}
          knowledgePoints={savedNote.knowledgePoints}
          tutorSummary={savedNote.tutorSummary}
          aiAnalyzedAt={savedNote.aiAnalyzedAt}
          publishedSlug={savedNote.publishedSlug}
          onAnalyze={() => {}}
        />
      )}
    </div>
  )
}
