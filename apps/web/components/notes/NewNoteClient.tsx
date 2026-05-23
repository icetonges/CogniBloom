'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Save, Sparkles, ArrowLeft, FilePlus, X,
  Tag, BookOpen, Bot, ChevronDown, ChevronRight,
} from 'lucide-react'
import { RichEditor, type RichEditorRef } from '@/components/notes/RichEditor'
import { DocumentImport } from '@/components/notes/DocumentImport'
import { cn } from '@/lib/utils'
import type { Note } from '@/hooks/useNotes'

const SUBJECT_PRESETS = [
  // Competition math
  'AMC Math', 'AMC 8', 'AMC 10', 'AMC 12', 'AIME',
  // AP courses
  'AP Calculus', 'AP Physics', 'AP Chemistry', 'AP Biology',
  // Core subjects
  'Math', 'Physics', 'Chemistry', 'Biology',
  'English', 'History', 'Coding',
  // Foreign languages 🌍
  '中文 (Chinese)', 'Japanese 日本語', 'Korean 한국어',
  'Spanish', 'French', 'German',
  'Language (Other)',
]

const AI_PREVIEWS = [
  { emoji: '🗺️', text: 'Visual mind map of the topic' },
  { emoji: '💡', text: 'Step-by-step reasoning hints' },
  { emoji: '📚', text: 'Key concepts & definitions' },
  { emoji: '🎯', text: 'Quiz questions to test you' },
  { emoji: '🔭', text: 'Suggested next topics to study' },
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
  const [showAllSubjects, setShowAllSubjects] = useState(false)

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
  const visibleSubjects = showAllSubjects ? allSubjects : SUBJECT_PRESETS.slice(0, 10)
  const wordCount = content.replace(/<[^>]+>/g, '').trim().split(/\s+/).filter(Boolean).length
  const charCount = content.replace(/<[^>]+>/g, '').length

  const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)

  const handleImport = (html: string, suggestedTitle?: string, mode: 'append' | 'replace' = 'append') => {
    if (mode === 'replace') {
      editorRef.current?.setContent(html)
      setContent(html)
    } else {
      editorRef.current?.appendContent(html)
      setContent(editorRef.current?.getContent() ?? content + html)
    }
    if (suggestedTitle && !title) setTitle(suggestedTitle)
    setShowImport(false)
  }

  const handleSave = async (andAnalyze = false) => {
    if (!title.trim()) { setError('Please add a title'); return }
    const plainText = content.replace(/<[^>]+>/g, '').trim()
    if (!plainText) { setError('Please write some content'); return }

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
          tags: tagList,
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
    // Break out of dashboard container padding to go full-width
    <div className="-mx-4 md:-mx-8 -mt-6 flex flex-col" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* ── Top bar ── */}
      <div
        className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}
      >
        <button
          onClick={() => router.push('/dashboard/notes')}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Notes
        </button>

        <div className="flex items-center gap-2">
          <span className="text-base font-black tracking-tight">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              New Note
            </span>
          </span>
          {wordCount > 0 && (
            <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              {wordCount}w · {charCount}c
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* Import — icon-only on mobile */}
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-xl transition-all',
              showImport ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
            style={
              showImport
                ? { background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }
            }
            title={showImport ? 'Close import' : 'Import file'}
          >
            {showImport ? <X className="h-3.5 w-3.5" /> : <FilePlus className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{showImport ? 'Close' : 'Import'}</span>
          </button>
          {/* Save — icon-only on mobile */}
          <button
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className="flex items-center gap-1.5 text-xs px-2.5 sm:px-4 py-2 rounded-xl font-bold transition-all disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'white' }}
            title="Save note"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Save</span>
          </button>
          {/* Save + AI — abbreviated on mobile */}
          <button
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className="flex items-center gap-1.5 text-xs px-3 sm:px-5 py-2 rounded-xl font-bold text-white transition-all disabled:opacity-50 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
            }}
            title="Save and analyze with AI"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Save + AI</span>
            <span className="sm:hidden">AI</span>
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div
          className="mx-5 mt-3 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
        >
          ⚠ {error}
          <button onClick={() => setError(null)} className="ml-auto opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Import panel (collapsible, full-width) ── */}
      {showImport && (
        <div className="mx-5 mt-3">
          <DocumentImport onImport={handleImport} />
        </div>
      )}

      {/* ── Two-column body ── */}
      <div className="flex flex-1 gap-0 overflow-hidden">

        {/* ════ LEFT: Editor column ════ */}
        <div
          className="flex flex-col flex-1 min-w-0 overflow-y-auto"
          style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}
        >
          {/* Title input — large, document-style */}
          <div className="px-4 sm:px-8 pt-5 sm:pt-8 pb-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title…"
              disabled={isSaving}
              autoFocus
              className="w-full bg-transparent text-2xl md:text-3xl font-black tracking-tight focus:outline-none placeholder:text-muted-foreground/40"
              style={{ color: 'inherit', lineHeight: '1.2' }}
            />
            {subject && (
              <p className="mt-1 text-sm font-semibold text-primary/70">{subject}</p>
            )}
          </div>

          {/* Divider */}
          <div className="mx-4 sm:mx-8 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

          {/* Rich editor — full-page feel */}
          <div className="flex-1 px-2 sm:px-4 pb-4 sm:pb-8">
            <RichEditor
              ref={editorRef}
              content={content}
              onChange={setContent}
              disabled={isSaving}
              fullPage
            />
          </div>
        </div>

        {/* ════ RIGHT: Metadata + AI sidebar ════ */}
        <div
          className="hidden lg:flex flex-col w-80 xl:w-96 overflow-y-auto flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.15)' }}
        >
          <div className="p-5 space-y-6">

            {/* ── Subject ── */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
                <BookOpen className="w-3.5 h-3.5" /> Subject
              </label>
              <input
                list="subject-list"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="AMC Math, AP Chemistry…"
                disabled={isSaving}
                className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  color: 'inherit',
                }}
              />
              <datalist id="subject-list">
                {allSubjects.map((s) => <option key={s} value={s} />)}
              </datalist>

              {/* Quick-pick chips */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {visibleSubjects.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSubject(subject === s ? '' : s)}
                    className={cn(
                      'text-[11px] px-2.5 py-1 rounded-full font-semibold transition-all',
                      subject === s ? 'text-white' : 'text-muted-foreground hover:text-foreground',
                    )}
                    style={
                      subject === s
                        ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }
                        : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
                    }
                  >
                    {s}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowAllSubjects((v) => !v)}
                  className="text-[11px] px-2.5 py-1 rounded-full font-semibold text-muted-foreground hover:text-foreground transition-all flex items-center gap-1"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {showAllSubjects ? (
                    <><ChevronDown className="w-3 h-3" /> Less</>
                  ) : (
                    <><ChevronRight className="w-3 h-3" /> More</>
                  )}
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

            {/* ── Tags ── */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
                <Tag className="w-3.5 h-3.5" /> Tags
              </label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="practice, exam, review…"
                disabled={isSaving}
                className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  color: 'inherit',
                }}
              />
              {tagList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tagList.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

            {/* ── AI Teaser panel ── */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.18)' }}
            >
              <div
                className="flex items-center gap-2.5 px-4 py-3"
                style={{ borderBottom: '1px solid rgba(99,102,241,0.12)', background: 'rgba(99,102,241,0.08)' }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 10px rgba(99,102,241,0.4)' }}
                >
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-none">AI Tutor</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Unlocks after saving</p>
                </div>
              </div>

              <div className="p-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Save your note and the AI tutor will instantly be able to:
                </p>
                <div className="space-y-2">
                  {AI_PREVIEWS.map(({ emoji, text }) => (
                    <div key={text} className="flex items-center gap-2.5">
                      <span className="text-base leading-none">{emoji}</span>
                      <span className="text-xs text-muted-foreground">{text}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleSave(true)}
                  disabled={isSaving || !title.trim()}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40 hover:scale-[1.02]"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                  }}
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Save & Start AI Analysis
                </button>
              </div>
            </div>

            {/* ── Tips ── */}
            <div
              className="rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Editor Tips</p>
              <div className="space-y-1.5">
                {[
                  { key: '∑', tip: 'Open math input' },
                  { key: 'Ω', tip: 'Symbol picker' },
                  { key: 'Paste', tip: 'Drop/paste images directly' },
                  { key: '```', tip: 'Code block (type then space)' },
                  { key: '$$', tip: 'Math block (type then space)' },
                ].map(({ key, tip }) => (
                  <div key={key} className="flex items-center gap-2">
                    <kbd
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      {key}
                    </kbd>
                    <span className="text-[11px] text-muted-foreground">{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile bottom action bar (visible < lg) ── */}
      <div
        className="lg:hidden flex items-center gap-2 px-4 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.3)' }}
      >
        {/* Subject chip for mobile */}
        <div className="flex-1 overflow-x-auto flex gap-1.5 no-scrollbar">
          {SUBJECT_PRESETS.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSubject(subject === s ? '' : s)}
              className={cn(
                'text-[11px] px-2.5 py-1 rounded-full font-semibold whitespace-nowrap transition-all flex-shrink-0',
                subject === s ? 'text-white' : 'text-muted-foreground'
              )}
              style={
                subject === s
                  ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }
                  : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => handleSave(true)}
          disabled={isSaving}
          className="flex-shrink-0 flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl font-bold text-white transition-all disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 2px 10px rgba(99,102,241,0.4)' }}
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Save
        </button>
      </div>
    </div>
  )
}
