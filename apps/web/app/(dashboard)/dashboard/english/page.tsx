'use client'

/**
 * English 7 — the reading list, organised by the four learning layers.
 *
 * The 43 FCPS titles with progress, filters, and the corrections audit. Every
 * card links into the book workspace where the Socratic tutor lives.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen, Search, AlertTriangle, HelpCircle, Download, Loader2,
  Check, ExternalLink, Filter, X, GraduationCap,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  BOOKS, CORRECTED_BOOKS, AMBIGUOUS_BOOKS, HANDOUT_RESOURCES,
  LAYERS, LAYER_ORDER, allThemes, citation,
  type Book, type Layer, type Band,
} from '@/lib/english'

interface Progress {
  layer: Layer
  status: 'not_started' | 'reading' | 'finished' | 'abandoned'
  currentPart: string | null
  percent: number
  rating: number | null
}

const BAND_STYLE: Record<Band, string> = {
  accessible: 'bg-emerald-500/15 text-emerald-400',
  core: 'bg-sky-500/15 text-sky-400',
  stretch: 'bg-violet-500/15 text-violet-400',
}

const FORM_EMOJI: Record<string, string> = {
  'novel': '📕', 'novel-in-verse': '🪶', 'graphic-novel': '🖼️', 'memoir': '🧭',
  'verse-memoir': '🪶', 'biography': '👤', 'autobiography': '👤',
  'nonfiction': '📗', 'play': '🎭', 'diary': '📔',
}

export default function EnglishLibraryPage() {
  const [progress, setProgress] = useState<Record<string, Progress>>({})
  const [migrated, setMigrated] = useState(true)
  const [loading, setLoading] = useState(true)
  const [ingesting, setIngesting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [layer, setLayer] = useState<Layer | 'all'>('all')
  const [band, setBand] = useState<Band | 'all'>('all')
  const [theme, setTheme] = useState<string | null>(null)
  const [showAudit, setShowAudit] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/english/books')
      const j = await res.json()
      if (j.success) { setProgress(j.progress ?? {}); setMigrated(j.migrated !== false) }
    } catch { /* the catalog still renders from local config */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const ingest = async () => {
    setIngesting(true); setMsg(null)
    try {
      const res = await fetch('/api/english/books', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ingest' }),
      })
      const j = await res.json()
      setMsg(j.success
        ? `Loaded ${j.total} titles — ${j.created} added, ${j.updated} refreshed.`
        : (j.error ?? 'Ingest failed.'))
      await load()
    } catch { setMsg('Ingest failed — is the English migration applied?') }
    finally { setIngesting(false) }
  }

  const themes = useMemo(() => allThemes().slice(0, 18), [])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return BOOKS.filter((b) => {
      if (band !== 'all' && b.band !== band) return false
      if (theme && !b.themes.includes(theme)) return false
      if (layer !== 'all') {
        const p = progress[b.slug]
        // Untouched books count as "required" — that is what the list is.
        if ((p?.layer ?? 'required') !== layer) return false
      }
      if (!s) return true
      return `${b.title} ${b.subtitle ?? ''} ${b.authors.join(' ')} ${b.themes.join(' ')}`
        .toLowerCase().includes(s)
    })
  }, [q, layer, band, theme, progress])

  const stats = useMemo(() => {
    const vals = Object.values(progress)
    return {
      reading: vals.filter((p) => p.status === 'reading').length,
      finished: vals.filter((p) => p.status === 'finished').length,
    }
  }, [progress])

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1500px] mx-auto">
      {/* ── header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-orange-400" /> English 7 AA
          </h1>
          <p className="text-xs text-muted-foreground">
            {BOOKS.length} texts · Champagne, J. · Period 7 · E109
            {stats.finished > 0 && ` · ${stats.finished} finished`}
            {stats.reading > 0 && ` · ${stats.reading} in progress`}
          </p>
        </div>
        <Link href="/dashboard/prep" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
          <GraduationCap className="w-3.5 h-3.5" /> Course Prep
        </Link>
        <button
          onClick={() => setShowAudit((v) => !v)}
          className="text-xs font-semibold text-amber-500 hover:underline inline-flex items-center gap-1"
        >
          <AlertTriangle className="w-3.5 h-3.5" /> {CORRECTED_BOOKS.length} handout corrections
        </button>
        {!migrated && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={ingest} disabled={ingesting}>
            {ingesting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
            Load catalog
          </Button>
        )}
        {migrated && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={ingest} disabled={ingesting}>
            {ingesting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
            Re-sync catalog
          </Button>
        )}
      </div>

      {!migrated && (
        <Card className="p-3 text-xs border-amber-500/30 bg-amber-500/[0.06] flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
          <span>
            The English tables are not in the database yet. The list below still works, but progress
            and the tutor cannot be saved until you run <code>pnpm db:migrate</code> — which is now{' '}
            <code>prisma migrate deploy</code> and cannot reset anything.
          </span>
        </Card>
      )}

      {msg && (
        <Card className="p-3 text-xs flex items-start gap-2 border-primary/30 bg-primary/[0.05]">
          <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </Card>
      )}

      {/* ── corrections audit ── */}
      {showAudit && (
        <Card className="p-4 space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            What the printed handout got wrong
          </h2>
          <p className="text-xs text-muted-foreground">
            Every citation was checked against publisher, award-body and library records. The errors are
            recorded rather than silently fixed, so the sheet can still be matched line by line.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="text-muted-foreground">
                <tr className="text-left border-b border-border/60">
                  <th className="py-1.5 pr-3 font-semibold">#</th>
                  <th className="py-1.5 pr-3 font-semibold">Handout says</th>
                  <th className="py-1.5 pr-3 font-semibold">Correct</th>
                  <th className="py-1.5 font-semibold">What was wrong</th>
                </tr>
              </thead>
              <tbody>
                {CORRECTED_BOOKS.map((b) => (
                  <tr key={b.slug} className="border-b border-border/40 align-top">
                    <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">{b.n}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground line-through decoration-1">{b.handoutSays}</td>
                    <td className="py-1.5 pr-3 font-medium">{citation(b)}</td>
                    <td className="py-1.5 text-muted-foreground">{b.correction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-2 border-t border-border/60">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-amber-500 mb-1.5 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" /> Ask Ms. Champagne ({AMBIGUOUS_BOOKS.length})
            </h3>
            <ul className="space-y-1">
              {AMBIGUOUS_BOOKS.map((b) => (
                <li key={b.slug} className="text-[11px]">
                  <span className="font-semibold">#{b.n} {b.title}</span>
                  <span className="text-muted-foreground"> — {b.ambiguity}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-2 border-t border-border/60 flex flex-wrap gap-x-4 gap-y-1">
            {HANDOUT_RESOURCES.map((r) => (
              <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                {r.label} <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* ── layers ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {LAYER_ORDER.map((k) => {
          const L = LAYERS[k]
          const n = Object.values(progress).filter((p) => p.layer === k).length
          const active = layer === k
          return (
            <button
              key={k}
              onClick={() => setLayer(active ? 'all' : k)}
              className={cn(
                'text-left rounded-xl border p-3 transition-colors',
                active ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/40'
              )}
            >
              <div className="flex items-center gap-1.5">
                <span>{L.emoji}</span>
                <span className="text-sm font-bold" style={{ color: L.accent }}>{L.label}</span>
                {n > 0 && <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{n}</span>}
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug mt-1">{L.short} — {L.purpose}</p>
            </button>
          )
        })}
      </div>

      {/* ── filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Title, author, theme…"
            className="w-full bg-muted/40 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {(['accessible', 'core', 'stretch'] as Band[]).map((b) => (
          <button key={b} onClick={() => setBand(band === b ? 'all' : b)}
            className={cn('text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors',
              band === b ? BAND_STYLE[b] : 'bg-muted/40 text-muted-foreground hover:text-foreground')}>
            {b}
          </button>
        ))}
        {(q || layer !== 'all' || band !== 'all' || theme) && (
          <button onClick={() => { setQ(''); setLayer('all'); setBand('all'); setTheme(null) }}
            className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
            <Filter className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {themes.map((t) => (
          <button key={t.theme} onClick={() => setTheme(theme === t.theme ? null : t.theme)}
            className={cn('text-[10px] px-2 py-0.5 rounded-full transition-colors',
              theme === t.theme ? 'bg-primary text-primary-foreground font-semibold' : 'bg-muted/50 text-muted-foreground hover:bg-muted')}>
            {t.theme} {t.count > 1 && <span className="opacity-60">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── the list ── */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-6">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="text-[11px] text-muted-foreground">
            {shown.length} of {BOOKS.length} titles
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((b) => <BookCard key={b.slug} book={b} progress={progress[b.slug]} />)}
          </div>
        </>
      )}
    </div>
  )
}

function BookCard({ book, progress }: { book: Book; progress?: Progress }) {
  const p = progress
  const reading = p?.status === 'reading'
  const done = p?.status === 'finished'
  return (
    <Link href={`/dashboard/english/${book.slug}`}>
      <Card className={cn(
        'p-3 h-full hover:border-primary/50 transition-colors',
        done && 'opacity-70'
      )}>
        <div className="flex items-start gap-2">
          <span className="text-lg shrink-0 leading-none mt-0.5">{FORM_EMOJI[book.form] ?? '📘'}</span>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm leading-snug">{book.title}</div>
            {book.subtitle && (
              <div className="text-[10px] text-muted-foreground leading-snug">{book.subtitle}</div>
            )}
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {book.authors.join(', ')} · {book.year}
            </div>
          </div>
          <span className="text-[9px] tabular-nums text-muted-foreground/60 shrink-0">#{book.n}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1 mt-2">
          <span className={cn('text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full', BAND_STYLE[book.band])}>
            {book.band}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{book.form}</span>
          {book.correction && (
            <span title={book.correction}
              className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-bold">
              corrected
            </span>
          )}
          {book.ambiguity && (
            <span title={book.ambiguity}
              className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-bold">
              ask teacher
            </span>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground mt-2 leading-snug line-clamp-2">
          {book.themes.join(' · ')}
        </p>

        {(reading || done) && (
          <div className="mt-2 pt-2 border-t border-border/60">
            {reading && (
              <>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>{p?.currentPart ?? 'in progress'}</span>
                  <span className="tabular-nums">{p?.percent ?? 0}%</span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${p?.percent ?? 0}%` }} />
                </div>
              </>
            )}
            {done && (
              <div className="text-[10px] text-emerald-400 font-semibold inline-flex items-center gap-1">
                <Check className="w-3 h-3" /> Finished{p?.rating ? ` · ${'★'.repeat(p.rating)}` : ''}
              </div>
            )}
          </div>
        )}
      </Card>
    </Link>
  )
}
