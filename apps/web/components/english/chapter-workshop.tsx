'use client'

/**
 * The chapter workshop.
 *
 * Most of the English 7 list is still in copyright, so the book itself has to
 * be a real book — borrowed, bought, or on the classroom shelf. What the app
 * can do is turn every chapter into a piece of work: read it, then say what
 * happened, find the one sentence that proves it, collect the words that
 * stopped you, and ask the thing you actually want to know.
 *
 * Everything he writes here is saved as a note, tagged with the book and the
 * chapter, so it joins the rest of his notebook instead of dying in a form.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookMarked, Check, ChevronDown, Loader2, MessageSquare, Save, Sparkles,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  type Book, type Layer, LAYERS, skillById, skillsForForm,
} from '@/lib/english'

// ── the four moves, in the order a reader actually makes them ───────────────

interface Station {
  id: 'retell' | 'evidence' | 'words' | 'question'
  label: string
  /** The heading Daniel sees. */
  ask: string
  /** Why this move matters — one line, no lecture. */
  why: string
  placeholder: string
  /** Skill ids this feeds. */
  skills: string[]
}

const STATIONS: Station[] = [
  {
    id: 'retell', label: 'What happened',
    ask: 'Say what happened in this chapter — in your own words, in about four sentences.',
    why: 'If you cannot retell it, you did not read it. This is the cheapest check there is.',
    placeholder: 'In this chapter…',
    skills: ['main-idea', 'structure'],
  },
  {
    id: 'evidence', label: 'The sentence',
    ask: 'Copy out the one sentence that matters most in this chapter, then say why you picked it.',
    why: 'Every claim you will ever make about this book has to be nailed to a sentence like this one.',
    placeholder: '"…"\n\nI picked it because…',
    skills: ['evidence', 'inference', 'figurative'],
  },
  {
    id: 'words', label: 'Words',
    ask: 'List the words that stopped you. Guess what each one means from the sentence around it BEFORE you look it up — then check.',
    why: 'Guessing first is the skill. Looking it up first teaches you nothing.',
    placeholder: 'word — my guess — what it actually means',
    skills: ['context-clues', 'roots', 'connotation'],
  },
  {
    id: 'question', label: 'Your question',
    ask: 'What do you actually want to know after this chapter? Write the real question, not a polite one.',
    why: 'The question you carry into the next chapter is what makes you read it differently.',
    placeholder: 'Why does…',
    skills: ['inference', 'character', 'purpose-bias'],
  },
]

type Draft = Record<Station['id'], string>
const EMPTY: Draft = { retell: '', evidence: '', words: '', question: '' }

const key = (slug: string, ch: string) => `cb:workshop:${slug}:${ch}`

export default function ChapterWorkshop({
  book, layer, onDiscuss,
}: {
  book: Book
  layer: Layer
  /** Hand the written work to the tutor on the same page. */
  onDiscuss: (text: string) => void
}) {
  const [chapter, setChapter] = useState('1')
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [open, setOpen] = useState<Station['id']>('retell')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // One draft per chapter, kept locally so nothing is lost on a refresh.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key(book.slug, chapter))
      setDraft(raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) } : EMPTY)
    } catch { setDraft(EMPTY) }
    setSaved(false)
  }, [book.slug, chapter])

  const update = useCallback((id: Station['id'], v: string) => {
    setDraft((d) => {
      const next = { ...d, [id]: v }
      try { window.localStorage.setItem(key(book.slug, chapter), JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    setSaved(false)
  }, [book.slug, chapter])

  // The skills this book is genuinely good for, filtered to the current layer.
  const relevant = useMemo(() => {
    const ids = new Set(skillsForForm(book.form))
    return STATIONS.map((s) => ({
      station: s,
      skills: s.skills
        .filter((id) => ids.has(id))
        .map(skillById)
        .filter((sk): sk is NonNullable<typeof sk> => !!sk && sk.layers.includes(layer)),
    }))
  }, [book.form, layer])

  const filled = STATIONS.filter((s) => draft[s.id].trim().length > 12).length

  const asText = useCallback(() => STATIONS
    .filter((s) => draft[s.id].trim())
    .map((s) => `${s.label.toUpperCase()}\n${draft[s.id].trim()}`)
    .join('\n\n'), [draft])

  const save = useCallback(async () => {
    const body = asText()
    if (!body) return
    setSaving(true)
    try {
      await fetch('/api/notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${book.title} — chapter ${chapter}`,
          content: STATIONS.filter((s) => draft[s.id].trim()).map((s) =>
            `<h3>${s.label}</h3><p>${draft[s.id].trim()
              .replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] ?? c))
              .replace(/\n/g, '<br/>')}</p>`
          ).join(''),
          contentFormat: 'html',
          subject: 'English 7',
          tags: ['english7', book.slug, `ch-${chapter}`],
        }),
      })
      setSaved(true)
    } catch { /* the draft is still in local storage */ } finally { setSaving(false) }
  }, [asText, book, chapter, draft])

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-3 py-2">
        <BookMarked className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Chapter workshop
        </span>
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-muted-foreground">Chapter</label>
          <input
            value={chapter}
            onChange={(e) => setChapter(e.target.value.slice(0, 12))}
            className="w-16 rounded-md bg-muted/40 px-2 py-1 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground tabular-nums">{filled}/4 done</span>
          <div className="flex gap-0.5">
            {STATIONS.map((s) => (
              <span
                key={s.id}
                className={cn('h-1.5 w-6 rounded-full',
                  draft[s.id].trim().length > 12 ? 'bg-primary' : 'bg-muted-foreground/25')}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="divide-y divide-border/60">
        {relevant.map(({ station, skills }) => {
          const isOpen = open === station.id
          const done = draft[station.id].trim().length > 12
          return (
            <div key={station.id}>
              <button
                onClick={() => setOpen(isOpen ? ('' as Station['id']) : station.id)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30"
              >
                <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px]',
                  done ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 text-muted-foreground')}>
                  {done ? <Check className="h-2.5 w-2.5" /> : STATIONS.indexOf(station) + 1}
                </span>
                <span className="text-xs font-semibold">{station.label}</span>
                <span className="hidden truncate text-[11px] text-muted-foreground sm:inline">— {station.ask}</span>
                <ChevronDown className={cn('ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                  isOpen && 'rotate-180')} />
              </button>

              {isOpen && (
                <div className="space-y-2 px-3 pb-3">
                  <p className="text-xs font-medium leading-relaxed">{station.ask}</p>
                  <p className="text-[11px] italic text-muted-foreground">{station.why}</p>
                  <textarea
                    value={draft[station.id]}
                    onChange={(e) => update(station.id, e.target.value)}
                    rows={station.id === 'words' ? 5 : 4}
                    placeholder={station.placeholder}
                    className="w-full resize-y rounded-lg bg-muted/40 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {skills.length > 0 && (
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                      <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <Sparkles className="h-3 w-3" /> push it further
                      </p>
                      <ul className="space-y-1">
                        {skills.slice(0, 2).map((sk) => (
                          <li key={sk.id} className="text-[11px] leading-relaxed text-muted-foreground">
                            <span className="font-semibold text-foreground">{sk.name}:</span>{' '}
                            {sk.stems[Math.abs(hash(chapter + sk.id)) % sk.stems.length]}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-3 py-2">
        <Button size="sm" onClick={() => void save()} disabled={saving || filled === 0}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
          Save chapter {chapter} to notes
        </Button>
        <Button
          size="sm" variant="outline"
          disabled={filled === 0}
          onClick={() => onDiscuss(
            `Here is my work on chapter ${chapter} of ${book.title}.\n\n${asText()}`
          )}
        >
          <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Talk it through
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
            <Check className="h-3 w-3" /> saved — tagged <code>ch-{chapter}</code>
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {LAYERS[layer].emoji} {LAYERS[layer].label}
        </span>
      </div>
    </Card>
  )
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}
