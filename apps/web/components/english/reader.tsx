'use client'

/**
 * The reader.
 *
 * Renders a complete public-domain book chapter by chapter — real text, not a
 * summary. Everything a twelve-year-old needs while reading is one tap away:
 * change the type size, jump to a chapter, search the whole book, highlight a
 * sentence and either save it as a note or hand it to the tutor.
 *
 * The tutor call is the important one. Everywhere else in the app the tutor is
 * forbidden to discuss the text because it has not read the book. Here it has
 * the passage in front of it, so it can work line by line without inventing
 * anything.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ChevronLeft, ChevronRight, List, Search, Settings2,
  MessageSquare, BookmarkPlus, X, Loader2, Send, Check, Type,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  FullText, ProseChapter, PlayScene, PlaySpeech,
} from '@/lib/english/texts'

// ── reading preferences ─────────────────────────────────────────────────────

const SIZES = [
  { id: 'sm', label: 'S', cls: 'text-base leading-8' },
  { id: 'md', label: 'M', cls: 'text-lg leading-9' },
  { id: 'lg', label: 'L', cls: 'text-xl leading-10' },
  { id: 'xl', label: 'XL', cls: 'text-2xl leading-[2.75rem]' },
] as const
type SizeId = typeof SIZES[number]['id']

const WIDTHS = [
  { id: 'narrow', label: 'Narrow', cls: 'max-w-xl' },
  { id: 'normal', label: 'Normal', cls: 'max-w-2xl' },
  { id: 'wide', label: 'Wide', cls: 'max-w-4xl' },
] as const
type WidthId = typeof WIDTHS[number]['id']

const TONES = [
  { id: 'night', label: 'Night', page: 'bg-[#050505]', ink: 'text-neutral-200' },
  { id: 'ink', label: 'Ink', page: 'bg-[#0d0d0f]', ink: 'text-neutral-300' },
  { id: 'sepia', label: 'Sepia', page: 'bg-[#181410]', ink: 'text-[#e6dcc8]' },
] as const
type ToneId = typeof TONES[number]['id']

interface Prefs { size: SizeId; width: WidthId; tone: ToneId }
const DEFAULT_PREFS: Prefs = { size: 'md', width: 'normal', tone: 'night' }

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? { ...fallback, ...(JSON.parse(raw) as object) } as T : fallback
  } catch { return fallback }
}
function saveJson(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* private mode */ }
}

// ── shared shape across prose and plays ─────────────────────────────────────

interface Unit {
  id: string
  label: string
  title: string
  group?: string
  /** Flat text, used for search, the tutor and word counts. */
  plain: string
  render: React.ReactNode
}

function proseUnits(chs: ProseChapter[]): Unit[] {
  return chs.map((c) => ({
    id: c.id,
    label: c.label,
    title: c.title,
    group: c.part,
    plain: c.paras.map((p) => p.text).join('\n\n'),
    render: (
      <>
        {c.paras.map((p, i) =>
          p.kind === 'verse' ? (
            <pre key={i} className="my-7 whitespace-pre-wrap font-serif italic opacity-90">
              {p.text}
            </pre>
          ) : (
            <p key={i} className="mb-6">{p.text}</p>
          )
        )}
      </>
    ),
  }))
}

const SPEAKER_TINTS = [
  'text-amber-300', 'text-sky-300', 'text-emerald-300', 'text-rose-300',
  'text-violet-300', 'text-orange-300', 'text-teal-300', 'text-pink-300',
]
function tintFor(who: string, cast: string[]) {
  const i = cast.indexOf(who)
  return i < 0 ? 'text-neutral-400' : SPEAKER_TINTS[i % SPEAKER_TINTS.length]
}

function playUnits(scenes: PlayScene[]): Unit[] {
  return scenes.map((s, si) => {
    const cast = Array.from(new Set(s.speeches.map((sp) => sp.who)))
    const plain = s.speeches
      .map((sp) => `${sp.who}: ` + sp.lines.map((l) => l.text ?? `[${l.stage}]`).join(' '))
      .join('\n')
    return {
      id: `s${si + 1}`,
      label: s.head.replace(/^SCENE/i, 'Scene').split('.')[0] ?? s.head,
      title: s.head.split('.').slice(1).join('.').trim(),
      group: s.act,
      plain,
      render: <SceneBody scene={s} cast={cast} />,
    }
  })
}

function SceneBody({ scene, cast }: { scene: PlayScene; cast: string[] }) {
  return (
    <>
      <div className="mb-8 rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <p className="mb-2 text-[11px] uppercase tracking-widest text-neutral-500">
          On stage in this scene
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {cast.map((c) => (
            <span key={c} className={cn('font-semibold', tintFor(c, cast))}>{c}</span>
          ))}
        </div>
      </div>
      {scene.stage && (
        <p className="mb-8 italic text-neutral-500">{scene.stage}</p>
      )}
      {scene.speeches.map((sp: PlaySpeech, i) => (
        <div key={i} className="mb-6">
          <p className={cn('mb-1 text-sm font-bold uppercase tracking-wide', tintFor(sp.who, cast))}>
            {sp.who}
          </p>
          {sp.lines.map((l, j) =>
            l.stage ? (
              <p key={j} className="my-3 pl-6 italic text-neutral-500">{l.stage}</p>
            ) : (
              <p key={j} className="group flex gap-4 pl-6 -indent-0">
                <span className="w-14 shrink-0 select-none pt-[0.15em] text-right font-mono text-[11px] text-neutral-700 group-hover:text-neutral-500">
                  {l.n}
                </span>
                <span className="flex-1">{l.text}</span>
              </p>
            )
          )}
        </div>
      ))}
    </>
  )
}

// ── the reader ──────────────────────────────────────────────────────────────

export default function Reader({ meta }: { meta: FullText }) {
  const [units, setUnits] = useState<Unit[] | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [showToc, setShowToc] = useState(false)
  const [showPrefs, setShowPrefs] = useState(false)
  const [query, setQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null)
  const [tutorOpen, setTutorOpen] = useState(false)
  const [tutorSeed, setTutorSeed] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [scrollPct, setScrollPct] = useState(0)

  const bodyRef = useRef<HTMLDivElement>(null)
  const storeKey = `cb:reader:${meta.slug}`

  // Preferences and last position.
  useEffect(() => {
    setPrefs(loadJson<Prefs>('cb:reader:prefs', DEFAULT_PREFS))
    const pos = loadJson<{ idx: number }>(storeKey, { idx: 0 })
    if (typeof pos.idx === 'number') setIdx(pos.idx)
  }, [storeKey])

  useEffect(() => { saveJson('cb:reader:prefs', prefs) }, [prefs])

  // Fetch the book once.
  useEffect(() => {
    let off = false
    fetch(`/english/texts/${meta.slug}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (off) return
        setUnits(meta.kind === 'play'
          ? playUnits(data as PlayScene[])
          : proseUnits(data as ProseChapter[]))
      })
      .catch((e) => { if (!off) setLoadErr(String(e?.message ?? e)) })
    return () => { off = true }
  }, [meta.slug, meta.kind])

  const unit = units?.[idx]
  const total = units?.length ?? meta.units

  // Save position, and tell the server roughly how far in he is.
  const persist = useCallback((next: number) => {
    saveJson(storeKey, { idx: next })
    const u = units?.[next]
    if (!u) return
    fetch('/api/english/progress', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: meta.slug,
        status: 'reading',
        currentPart: [u.group, u.label].filter(Boolean).join(' · '),
        percent: Math.round(((next + 1) / total) * 100),
      }),
    }).catch(() => { /* the reader must work offline of the DB */ })
  }, [storeKey, units, meta.slug, total])

  const goto = useCallback((next: number) => {
    if (!units) return
    const n = Math.max(0, Math.min(units.length - 1, next))
    setIdx(n)
    setShowToc(false)
    setSelection(null)
    persist(n)
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }))
  }, [units, persist])

  // Arrow keys turn the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && /input|textarea/i.test(t.tagName)) return
      if (e.key === 'ArrowRight') goto(idx + 1)
      if (e.key === 'ArrowLeft') goto(idx - 1)
      if (e.key === 'Escape') { setShowToc(false); setShowPrefs(false); setShowSearch(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, goto])

  // Scroll progress within the chapter.
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement
      const max = h.scrollHeight - h.clientHeight
      setScrollPct(max > 0 ? Math.min(100, Math.round((h.scrollTop / max) * 100)) : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [idx, units])

  // Highlight → act on it.
  useEffect(() => {
    const onUp = () => {
      const sel = window.getSelection()
      const text = sel?.toString().trim() ?? ''
      if (!text || text.length < 8 || !sel || sel.rangeCount === 0) { setSelection(null); return }
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      setSelection({ text: text.slice(0, 1500), x: rect.left + rect.width / 2, y: rect.top })
    }
    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchend', onUp)
    return () => {
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchend', onUp)
    }
  }, [])

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 3 || !units) return []
    const out: { i: number; label: string; snippet: string }[] = []
    units.forEach((u, i) => {
      const low = u.plain.toLowerCase()
      let at = low.indexOf(q)
      let n = 0
      while (at >= 0 && n < 3) {
        out.push({
          i, label: [u.group, u.label].filter(Boolean).join(' · '),
          snippet: '…' + u.plain.slice(Math.max(0, at - 60), at + q.length + 90).replace(/\n+/g, ' ') + '…',
        })
        at = low.indexOf(q, at + q.length)
        n += 1
      }
    })
    return out.slice(0, 40)
  }, [query, units])

  const saveQuote = useCallback(async (text: string) => {
    if (!unit) return
    const where = [unit.group, unit.label, unit.title].filter(Boolean).join(' · ')
    await fetch('/api/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${meta.title} — ${unit.label}`,
        content: `<blockquote><p>${text.replace(/[<>&]/g, (c) =>
          ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] ?? c))}</p></blockquote>`
          + `<p><em>${meta.title}</em>, ${meta.authors.join(', ')} — ${where}</p>`,
        contentFormat: 'html',
        subject: 'English 7',
        tags: ['english7', 'quote', meta.slug],
      }),
    }).catch(() => {})
    setSelection(null)
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1800)
  }, [unit, meta])

  const tone = TONES.find((t) => t.id === prefs.tone) ?? TONES[0]
  const size = SIZES.find((s) => s.id === prefs.size) ?? SIZES[1]
  const width = WIDTHS.find((w) => w.id === prefs.width) ?? WIDTHS[1]

  return (
    <div className={cn('min-h-screen', tone.page, tone.ink)}>
      {/* progress rail */}
      <div className="fixed inset-x-0 top-0 z-40 h-[3px] bg-white/5">
        <div
          className="h-full bg-orange-400/80 transition-[width] duration-150"
          style={{ width: `${((idx + scrollPct / 100) / total) * 100}%` }}
        />
      </div>

      {/* bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <Link
            href={meta.onList ? `/dashboard/english/${meta.slug}` : '/dashboard/english/read'}
            className="rounded p-2 text-neutral-400 hover:bg-white/5 hover:text-white"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{meta.title}</p>
            <p className="truncate text-[11px] text-neutral-500">
              {meta.authors.join(', ')} · {unit ? [unit.group, unit.label].filter(Boolean).join(' · ') : '…'}
              {' · '}{idx + 1} of {total}
            </p>
          </div>
          <button onClick={() => setShowSearch((v) => !v)} className="rounded p-2 text-neutral-400 hover:bg-white/5 hover:text-white" aria-label="Search">
            <Search className="h-4 w-4" />
          </button>
          <button onClick={() => setShowPrefs((v) => !v)} className="rounded p-2 text-neutral-400 hover:bg-white/5 hover:text-white" aria-label="Reading settings">
            <Settings2 className="h-4 w-4" />
          </button>
          <button onClick={() => setShowToc((v) => !v)} className="rounded p-2 text-neutral-400 hover:bg-white/5 hover:text-white" aria-label="Contents">
            <List className="h-4 w-4" />
          </button>
          <Button
            size="sm"
            onClick={() => { setTutorSeed(null); setTutorOpen(true) }}
            className="ml-1 hidden gap-1.5 bg-orange-500/90 text-black hover:bg-orange-400 sm:flex"
          >
            <MessageSquare className="h-3.5 w-3.5" /> Tutor
          </Button>
        </div>

        {showPrefs && (
          <div className="border-t border-white/10 bg-black/80">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-6 px-4 py-3 text-xs">
              <Row icon={<Type className="h-3.5 w-3.5" />} label="Size">
                {SIZES.map((s) => (
                  <Pill key={s.id} on={prefs.size === s.id} onClick={() => setPrefs({ ...prefs, size: s.id })}>{s.label}</Pill>
                ))}
              </Row>
              <Row label="Width">
                {WIDTHS.map((w) => (
                  <Pill key={w.id} on={prefs.width === w.id} onClick={() => setPrefs({ ...prefs, width: w.id })}>{w.label}</Pill>
                ))}
              </Row>
              <Row label="Page">
                {TONES.map((t) => (
                  <Pill key={t.id} on={prefs.tone === t.id} onClick={() => setPrefs({ ...prefs, tone: t.id })}>{t.label}</Pill>
                ))}
              </Row>
            </div>
          </div>
        )}

        {showSearch && (
          <div className="border-t border-white/10 bg-black/90">
            <div className="mx-auto max-w-5xl px-4 py-3">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search the whole ${meta.kind === 'play' ? 'play' : 'book'} — a word, a name, a phrase`}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-orange-400/50"
              />
              {query.trim().length >= 3 && (
                <p className="mt-2 text-[11px] text-neutral-500">
                  {hits.length === 0 ? 'Nothing found.' : `${hits.length} place${hits.length === 1 ? '' : 's'}`}
                </p>
              )}
              <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                {hits.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => { goto(h.i); setShowSearch(false) }}
                    className="block w-full rounded px-3 py-2 text-left hover:bg-white/5"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-orange-300/80">{h.label}</span>
                    <span className="mt-0.5 block text-xs text-neutral-400">{h.snippet}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* contents */}
      {showToc && units && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setShowToc(false)}>
          <div className="flex-1 bg-black/60" />
          <aside
            className="h-full w-[min(24rem,90vw)] overflow-y-auto border-l border-white/10 bg-[#0a0a0a] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Contents</p>
              <button onClick={() => setShowToc(false)} className="rounded p-1 text-neutral-500 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            {units.map((u, i) => (
              <div key={u.id}>
                {(i === 0 || u.group !== units[i - 1]?.group) && u.group && (
                  <p className="mb-1 mt-4 text-[11px] uppercase tracking-widest text-neutral-600">{u.group}</p>
                )}
                <button
                  onClick={() => goto(i)}
                  className={cn(
                    'block w-full rounded px-3 py-2 text-left text-sm hover:bg-white/5',
                    i === idx ? 'bg-orange-500/10 text-orange-200' : 'text-neutral-400'
                  )}
                >
                  <span className="font-medium">{u.label}</span>
                  {u.title && <span className="block text-xs text-neutral-500">{u.title}</span>}
                </button>
              </div>
            ))}
          </aside>
        </div>
      )}

      {/* the text */}
      <main className={cn('mx-auto px-5 py-12 font-serif', width.cls, size.cls)}>
        {loadErr && (
          <p className="rounded border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
            The text did not load ({loadErr}). Reload the page — if it keeps happening the
            file at <code>/english/texts/{meta.slug}.json</code> is missing from the deploy.
          </p>
        )}
        {!units && !loadErr && (
          <p className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Opening {meta.title}…
          </p>
        )}
        {unit && (
          <>
            {unit.group && (
              <p className="mb-2 text-center text-xs uppercase tracking-[0.3em] text-neutral-600">{unit.group}</p>
            )}
            <h1 className="mb-2 text-center text-3xl font-bold tracking-tight">{unit.label}</h1>
            {unit.title && (
              <p className="mb-12 text-center text-base italic text-neutral-500">{unit.title}</p>
            )}
            <div ref={bodyRef} className="selection:bg-orange-400/30">{unit.render}</div>
          </>
        )}

        {/* turn the page */}
        {units && (
          <div className="mt-16 flex items-center justify-between border-t border-white/10 pt-6 text-sm">
            <button
              onClick={() => goto(idx - 1)}
              disabled={idx === 0}
              className="flex items-center gap-1 rounded px-3 py-2 text-neutral-400 hover:bg-white/5 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <span className="text-xs text-neutral-600">{idx + 1} / {total}</span>
            <button
              onClick={() => goto(idx + 1)}
              disabled={idx >= total - 1}
              className="flex items-center gap-1 rounded px-3 py-2 text-neutral-400 hover:bg-white/5 hover:text-white disabled:opacity-30"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <p className="mt-10 text-center text-[11px] leading-relaxed text-neutral-700">
          {meta.edition}. Source: {meta.sourceName}. {meta.rights}
        </p>
      </main>

      {/* highlight actions */}
      {selection && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-white/15 bg-neutral-900 p-1 shadow-2xl"
          style={{ left: selection.x, top: Math.max(60, selection.y - 8) }}
        >
          <div className="flex gap-1">
            <button
              onClick={() => { setTutorSeed(selection.text); setTutorOpen(true); setSelection(null) }}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs text-neutral-200 hover:bg-white/10"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Ask about this
            </button>
            <button
              onClick={() => saveQuote(selection.text)}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs text-neutral-200 hover:bg-white/10"
            >
              <BookmarkPlus className="h-3.5 w-3.5" /> Save quote
            </button>
          </div>
        </div>
      )}

      {savedFlash && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-300">
          <Check className="h-3.5 w-3.5" /> Saved to your notes
        </div>
      )}

      {/* tutor */}
      {tutorOpen && unit && (
        <TutorPanel
          meta={meta}
          unit={unit}
          seed={tutorSeed}
          onClose={() => setTutorOpen(false)}
        />
      )}

      {/* mobile tutor button */}
      <button
        onClick={() => { setTutorSeed(null); setTutorOpen(true) }}
        className="fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-black shadow-xl sm:hidden"
        aria-label="Tutor"
      >
        <MessageSquare className="h-5 w-5" />
      </button>
    </div>
  )
}

function Row({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 text-neutral-500">{icon}{label}</span>
      <div className="flex gap-1">{children}</div>
    </div>
  )
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded px-2.5 py-1 text-[11px] font-medium transition',
        on ? 'bg-orange-500/20 text-orange-200' : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-300'
      )}
    >
      {children}
    </button>
  )
}

// ── the tutor, grounded in the passage ──────────────────────────────────────

interface Turn { role: 'user' | 'assistant'; content: string }

function TutorPanel({
  meta, unit, seed, onClose,
}: { meta: FullText; unit: Unit; seed: string | null; onClose: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, thinking])

  const send = useCallback(async (text: string, history: Turn[]) => {
    setThinking(true)
    setErr(null)
    const next = text ? [...history, { role: 'user' as const, content: text }] : history
    if (text) setTurns(next)
    try {
      const r = await fetch('/api/english/tutor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: meta.slug,
          messages: next,
          part: [unit.group, unit.label, unit.title].filter(Boolean).join(' · '),
          // The passage is what makes this tutor different: it can read.
          passage: unit.plain.slice(0, 24000),
          quote: seed ?? undefined,
        }),
      })
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j.error ?? 'The tutor did not answer.')
      setTurns([...next, { role: 'assistant', content: j.reply as string }])
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setThinking(false)
    }
  }, [meta.slug, unit, seed])

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (seed) send(`I want to talk about this part:\n\n"${seed}"`, [])
    else send('', [])
  }, [seed, send])

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/50" />
      <aside
        className="flex h-full w-[min(30rem,100vw)] flex-col border-l border-white/10 bg-[#0a0a0a]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Reading tutor</p>
            <p className="truncate text-[11px] text-neutral-500">
              Reading with you: {[unit.group, unit.label].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-neutral-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {turns.map((t, i) => (
            <div
              key={i}
              className={cn(
                'whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed',
                t.role === 'user'
                  ? 'ml-8 bg-orange-500/10 text-orange-100'
                  : 'mr-4 bg-white/5 text-neutral-200'
              )}
            >
              {t.content}
            </div>
          ))}
          {thinking && (
            <p className="flex items-center gap-2 text-xs text-neutral-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking…
            </p>
          )}
          {err && <p className="text-xs text-red-400">{err}</p>}
          <div ref={endRef} />
        </div>

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {['I don\'t get this part', 'What should I notice here?', 'Quiz me on this chapter'].map((q) => (
              <button
                key={q}
                onClick={() => send(q, turns)}
                disabled={thinking}
                className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-neutral-400 hover:border-orange-400/40 hover:text-orange-200 disabled:opacity-40"
              >
                {q}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); if (draft.trim() && !thinking) { send(draft.trim(), turns); setDraft('') } }}
            className="flex gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type what you think…"
              className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-orange-400/50"
            />
            <Button type="submit" size="sm" disabled={thinking || !draft.trim()} className="bg-orange-500 text-black hover:bg-orange-400">
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      </aside>
    </div>
  )
}
