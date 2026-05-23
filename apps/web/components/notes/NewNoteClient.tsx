'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, Sparkles, ArrowLeft, FilePlus, X } from 'lucide-react'
import { RichEditor, type RichEditorRef } from '@/components/notes/RichEditor'
import { DocumentImport } from '@/components/notes/DocumentImport'
import { cn } from '@/lib/utils'
import type { Note } from '@/hooks/useNotes'

const SUBJECT_PRESETS = [
  'AMC Math', 'AMC 8', 'AMC 10', 'AMC 12', 'AIME',
  'AP Calculus', 'AP Physics', 'AP Chemistry', 'AP Biology',
  'Math', 'Physics', 'Chemistry', 'Biology',
  'English', 'History', 'Coding', 'Language',
]

export function NewNoteClient() {
  const router = useRouter()
  const editorRef = useRef<RichEditorRef>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [subject, setSubject] = useState('')
  const [tags, setTags] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingSubjects, setExistingSubjects] = useState<string[]>([])
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    fetch('/api/notes/subjects')
      .then((r) => r.json())
      .then(({ data }) => {
        if (Array.isArray(data)) {
          setExistingSubjects(data.map((d: { subject: string }) => d.subject))
        }
      })
      .catch(() => {})
  }, [])

  const allSubjects = Array.from(new Set([...SUBJECT_PRESETS, ...existingSubjects])).sort()
  const wordCount = content.replace(/<[^>]+>/g, '').trim().split(/\s+/).filter(Boolean).length

  const handleImport = (html: string, suggestedTitle?: string, mode: 'append' | 'replace' = 'append') => {
    if (mode === 'replace') {
      editorRef.current?.setContent(html)
      setContent(html)
    } else {
      editorRef.current?.appendContent(html)
      // Get updated content from editor
      setContent(editorRef.current?.getContent() ?? content + html)
    }
    if (suggestedTitle && !title) {
      setTitle(suggestedTitle)
    }
    setShowImport(false)
  }

  const handleSave = async (andAnalyze = false) => {
    if (!title.trim()) { setError('Title is required'); return }
    const plainText = content.replace(/<[^>]+>/g, '').trim()
    if (!plainText) { setError('Content is required'); return }

    setIsSaving(true)
    setError(null)

    try {
      const hasMath = /\$.*?\$|\\[.*?\\]|\\\(.*?\\\)|data-math/.test(content)
      const hasCode = /<code|<pre/.test(content)
      const hasImages = /<img/.test(content)

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content,
          contentFormat: 'html',
          subject: subject.trim() || null,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          hasMath,
          hasCode,
          hasImages,
        }),
      })

      if (!res.ok) throw new Error('Failed to create note')
      const { data } = await res.json() as { data: Note }

      if (andAnalyze && data.id) {
        fetch(`/api/notes/${data.id}/analyze`, { method: 'POST' }).catch(() => {})
      }

      router.push(`/dashboard/notes/${data.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/notes')}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Notes
        </button>
        <h2 className="text-2xl font-black tracking-tight">
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            New Note
          </span>
        </h2>

        {/* Import toggle */}
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all',
              showImport ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
            style={
              showImport
                ? { background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }
            }
          >
            {showImport ? <X className="h-3.5 w-3.5" /> : <FilePlus className="h-3.5 w-3.5" />}
            {showImport ? 'Close Import' : 'Import File'}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          className="rounded-xl p-3 text-sm flex items-center gap-2"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
        >
          ⚠ {error}
        </div>
      )}

      {/* ── Document Import panel ── */}
      {showImport && (
        <DocumentImport onImport={handleImport} />
      )}

      {/* ── Metadata card ── */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Title */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 block">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What did you study today?"
            disabled={isSaving}
            autoFocus
            className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold focus:outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              color: 'inherit',
            }}
          />
        </div>

        {/* Subject + Tags */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 block">
              Subject <span className="font-normal normal-case">(free text or pick below)</span>
            </label>
            <input
              list="subject-list"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="AMC Math, AP Chemistry…"
              disabled={isSaving}
              className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: 'inherit',
              }}
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
              placeholder="practice, exam, review"
              disabled={isSaving}
              className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: 'inherit',
              }}
            />
          </div>
        </div>

        {/* Subject quick-pick chips */}
        <div className="flex flex-wrap gap-1.5">
          {SUBJECT_PRESETS.slice(0, 12).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSubject(s)}
              className={cn(
                'text-xs px-3 py-1 rounded-full font-semibold transition-all',
                subject === s ? 'text-white' : 'text-muted-foreground hover:text-foreground',
              )}
              style={
                subject === s
                  ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 2px 10px rgba(99,102,241,0.35)' }
                  : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Editor ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Content
          </label>
          <span className="text-xs text-muted-foreground">{wordCount} words</span>
        </div>
        <RichEditor
          ref={editorRef}
          content={content}
          onChange={setContent}
          disabled={isSaving}
        />
      </div>

      {/* ── Action bar ── */}
      <div
        className="rounded-2xl p-4 flex items-center justify-between gap-2"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <p className="text-xs text-muted-foreground hidden sm:block">
          Keyboard: <kbd className="px-1 py-0.5 rounded text-[10px]" style={{ background: 'rgba(255,255,255,0.08)' }}>∑</kbd> math ·{' '}
          <kbd className="px-1 py-0.5 rounded text-[10px]" style={{ background: 'rgba(255,255,255,0.08)' }}>Ω</kbd> symbols ·{' '}
          paste images
        </p>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => router.push('/dashboard/notes')}
            disabled={isSaving}
            className="text-xs px-4 py-2.5 rounded-xl font-semibold text-muted-foreground hover:text-foreground transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className="flex items-center gap-1.5 text-xs px-5 py-2.5 rounded-xl font-bold text-white transition-all disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className="flex items-center gap-1.5 text-xs px-5 py-2.5 rounded-xl font-bold text-white transition-all disabled:opacity-50 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
            }}
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Save + AI Analysis
          </button>
        </div>
      </div>
    </div>
  )
}
