'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GraduationCap, X, Send, Lightbulb, Check, Loader2, ChevronDown, PenLine } from 'lucide-react'
import { MarkdownRenderer } from '@/components/notes/MarkdownRenderer'
import { GOT_IT_MESSAGE, extractTakeaway, withoutTakeaway, type TutorSection } from '@/lib/tutor/reflection-tutor'
import type { TutorAsk } from '@/lib/tiptap/reflection-tutor-extension'
import { cn } from '@/lib/utils'

interface Msg { role: 'user' | 'assistant'; content: string }

interface Thread {
  question: string
  section: TutorSection
  addUnderEntry: TutorAsk['addUnderEntry']
  messages: Msg[]
  sessionId?: string
  streaming: boolean
  error: string | null
  added: string[]   // takeaways already added to the note
}

export interface NoteContext { title: string; subject: string; html: string }

interface Props {
  /** Latest ask from the editor. A new object opens (or reopens) its thread. */
  ask: TutorAsk | null
  getNoteContext: () => NoteContext
}

const HINT_MESSAGE = 'Can I have a hint?'
const SECTION_LABEL: Record<TutorSection, string> = {
  concept: 'Concept to understand',
  later: 'Question for later',
}

function plainText(html: string): string {
  return html.replace(/<(br|\/p|\/li|\/h\d)[^>]*>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * The reflection tutor panel. Opens when the student finishes an entry under
 * section 7 or 9 with Enter, keeps one conversation per entry, and lets the
 * student add the final takeaway under their entry in the note.
 */
export function ReflectionTutor({ ask, getNoteContext }: Props) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeQ, setActiveQ] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [gradeLabel, setGradeLabel] = useState<string | null>(null)
  const [gradeFromSettings, setGradeFromSettings] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const threadsRef = useRef<Thread[]>([])
  threadsRef.current = threads
  // Parents pass a fresh closure every render; read it through a ref so callbacks stay stable.
  const contextRef = useRef(getNoteContext)
  contextRef.current = getNoteContext

  const update = useCallback((question: string, fn: (t: Thread) => Thread) => {
    setThreads((cur) => cur.map((t) => (t.question === question ? fn(t) : t)))
  }, [])

  const send = useCallback(async (question: string, userText: string | null) => {
    const thread = threadsRef.current.find((t) => t.question === question)
    if (!thread || thread.streaming) return
    // The first turn sends the entry itself as the student's opening message (hidden in the UI).
    const base: Msg[] = thread.messages.length ? thread.messages : [{ role: 'user', content: question }]
    const history: Msg[] = userText ? [...base, { role: 'user', content: userText }] : base
    update(question, (t) => ({ ...t, messages: [...history, { role: 'assistant', content: '' }], streaming: true, error: null }))

    const ctx = contextRef.current()
    try {
      const res = await fetch('/api/notes/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          section: thread.section,
          sessionId: thread.sessionId,
          messages: history,
          noteTitle: ctx.title || null,
          noteSubject: ctx.subject || null,
          noteExcerpt: plainText(ctx.html).slice(0, 6000),
        }),
      })
      if (!res.ok || !res.body) throw new Error(res.status === 401 ? 'Please sign in again.' : 'The tutor is not available right now.')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const ev = JSON.parse(line.slice(6)) as
            | { type: 'meta'; sessionId: string; grade: { label: string; source: string } }
            | { type: 'content'; content: string }
            | { type: 'done'; sessionId: string }
            | { type: 'error'; error: string }
          if (ev.type === 'meta') {
            setGradeLabel(ev.grade.label)
            setGradeFromSettings(ev.grade.source === 'settings')
            update(question, (t) => ({ ...t, sessionId: ev.sessionId }))
          } else if (ev.type === 'content') {
            update(question, (t) => {
              const msgs = t.messages.slice()
              const last = msgs[msgs.length - 1]
              msgs[msgs.length - 1] = { ...last, content: last.content + ev.content }
              return { ...t, messages: msgs }
            })
          } else if (ev.type === 'error') {
            throw new Error(ev.error)
          }
        }
      }
      update(question, (t) => ({ ...t, streaming: false }))
    } catch (err) {
      update(question, (t) => ({
        ...t,
        streaming: false,
        // Drop the empty assistant bubble so "Try again" resends cleanly.
        messages: t.messages[t.messages.length - 1]?.content ? t.messages : t.messages.slice(0, -1),
        error: err instanceof Error ? err.message : 'Something went wrong.',
      }))
    }
  }, [update])

  // A new ask from the editor: open its thread, starting it if it's new.
  useEffect(() => {
    if (!ask) return
    setOpen(true)
    setActiveQ(ask.question)
    const existing = threadsRef.current.find((t) => t.question === ask.question)
    if (existing) {
      // Keep the latest editor binding so "Add to my note" targets the live document.
      update(ask.question, (t) => ({ ...t, addUnderEntry: ask.addUnderEntry }))
      return
    }
    const fresh: Thread = {
      question: ask.question, section: ask.section, addUnderEntry: ask.addUnderEntry,
      messages: [], streaming: false, error: null, added: [],
    }
    threadsRef.current = [...threadsRef.current, fresh]
    setThreads(threadsRef.current)
    void send(ask.question, null)
  }, [ask, send, update])

  const thread = threads.find((t) => t.question === activeQ) ?? null

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [thread?.messages])

  if (!threads.length) return null

  if (!open || !thread) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setActiveQ(activeQ ?? threads[threads.length - 1].question) }}
        className="fixed bottom-20 right-4 z-[65] flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-2xl"
        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.95), rgba(139,92,246,0.95))' }}
      >
        <GraduationCap className="h-4 w-4" /> Tutor{threads.length > 1 ? ` (${threads.length})` : ''}
      </button>
    )
  }

  const submit = () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    void send(thread.question, text)
  }

  return (
    <aside
      aria-label="Reflection tutor"
      className="fixed z-[65] flex flex-col inset-x-0 bottom-0 h-[80vh] rounded-t-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:top-20 sm:h-auto sm:w-[420px] sm:rounded-2xl shadow-2xl"
      style={{ background: 'rgba(10,18,34,0.98)', border: '1px solid rgba(255,255,255,0.12)' }}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-indigo-300" />
          <span className="text-sm font-bold text-foreground">Tutor</span>
          {gradeLabel && (
            <a
              href="/dashboard/settings"
              className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full hover:text-foreground"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              title={gradeFromSettings ? 'Level comes from Settings → Year Level' : 'No level set in Settings; using a default'}
            >
              {gradeLabel}{gradeFromSettings ? '' : ' · set in Settings'}
            </a>
          )}
          <button type="button" onClick={() => setOpen(false)} className="ml-auto p-1 text-muted-foreground hover:text-foreground" aria-label="Close tutor">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative mt-2">
          <button
            type="button"
            onClick={() => threads.length > 1 && setPickerOpen((v) => !v)}
            className={cn('w-full text-left rounded-lg px-2.5 py-1.5', threads.length > 1 && 'hover:bg-white/[0.04]')}
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}
          >
            <span className="block text-[10px] uppercase tracking-wide text-indigo-300/80">{SECTION_LABEL[thread.section]}</span>
            <span className="flex items-start gap-1 text-xs text-foreground">
              <span className="flex-1 line-clamp-2">{thread.question}</span>
              {threads.length > 1 && <ChevronDown className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
            </span>
          </button>
          {pickerOpen && (
            <div className="absolute inset-x-0 top-full mt-1 z-10 rounded-lg p-1 shadow-xl" style={{ background: 'rgba(10,18,34,0.99)', border: '1px solid rgba(255,255,255,0.12)' }}>
              {threads.map((t) => (
                <button
                  key={t.question}
                  type="button"
                  onClick={() => { setActiveQ(t.question); setPickerOpen(false) }}
                  className={cn('block w-full text-left text-xs rounded-md px-2 py-1.5 hover:bg-white/[0.06] truncate', t.question === thread.question && 'text-indigo-200')}
                >
                  {t.question}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {thread.messages.map((m, i) => {
          if (m.role === 'user') {
            // The kickoff message is the entry itself; don't show it twice.
            if (i === 0 && m.content === thread.question) return null
            return (
              <div key={i} className="ml-8 rounded-2xl rounded-br-md px-3 py-2 text-sm text-white" style={{ background: 'rgba(99,102,241,0.35)' }}>
                {m.content}
              </div>
            )
          }
          const takeaway = extractTakeaway(m.content)
          const body = withoutTakeaway(m.content)
          const isAdded = takeaway !== null && thread.added.includes(takeaway)
          return (
            <div key={i} className="space-y-2">
              {body ? (
                <div className="text-sm"><MarkdownRenderer content={body} /></div>
              ) : (
                thread.streaming && i === thread.messages.length - 1 && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {takeaway && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.35)' }}>
                  <p className="text-[10px] uppercase tracking-wide text-emerald-300/90">Your takeaway</p>
                  <p className="mt-1 text-sm text-emerald-50">{takeaway}</p>
                  <button
                    type="button"
                    disabled={isAdded}
                    onClick={() => {
                      if (thread.addUnderEntry(`💡 ${takeaway}`)) update(thread.question, (t) => ({ ...t, added: [...t.added, takeaway] }))
                    }}
                    className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-emerald-200 disabled:opacity-70"
                    style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.4)' }}
                  >
                    {isAdded ? <><Check className="h-3.5 w-3.5" /> Added under your entry</> : <><PenLine className="h-3.5 w-3.5" /> Add to my note</>}
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {thread.error && (
          <div className="rounded-xl p-3 text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
            {thread.error}{' '}
            <button type="button" className="underline" onClick={() => send(thread.question, null)}>Try again</button>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="px-3 pb-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="mb-2 flex gap-1.5">
          <button
            type="button"
            disabled={thread.streaming}
            onClick={() => send(thread.question, HINT_MESSAGE)}
            className="flex items-center gap-1 rounded-full px-3 py-1 text-xs text-amber-200 disabled:opacity-40"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)' }}
          >
            <Lightbulb className="h-3 w-3" /> Hint
          </button>
          <button
            type="button"
            disabled={thread.streaming || thread.messages.length < 2}
            onClick={() => send(thread.question, GOT_IT_MESSAGE)}
            className="flex items-center gap-1 rounded-full px-3 py-1 text-xs text-emerald-200 disabled:opacity-40"
            style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)' }}
          >
            <Check className="h-3 w-3" /> I think I get it
          </button>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            rows={2}
            placeholder="Type your answer or idea…"
            className="flex-1 resize-none rounded-xl px-3 py-2 text-sm focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <button
            type="button"
            onClick={submit}
            disabled={thread.streaming || !input.trim()}
            className="rounded-xl p-2.5 text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.9), rgba(139,92,246,0.9))' }}
            aria-label="Send"
          >
            {thread.streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
  )
}
