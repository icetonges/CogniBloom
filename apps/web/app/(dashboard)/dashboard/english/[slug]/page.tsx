'use client'

/**
 * A single book — where the reading actually happens.
 *
 * Left: the Socratic tutor. Right: where he is, which layer he's working in,
 * the skills this book is good for, and the local study folder.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft, Send, Loader2, HelpCircle, BookOpen,
  AlertTriangle, Folder, Sparkles, Target,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  bookBySlug, citation, LAYERS, LAYER_ORDER,
  skillById, skillsForForm, type Layer,
} from '@/lib/english'

interface Turn { role: 'user' | 'assistant'; content: string }
interface FocusSkill { id: string; name: string; strand: string; level: number }

const STATUSES = [
  { id: 'not_started', label: 'Not started' },
  { id: 'reading', label: 'Reading' },
  { id: 'finished', label: 'Finished' },
] as const

export default function BookWorkspacePage() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug ?? ''
  const book = bookBySlug(slug)

  const [layer, setLayer] = useState<Layer>('required')
  const [status, setStatus] = useState<string>('not_started')
  const [currentPart, setCurrentPart] = useState('')
  const [percent, setPercent] = useState(0)
  const [saving, setSaving] = useState(false)

  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [focus, setFocus] = useState<FocusSkill[]>([])
  const [err, setErr] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, thinking])

  // Load stored progress for this book.
  useEffect(() => {
    let off = false
    fetch('/api/english/books').then((r) => r.json()).then((j) => {
      if (off || !j.success) return
      const p = j.progress?.[slug]
      if (p) {
        setLayer(p.layer ?? 'required')
        setStatus(p.status ?? 'not_started')
        setCurrentPart(p.currentPart ?? '')
        setPercent(p.percent ?? 0)
      }
    }).catch(() => {})
    return () => { off = true }
  }, [slug])

  const saveProgress = useCallback(async (patch: Record<string, unknown>) => {
    setSaving(true)
    try {
      await fetch('/api/english/progress', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, layer, status, currentPart, percent, ...patch }),
      })
    } catch { /* non-fatal */ } finally { setSaving(false) }
  }, [slug, layer, status, currentPart, percent])

  const send = useCallback(async (text: string, stuck = false) => {
    const next: Turn[] = text ? [...turns, { role: 'user', content: text }] : turns
    setTurns(next); setDraft(''); setThinking(true); setErr(null)
    try {
      const res = await fetch('/api/english/tutor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, layer, messages: next, stuck }),
      })
      const j = await res.json()
      if (!j.success) { setErr(j.error ?? 'The tutor could not answer.'); return }
      setTurns([...next, { role: 'assistant', content: j.reply }])
      setFocus(j.focusSkills ?? [])
    } catch {
      setErr('Could not reach the tutor.')
    } finally { setThinking(false) }
  }, [turns, slug, layer])

  if (!book) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Unknown book.{' '}
        <Link href="/dashboard/english" className="text-primary hover:underline">Back to the list</Link>
      </div>
    )
  }

  const L = LAYERS[layer]
  const skills = skillsForForm(book.form).map(skillById).filter(Boolean)

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1500px] mx-auto">
      {/* ── header ── */}
      <div className="flex flex-wrap items-start gap-3">
        <Link href="/dashboard/english" className="p-1.5 rounded-lg hover:bg-muted mt-0.5" aria-label="Back">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black tracking-tight leading-tight">{book.title}</h1>
          {book.subtitle && <p className="text-xs text-muted-foreground">{book.subtitle}</p>}
          <p className="text-xs text-muted-foreground mt-0.5">
            {book.authors.join(', ')} · {book.year} · {book.form}
            {book.series && ` · ${book.series}`}
          </p>
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground shrink-0 mt-1">#{book.n} on the list</span>
      </div>

      {book.correction && (
        <Card className="p-3 text-[11px] border-amber-500/30 bg-amber-500/[0.06] flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
          <span><strong>The handout has this wrong.</strong> It says “{book.handoutSays}”. {book.correction}</span>
        </Card>
      )}
      {book.ambiguity && (
        <Card className="p-3 text-[11px] border-rose-500/30 bg-rose-500/[0.06] flex items-start gap-2">
          <HelpCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-400" />
          <span><strong>Check with Ms. Champagne.</strong> {book.ambiguity}</span>
        </Card>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
        {/* ── the tutor ── */}
        <Card className="p-0 overflow-hidden flex flex-col" style={{ minHeight: 520 }}>
          <div className="px-3 py-2 border-b border-border/60 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Reading coach
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: `${L.accent}22`, color: L.accent }}>
              {L.emoji} {L.label}
            </span>
            {focus[0] && (
              <span className="ml-auto text-[10px] text-muted-foreground inline-flex items-center gap-1">
                <Target className="w-3 h-3" /> {focus[0].name}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {turns.length === 0 && !thinking && (
              <div className="text-center py-10">
                <BookOpen className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm font-semibold">Ready when you are.</p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
                  The coach hasn’t read this book — so it will ask you what happened rather than
                  telling you. Have it open; you’ll need to quote from it.
                </p>
                <Button size="sm" className="mt-4" onClick={() => void send('')}>
                  Start the session
                </Button>
              </div>
            )}

            {turns.map((t, i) => (
              <div key={i} className={cn('flex', t.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                  t.role === 'user'
                    ? 'bg-primary/15 text-foreground'
                    : 'bg-muted/50 text-foreground'
                )}>
                  {t.content}
                </div>
              </div>
            ))}

            {thinking && (
              <div className="flex justify-start">
                <div className="rounded-xl px-3 py-2 bg-muted/50 text-muted-foreground text-xs inline-flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> thinking…
                </div>
              </div>
            )}
            {err && <div className="text-[11px] text-rose-400">{err}</div>}
            <div ref={endRef} />
          </div>

          {turns.length > 0 && (
            <div className="border-t border-border/60 p-2 flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (draft.trim()) void send(draft.trim()) }
                }}
                rows={2}
                placeholder="Answer, or paste the quote you found…"
                className="flex-1 bg-muted/40 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex flex-col gap-1">
                <Button size="sm" onClick={() => draft.trim() && void send(draft.trim())} disabled={thinking || !draft.trim()}>
                  <Send className="w-3.5 h-3.5" />
                </Button>
                <button
                  onClick={() => void send('I’m stuck.', true)}
                  disabled={thinking}
                  className="text-[10px] text-muted-foreground hover:text-primary px-1"
                >
                  stuck
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* ── side panel ── */}
        <div className="space-y-3">
          <Card className="p-3 space-y-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Where I am {saving && <Loader2 className="w-3 h-3 animate-spin inline ml-1" />}
            </h2>

            <div className="flex gap-1">
              {STATUSES.map((s) => (
                <button key={s.id}
                  onClick={() => { setStatus(s.id); void saveProgress({ status: s.id }) }}
                  className={cn('flex-1 text-[10px] font-semibold py-1.5 rounded-lg transition-colors',
                    status === s.id ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:text-foreground')}>
                  {s.label}
                </button>
              ))}
            </div>

            <input
              value={currentPart}
              onChange={(e) => setCurrentPart(e.target.value)}
              onBlur={() => void saveProgress({ currentPart })}
              placeholder="e.g. ch. 12 or p. 140"
              className="w-full bg-muted/40 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>Progress</span><span className="tabular-nums">{percent}%</span>
              </div>
              <input type="range" min={0} max={100} step={5} value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
                onMouseUp={() => void saveProgress({ percent })}
                onTouchEnd={() => void saveProgress({ percent })}
                className="w-full accent-[var(--primary)]" />
            </div>
          </Card>

          <Card className="p-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Layer
            </h2>
            <div className="space-y-1">
              {LAYER_ORDER.map((k) => {
                const l = LAYERS[k]
                return (
                  <button key={k}
                    onClick={() => { setLayer(k); void saveProgress({ layer: k }) }}
                    className={cn('w-full text-left px-2 py-1.5 rounded-lg text-[11px] transition-colors',
                      layer === k ? 'bg-primary/15' : 'hover:bg-muted/40')}>
                    <span className="font-semibold" style={{ color: layer === k ? l.accent : undefined }}>
                      {l.emoji} {l.label}
                    </span>
                    <span className="text-muted-foreground"> — {l.short}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 leading-snug">{L.stance}</p>
          </Card>

          <Card className="p-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Good book for
            </h2>
            <ul className="space-y-1">
              {skills.map((s) => {
                const hit = focus.find((f) => f.id === s!.id)
                return (
                  <li key={s!.id} className="text-[11px] flex items-center gap-1.5">
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0',
                      hit ? 'bg-primary' : 'bg-muted-foreground/30')} />
                    <span className={cn(hit && 'font-semibold')}>{s!.name}</span>
                    <span className="text-muted-foreground/60 text-[10px]">{s!.strand}</span>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card className="p-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5" /> Study folder
            </h2>
            <code className="text-[10px] text-muted-foreground break-all block mb-2">
              content/english/{book.slug}/
            </code>
            <ul className="text-[11px] space-y-0.5 text-muted-foreground">
              <li>· <code>notes.md</code> — chapters, characters, themes</li>
              <li>· <code>vocab.md</code> — guess first, then check</li>
              <li>· <code>quotes.md</code> — evidence bank</li>
              <li>· <code>essay.md</code> — thesis → draft → revision</li>
            </ul>
          </Card>

          {book.pairsWith && book.pairsWith.length > 0 && (
            <Card className="p-3">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Read next
              </h2>
              <ul className="space-y-1">
                {book.pairsWith.map((p) => {
                  const o = bookBySlug(p)
                  if (!o) return null
                  return (
                    <li key={p}>
                      <Link href={`/dashboard/english/${p}`} className="text-[11px] text-primary hover:underline">
                        {o.title}
                      </Link>
                      <span className="text-[10px] text-muted-foreground"> — {o.themes[0]}</span>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          <Card className="p-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Cite it like this
            </h2>
            <p className="text-[11px] leading-snug">{citation(book)}</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
