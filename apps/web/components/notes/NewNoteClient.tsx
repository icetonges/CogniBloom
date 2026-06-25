'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Loader2, Save, Sparkles, ArrowLeft, FilePlus, X,
  Tag, BookOpen, Bot, ChevronDown, ChevronRight, Clock, Trash2, Check, BookMarked,
} from 'lucide-react'
import { RichEditor, type RichEditorRef } from '@/components/notes/RichEditor'
import { DocumentImport } from '@/components/notes/DocumentImport'
import { cn } from '@/lib/utils'
import { ModelCompare } from '@/components/chat/ModelCompare'
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
  // Life & skills 💡
  'Investment', 'Language and Art', 'Study Method',
]

const AI_PREVIEWS = [
  { emoji: '🗺️', text: 'Visual mind map of the topic' },
  { emoji: '💡', text: 'Step-by-step reasoning hints' },
  { emoji: '📚', text: 'Key concepts & definitions' },
  { emoji: '🎯', text: 'Quiz questions to test you' },
  { emoji: '🔭', text: 'Suggested next topics to study' },
]

const DRAFT_KEY = 'cognibloom:new-note-draft'
interface NoteDraft { title: string; content: string; subject: string; tags: string; savedAt: number }

function buildReflectionTemplate(): { title: string; subject: string; tags: string; html: string } {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const isoDate = now.toISOString().slice(0, 10)
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })

  const html = `
<h1>📘 Daily Learning Reflection</h1>
<blockquote>Fill this out at the end of each learning day. Short, honest answers — a few words or one bullet per point is enough.</blockquote>

<h2>1. Date &amp; Check-In</h2>
<ul>
  <li><strong>Date:</strong> ${isoDate}</li>
  <li><strong>Day of week:</strong> ${dayName}</li>
  <li><strong>Focus level (1–5):</strong> </li>
  <li><strong>Energy level (1–5):</strong> </li>
  <li><strong>One word for today:</strong> </li>
</ul>

<h2>2. Subjects Practiced Today</h2>
<blockquote>Change ☐ to ☑ for subjects you worked on, fill in time and what you did. <em>e.g. ☑ Math — 45 min | Worked through AMC 8 problems 1–10, focused on geometry.</em></blockquote>
<ul>
  <li>☐ <strong>Math</strong> — </li>
  <li>☐ <strong>Coding / Technology</strong> — </li>
  <li>☐ <strong>Language Learning</strong> — </li>
  <li>☐ <strong>Reading / Writing</strong> — </li>
  <li>☐ <strong>Other:</strong> — </li>
</ul>

<h2>3. What I Learned Today</h2>
<blockquote>One bullet per subject. <em>e.g. "Math: the area of a trapezoid is (b1+b2)×h÷2 — I kept forgetting to divide by 2."</em></blockquote>
<ul>
  <li></li>
  <li></li>
  <li></li>
</ul>

<h2>4. Important Knowledge Points</h2>
<blockquote>Facts, rules, formulas, or vocabulary to memorize. Bold the most important ones. <em>e.g. "Pythagorean theorem: a²+b²=c² — only works for right triangles."</em></blockquote>
<ul>
  <li></li>
  <li></li>
  <li></li>
</ul>

<h2>5. Problems or Questions I Got Wrong</h2>
<blockquote>Format: Subject — Question | My answer | Correct answer. <em>e.g. "Math — AMC 8 #7: shaded area? | My answer: 12 | Correct: 18"</em></blockquote>
<ul>
  <li></li>
  <li></li>
  <li></li>
</ul>

<h2>6. Why I Got Them Wrong</h2>
<blockquote>Be specific — "careless" is okay; "didn't draw a diagram first" is better. <em>e.g. "Rushed and skipped drawing a diagram — obvious once I drew it."</em></blockquote>
<ul>
  <li></li>
  <li></li>
</ul>

<h2>7. Concepts I Still Don't Fully Understand</h2>
<blockquote>Be specific — "fractions" is too vague; "dividing a fraction by a fraction" is useful. <em>e.g. "Why does Python's 'is' sometimes equal True for strings and sometimes not?"</em></blockquote>
<ul>
  <li></li>
  <li></li>
</ul>

<h2>8. Improvement Notes</h2>
<blockquote>What will you do differently next time? Concrete actions only. <em>e.g. "Always draw a diagram before solving geometry — even if it looks simple."</em></blockquote>
<ul>
  <li></li>
  <li></li>
</ul>

<h2>9. Questions I Want to Ask Later</h2>
<blockquote>Save for a parent, teacher, or future research session. <em>e.g. "Look up: difference between mean, median, and mode — when to use each?"</em></blockquote>
<ul>
  <li></li>
  <li></li>
</ul>

<h2>10. Connections to Things I Learned Before</h2>
<blockquote>How does today link to earlier days or other subjects? <em>e.g. "Fraction division reminds me of last week's ratios — dividing by a fraction = multiplying by its reciprocal."</em></blockquote>
<ul>
  <li></li>
  <li></li>
</ul>

<h2>11. One Small Win Today 🎉</h2>
<blockquote>Something to be proud of, even if it's tiny. <em>e.g. "Got 3 AMC problems correct in a row without any hints!"</em></blockquote>
<ul>
  <li></li>
</ul>

<h2>12. What I Should Review Tomorrow</h2>
<blockquote>Tick these off at the start of tomorrow's session. <em>e.g. "☐ AMC 8 2023 problems 7–10 (the ones I got wrong today)"</em></blockquote>
<ul>
  <li>☐ </li>
  <li>☐ </li>
  <li>☐ </li>
</ul>

<h2>13. Self-Check Quiz (3 Questions)</h2>
<blockquote>Write 3 questions from today. Cover the answers and test yourself tomorrow. <em>e.g. Q: "Area formula for a trapezoid?" A: "(b1+b2)×h÷2"</em></blockquote>
<ol>
  <li><strong>Q:</strong> <br><strong>A:</strong> </li>
  <li><strong>Q:</strong> <br><strong>A:</strong> </li>
  <li><strong>Q:</strong> <br><strong>A:</strong> </li>
</ol>

<h2>14. Progress Summary</h2>
<blockquote>A few sentences as if telling a teacher or parent. <em>e.g. "Today [Name] worked on AMC 8 geometry for 45 min. Struggled with shaded-area problems but improved after drawing diagrams. Tomorrow: review problems 7–10."</em></blockquote>
<p></p>
`.trim()

  return {
    title: `Daily Learning Reflection — ${dateStr}`,
    subject: 'Daily Reflection',
    tags: 'reflection,daily',
    html,
  }
}

export function NewNoteClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editorRef = useRef<RichEditorRef>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [subject, setSubject] = useState('')
  const [tags, setTags] = useState('')
  const [isReflection, setIsReflection] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingSubjects, setExistingSubjects] = useState<string[]>([])
  const [showImport, setShowImport] = useState(false)
  const [showAllSubjects, setShowAllSubjects] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Database-backed auto-save state
  const [noteId, setNoteId] = useState<string | null>(null)
  const [, setNoteSlug] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const savingRef = useRef(false)
  const lastSavedSnapshot = useRef<string>('')

  // Custom confirm dialog (replaces window.confirm which is blocked on iOS Safari)
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string
    confirmLabel?: string
    onConfirm: () => void
  } | null>(null)

  // Restore draft or load template on first mount
  useEffect(() => {
    // If ?template=reflection, skip draft restore and load template directly
    if (searchParams.get('template') === 'reflection') {
      const tpl = buildReflectionTemplate()
      setTitle(tpl.title)
      setSubject(tpl.subject)
      setTags(tpl.tags)
      setContent(tpl.html)
      setIsReflection(true)
      // Seed snapshot so auto-save only fires when the user actually changes content
      lastSavedSnapshot.current = JSON.stringify({ t: tpl.title.trim(), c: tpl.html, s: tpl.subject.trim(), g: tpl.tags })
      setTimeout(() => editorRef.current?.setContent(tpl.html), 100)
      return
    }
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const draft: NoteDraft = JSON.parse(raw)
        if (draft.title || draft.content) {
          setTitle(draft.title || '')
          setContent(draft.content || '')
          setSubject(draft.subject || '')
          setTags(draft.tags || '')
          if (draft.content) {
            setTimeout(() => editorRef.current?.setContent(draft.content), 100)
          }
          setDraftSavedAt(new Date(draft.savedAt))
          setDraftRestored(true)
          // Seed snapshot so opening a restored draft doesn't trigger an immediate DB save
          lastSavedSnapshot.current = JSON.stringify({
            t: (draft.title || '').trim(),
            c: draft.content || '',
            s: (draft.subject || '').trim(),
            g: draft.tags || '',
          })
        }
      }
    } catch { /* ignore corrupt draft */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-save draft — debounced 1.5 s after any field change
  const saveDraft = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, content, subject, tags, savedAt: Date.now() }))
        setDraftSavedAt(new Date())
      } catch { /* storage quota */ }
    }, 1500)
  }, [title, content, subject, tags])

  useEffect(() => { saveDraft() }, [saveDraft])

  // ── Auto-save to the database — debounced 1.8 s, once there's a title ──
  useEffect(() => {
    if (!title.trim()) return
    const snapshot = JSON.stringify({ t: title.trim(), c: content, s: subject.trim(), g: tags })
    if (snapshot === lastSavedSnapshot.current) return
    const timer = setTimeout(async () => {
      if (savingRef.current) return
      savingRef.current = true
      setSaveStatus('saving')
      try {
        const tagListLocal = tags.split(',').map((t) => t.trim()).filter(Boolean)
        const payload = {
          title: title.trim(),
          content,
          contentFormat: 'html',
          subject: subject.trim() || null,
          tags: tagListLocal,
          hasMath: /\$.*?\$|\\[.*?\\]|\\\(.*?\\\)|data-math/.test(content),
          hasCode: /<code|<pre/.test(content),
          hasImages: /<img/.test(content),
        }
        let data: Note
        if (noteId) {
          const res = await fetch(`/api/notes/${noteId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          })
          if (!res.ok) throw new Error()
          data = (await res.json()).data
        } else {
          const res = await fetch('/api/notes', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          })
          if (!res.ok) throw new Error()
          data = (await res.json()).data
          setNoteId(data.id)
          setNoteSlug(data.slug ?? null)
        }
        lastSavedSnapshot.current = snapshot
        setLastSavedAt(new Date())
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      } finally {
        savingRef.current = false
      }
    }, 1800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, subject, tags, noteId])

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
    setDraftSavedAt(null)
    setDraftRestored(false)
  }

  const applyReflectionTemplate = useCallback(() => {
    const tpl = buildReflectionTemplate()
    setTitle(tpl.title)
    setSubject(tpl.subject)
    setTags(tpl.tags)
    setContent(tpl.html)
    setIsReflection(true)
    // Seed snapshot so auto-save only fires on actual user changes after template load
    lastSavedSnapshot.current = JSON.stringify({ t: tpl.title.trim(), c: tpl.html, s: tpl.subject.trim(), g: tpl.tags })
    setTimeout(() => editorRef.current?.setContent(tpl.html), 50)
  }, [])

  const handleLoadTemplate = useCallback(() => {
    if (title || content) {
      setConfirmDialog({
        message: 'Load the Daily Reflection template? This will replace your current content.',
        confirmLabel: 'Load Template',
        onConfirm: applyReflectionTemplate,
      })
      return
    }
    applyReflectionTemplate()
  }, [title, content, applyReflectionTemplate])

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

      const payload = {
        title: title.trim(),
        content,
        contentFormat: 'html',
        subject: subject.trim() || null,
        tags: tagList,
        hasMath,
        hasCode,
        hasImages,
      }
      const res = noteId
        ? await fetch(`/api/notes/${noteId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

      if (!res.ok) throw new Error(noteId ? 'Failed to save note' : 'Failed to create note')
      const { data } = await res.json() as { data: Note }

      clearDraft()

      if (andAnalyze && data.id) {
        fetch(`/api/notes/${data.id}/analyze`, { method: 'POST' }).catch(() => {})
      }

      router.push(`/dashboard/notes/${data.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setIsSaving(false)
    }
  }

  const handleDelete = () => {
    const saved = !!noteId
    setConfirmDialog({
      message: saved ? 'Delete this note? This cannot be undone.' : 'Discard this draft?',
      confirmLabel: saved ? 'Delete' : 'Discard',
      onConfirm: async () => {
        if (noteId) {
          try { await fetch(`/api/notes/${noteId}`, { method: 'DELETE' }) } catch { /* ignore */ }
        }
        clearDraft()
        router.push('/dashboard/notes')
      },
    })
  }

  return (
    <>
    {/* Break out of dashboard container padding to go full-width.
        A single scroll container (the dashboard <main>) handles scrolling — this
        wrapper intentionally does NOT create its own scroll region, so wheel
        events never get trapped between nested scrollers. */}
    <div className="-mx-4 md:-mx-8 -mt-6 flex flex-col">
      {/* ── Top bar (sticks to the top of the page scroller) ── */}
      <div
        className="sticky top-0 z-30 flex items-center gap-3 px-5 py-3 flex-shrink-0 backdrop-blur"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(6,12,24,0.85)' }}
      >
        <button
          onClick={() => router.push('/dashboard/notes')}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Notes
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-base font-black tracking-tight shrink-0">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              New Note
            </span>
          </span>
          {wordCount > 0 && (
            <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full shrink-0"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              {wordCount}w · {charCount}c
            </span>
          )}
          {draftSavedAt && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground px-2 py-0.5 rounded-full truncate"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Clock className="h-2.5 w-2.5 shrink-0" />
              {draftRestored ? 'Draft restored' : 'Draft saved'}
            </span>
          )}
          {saveStatus !== 'idle' && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground px-2 py-0.5 rounded-full truncate"
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                color: saveStatus === 'error' ? '#f87171' : saveStatus === 'saved' ? '#34d399' : undefined,
              }}>
              {saveStatus === 'saving'
                ? <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" />
                : saveStatus === 'saved'
                  ? <Check className="h-2.5 w-2.5 shrink-0" />
                  : <X className="h-2.5 w-2.5 shrink-0" />}
              {saveStatus === 'saving'
                ? 'Saving…'
                : saveStatus === 'saved'
                  ? (lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Auto-saved')
                  : 'Save failed'}
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* Daily Reflection template */}
          <button
            type="button"
            onClick={handleLoadTemplate}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            title="Load Daily Reflection template"
          >
            <BookMarked className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Daily Reflection</span>
          </button>
          {/* Delete / discard */}
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-xl text-muted-foreground hover:text-rose-400 transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            title={noteId ? 'Delete note' : 'Discard draft'}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
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

      {/* ── Single-column body (no nested scroller — page scroll handles it) ── */}
      <div className="flex-1">
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-6 space-y-5">

          {/* Title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title…"
            disabled={isSaving}
            autoFocus
            className="cb-title-input w-full text-3xl md:text-4xl font-black tracking-tight focus:outline-none placeholder:text-muted-foreground/40"
            style={{ color: 'inherit', lineHeight: '1.2' }}
          />

          {/* Subject + Tags — OR motivational card for Daily Reflection */}
          {isReflection ? (
            /* ── Daily Reflection motivational card ── */
            <div
              className="rounded-2xl p-5 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.07), rgba(139,92,246,0.07))',
                border: '1px solid rgba(99,102,241,0.22)',
              }}
            >
              {/* decorative background glows */}
              <div className="pointer-events-none absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-10"
                style={{ background: 'radial-gradient(circle, #a78bfa, transparent)' }} />
              <div className="pointer-events-none absolute -bottom-4 -left-4 w-24 h-24 rounded-full opacity-8"
                style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />

              <p className="text-sm font-semibold leading-relaxed mb-4" style={{ color: '#c4b5fd' }}>
                Successful students are not magic. They usually do small things every day:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { emoji: '🚀', text: 'I try.' },
                  { emoji: '🔍', text: 'I notice my mistakes.' },
                  { emoji: '🤔', text: 'I ask why.' },
                  { emoji: '🔧', text: 'I fix one thing.' },
                  { emoji: '📖', text: 'I review a little.' },
                  { emoji: '🌅', text: 'I come back tomorrow.' },
                ].map(({ emoji, text }) => (
                  <div
                    key={text}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <span className="text-lg leading-none">{emoji}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{text}</span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-right mt-4 font-medium" style={{ color: '#a78bfa' }}>
                That&apos;s you. Keep going. 💪
              </p>

              {/* Save buttons — visible in-body for reflection notes, especially on mobile */}
              <div className="flex gap-3 mt-5 pt-4" style={{ borderTop: '1px solid rgba(99,102,241,0.15)' }}>
                <button
                  onClick={() => handleSave(false)}
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 flex-1 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'white' }}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Save + AI
                </button>
              </div>
            </div>
          ) : (
            /* ── Standard Subject + Tags grid ── */
            <div className="grid md:grid-cols-[1.5fr_1fr] gap-4">
              {/* Subject */}
              <div className="cb-field-card rounded-2xl p-4">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2.5">
                  <BookOpen className="w-3.5 h-3.5" /> Subject
                </label>
                <input
                  list="subject-list"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="AMC Math, AP Chemistry…"
                  disabled={isSaving}
                  className="cb-input w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
                />
                <datalist id="subject-list">
                  {allSubjects.map((s) => <option key={s} value={s} />)}
                </datalist>
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
                    {showAllSubjects ? (<><ChevronDown className="w-3 h-3" /> Less</>) : (<><ChevronRight className="w-3 h-3" /> More</>)}
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div className="cb-field-card rounded-2xl p-4">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2.5">
                  <Tag className="w-3.5 h-3.5" /> Tags
                </label>
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="practice, exam, review…"
                  disabled={isSaving}
                  className="cb-input w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
                />
                {tagList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
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
            </div>
          )}

          {/* Editor — stretched, document-style */}
          <RichEditor
            ref={editorRef}
            content={content}
            onChange={setContent}
            disabled={isSaving}
          />

          {/* Editor Tips — below the editor */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2.5">Editor Tips</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {[
                { key: '∑', tip: 'Open math input' },
                { key: 'Ω', tip: 'Symbol picker' },
                { key: 'Paste', tip: 'Drop/paste images directly' },
                { key: '```', tip: 'Code block (type then space)' },
                { key: '$$', tip: 'Math block (type then space)' },
                { key: 'Ctrl+B', tip: 'Bold' },
                { key: 'Ctrl+K', tip: 'Link' },
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

          {/* AI Tutor — under the tips */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.18)' }}>
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
                <p className="text-[10px] text-muted-foreground mt-0.5">Analyze this note, or ask & compare two models</p>
              </div>
            </div>

            <div className="p-4 space-y-5">
              {/* Save & analyze */}
              <div>
                <p className="text-xs text-muted-foreground mb-3">
                  Save your note and the AI tutor will instantly generate:
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {AI_PREVIEWS.map(({ emoji, text }) => (
                    <div key={text} className="flex items-center gap-2">
                      <span className="text-base leading-none">{emoji}</span>
                      <span className="text-xs text-muted-foreground">{text}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => handleSave(true)}
                  disabled={isSaving || !title.trim()}
                  className="mt-4 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40 hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Save & Start AI Analysis
                </button>
              </div>

              {/* Ask & compare two models */}
              <div className="pt-5 border-t" style={{ borderColor: 'rgba(99,102,241,0.12)' }}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-3">Ask &amp; compare two models</p>
                <ModelCompare />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    {/* ── Custom confirm dialog (replaces window.confirm — blocked on iOS Safari) ── */}
    {confirmDialog && (
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
        onClick={() => setConfirmDialog(null)}
      >
        <div
          className="w-full max-w-sm rounded-2xl p-6 space-y-5"
          style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm font-semibold text-center leading-relaxed">{confirmDialog.message}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmDialog(null)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const fn = confirmDialog.onConfirm
                setConfirmDialog(null)
                fn()
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ background: 'rgba(239,68,68,0.85)', border: '1px solid rgba(239,68,68,0.4)' }}
            >
              {confirmDialog.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
