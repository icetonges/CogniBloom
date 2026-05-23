'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Edit2, Sparkles, Download, Trash2,
  Loader2, BookOpen, Calendar, Tag, ChevronDown, ChevronUp,
  Save, X,
} from 'lucide-react'
import { formatNoteTitle, formatTimelineHeading, getDateGroupKey } from '@/lib/note-format'
import { NoteAnalysis } from '@/components/notes/NoteAnalysis'
import { RichEditor } from '@/components/notes/RichEditor'
import type { Note } from '@/hooks/useNotes'

interface NoteDetailClientProps {
  slug: string
}

export function NoteDetailClient({ slug }: NoteDetailClientProps) {
  const router = useRouter()
  const [note, setNote] = useState<Note | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Edit form state
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [editTags, setEditTags] = useState('')

  // Sanitized content for display
  const [safeHtml, setSafeHtml] = useState('')

  const fetchNote = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/notes/by-slug/${encodeURIComponent(slug)}`)
      if (res.status === 404) { setError('Note not found'); return }
      if (!res.ok) throw new Error('Failed to load note')
      const { data } = await res.json() as { data: Note }
      setNote(data)
      setEditTitle(data.title)
      setEditContent(data.content)
      setEditSubject(data.subject ?? '')
      setEditTags(data.tags.join(', '))
      // Show analysis panel if AI data exists
      if (data.mindMap || data.tutorSummary) setShowAnalysis(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load note')
    } finally {
      setIsLoading(false)
    }
  }, [slug])

  useEffect(() => { fetchNote() }, [fetchNote])

  // Sanitize HTML when note content changes
  useEffect(() => {
    if (!note?.content) return
    import('dompurify').then(({ default: DOMPurify }) => {
      const clean = DOMPurify.sanitize(note.content, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 's', 'del', 'ins',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
          'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
          'hr', 'div', 'span', 'mark', 'sup', 'sub',
        ],
        ALLOWED_ATTR: [
          'href', 'src', 'alt', 'title', 'class', 'id',
          'target', 'rel', 'width', 'height', 'colspan', 'rowspan',
        ],
        ALLOW_DATA_ATTR: false,
        FORCE_BODY: true,
      })
      setSafeHtml(clean)
    }).catch(() => setSafeHtml(note.content))
  }, [note?.content])

  const handleSave = async () => {
    if (!note) return
    if (!editTitle.trim()) { setSaveError('Title is required'); return }
    if (!editContent.replace(/<[^>]+>/g, '').trim()) { setSaveError('Content is required'); return }
    setIsSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent,
          subject: editSubject.trim() || null,
          tags: editTags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      const { data } = await res.json() as { data: Note }
      setNote(data)
      setMode('view')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!note || !confirm('Delete this note? This cannot be undone.')) return
    setIsDeleting(true)
    try {
      await fetch(`/api/notes/${note.id}`, { method: 'DELETE' })
      router.push('/dashboard/notes')
    } catch {
      setIsDeleting(false)
    }
  }

  const handleDownload = () => {
    if (!note) return
    const title = formatNoteTitle(note)
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
    h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #eee; }
    .tag { background: #f0f0f0; border-radius: 4px; padding: 2px 8px; font-size: 0.8rem; margin-right: 4px; }
    h2 { font-size: 1.4rem; margin-top: 2rem; }
    h3 { font-size: 1.2rem; }
    pre { background: #f8f8f8; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
    blockquote { border-left: 4px solid #6366f1; margin: 0; padding-left: 1rem; color: #555; }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; }
  </style>
</head>
<body>
  <h1>${note.title}</h1>
  <div class="meta">
    ${note.subject ? `<strong>${note.subject}</strong> · ` : ''}
    ${new Date(note.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    ${note.tags.length ? '· ' + note.tags.map((t) => `<span class="tag">#${t}</span>`).join(' ') : ''}
  </div>
  ${note.content}
</body>
</html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${note.slug || note.id}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !note) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <p className="text-4xl">📭</p>
        <p className="text-lg font-semibold">{error || 'Note not found'}</p>
        <button
          onClick={() => router.push('/dashboard/notes')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Notes
        </button>
      </div>
    )
  }

  const displayTitle = formatNoteTitle(note)
  const dateHeading = formatTimelineHeading(getDateGroupKey(note.createdAt))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── Top action bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Back */}
        <button
          onClick={() => router.push('/dashboard/notes')}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Notes
        </button>

        <div className="flex-1" />

        {/* Edit / View toggle */}
        {mode === 'view' ? (
          <button
            onClick={() => setMode('edit')}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all hover:scale-105"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'inherit' }}
          >
            <Edit2 className="h-3.5 w-3.5" /> Edit
          </button>
        ) : (
          <button
            onClick={() => { setMode('view'); setSaveError(null) }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'inherit' }}
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        )}

        {/* AI Analysis toggle */}
        <button
          onClick={() => setShowAnalysis((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
          style={
            showAnalysis
              ? { background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }
              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'inherit' }
          }
        >
          <Sparkles className="h-3.5 w-3.5" /> AI Analysis
          {showAnalysis ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {/* Download */}
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'inherit' }}
          title="Download as HTML"
        >
          <Download className="h-3.5 w-3.5" />
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all hover:text-red-400 disabled:opacity-50"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: 'inherit' }}
        >
          {isDeleting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* ── Note header card ── */}
      <div
        className="rounded-2xl px-6 py-5 space-y-3"
        style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.18)' }}
      >
        {/* Date */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{dateHeading}</span>
        </div>

        {/* Title */}
        {mode === 'view' ? (
          <h1 className="text-2xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {displayTitle}
            </span>
          </h1>
        ) : (
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 block">
              Title
            </label>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Note title…"
              className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold focus:outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: 'inherit',
              }}
            />
          </div>
        )}

        {/* Subject + tags row (view mode) */}
        {mode === 'view' && (
          <div className="flex flex-wrap items-center gap-2">
            {note.subject && (
              <button
                onClick={() =>
                  router.push(`/dashboard/notes?subject=${encodeURIComponent(note.subject!)}`)
                }
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full transition-all hover:scale-105"
                style={{
                  background: 'rgba(99,102,241,0.15)',
                  color: '#a5b4fc',
                  border: '1px solid rgba(99,102,241,0.25)',
                }}
              >
                <BookOpen className="h-3 w-3" />
                {note.subject}
              </button>
            )}
            {note.tags.map((tag) => (
              <button
                key={tag}
                onClick={() =>
                  router.push(`/dashboard/notes?tag=${encodeURIComponent(tag)}`)
                }
                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-all hover:opacity-80"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  color: 'inherit',
                }}
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-auto">
              Updated {new Date(note.updatedAt).toLocaleDateString()}
            </span>
          </div>
        )}

        {/* Edit mode: subject + tags fields */}
        {mode === 'edit' && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 block">
                Subject
              </label>
              <input
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                placeholder="AMC Math, AP Chemistry…"
                className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  color: 'inherit',
                }}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Note: subject changes won&apos;t affect the URL slug
              </p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 block">
                Tags (comma-separated)
              </label>
              <input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="important, exam, review"
                className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  color: 'inherit',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Content area ── */}
      {mode === 'view' ? (
        /* Rendered HTML */
        <div
          className="rounded-2xl px-6 py-6"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="prose prose-sm prose-invert max-w-none
              prose-headings:font-bold prose-headings:tracking-tight
              prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
              prose-p:text-muted-foreground prose-p:leading-relaxed
              prose-li:text-muted-foreground
              prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
              prose-pre:bg-[rgba(255,255,255,0.04)] prose-pre:border prose-pre:border-white/10
              prose-blockquote:border-primary prose-blockquote:text-muted-foreground
              prose-strong:text-foreground prose-em:text-muted-foreground
              prose-a:text-primary hover:prose-a:text-primary/80
              prose-img:rounded-xl prose-img:max-w-full
              prose-table:text-sm prose-th:text-foreground prose-td:text-muted-foreground
            "
            dangerouslySetInnerHTML={{ __html: safeHtml || note.content }}
          />
        </div>
      ) : (
        /* TipTap Editor */
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">
              Content
            </label>
            <RichEditor
              content={editContent}
              onChange={setEditContent}
              disabled={isSaving}
              noteId={note.id}
            />
          </div>

          {saveError && (
            <div
              className="rounded-xl p-3 text-sm"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171',
              }}
            >
              ⚠ {saveError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => { setMode('view'); setSaveError(null) }}
              disabled={isSaving}
              className="text-xs px-4 py-2.5 rounded-xl font-semibold text-muted-foreground hover:text-foreground transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 text-xs px-5 py-2.5 rounded-xl font-bold text-white transition-all disabled:opacity-50 hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
              }}
            >
              {isSaving
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Save className="h-3.5 w-3.5" />}
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* ── AI Analysis panel ── */}
      {showAnalysis && (
        <NoteAnalysis
          noteId={note.id}
          mindMap={note.mindMap}
          reasoningHints={note.reasoningHints}
          knowledgePoints={note.knowledgePoints}
          tutorSummary={note.tutorSummary}
          aiAnalyzedAt={note.aiAnalyzedAt}
          publishedSlug={note.publishedSlug}
          onAnalyze={() => fetchNote()}
        />
      )}
    </div>
  )
}
