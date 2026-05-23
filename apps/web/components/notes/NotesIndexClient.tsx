'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Search, X, Loader2, Calendar,
} from 'lucide-react'
import { formatNoteTitle, formatTimelineHeading, getDateGroupKey } from '@/lib/note-format'
import type { Note } from '@/hooks/useNotes'

interface SubjectCount { subject: string; count: number }
interface GroupedNotes { [dateKey: string]: Note[] }
interface Meta { total: number; page: number; limit: number; totalPages: number; hasMore: boolean }

function groupNotesByDate(notes: Note[]): GroupedNotes {
  const groups: GroupedNotes = {}
  for (const note of notes) {
    const key = getDateGroupKey(note.createdAt)
    if (!groups[key]) groups[key] = []
    groups[key].push(note)
  }
  return groups
}

// ── Color helpers ─────────────────────────────────────────────────────────────
const COLOR_LIST = [
  { from: '#6366f1', to: '#8b5cf6', border: 'rgba(99,102,241,0.35)',  bg: 'rgba(99,102,241,0.07)'  },
  { from: '#10b981', to: '#0ea5e9', border: 'rgba(16,185,129,0.35)',  bg: 'rgba(16,185,129,0.07)'  },
  { from: '#f59e0b', to: '#ef4444', border: 'rgba(245,158,11,0.35)',  bg: 'rgba(245,158,11,0.07)'  },
  { from: '#ec4899', to: '#a855f7', border: 'rgba(236,72,153,0.35)',  bg: 'rgba(236,72,153,0.07)'  },
  { from: '#0ea5e9', to: '#6366f1', border: 'rgba(14,165,233,0.35)',  bg: 'rgba(14,165,233,0.07)'  },
  { from: '#14b8a6', to: '#10b981', border: 'rgba(20,184,166,0.35)',  bg: 'rgba(20,184,166,0.07)'  },
]

function subjectColor(subject?: string | null) {
  if (!subject) return COLOR_LIST[0]
  let hash = 0
  for (const c of subject) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return COLOR_LIST[Math.abs(hash) % COLOR_LIST.length]
}

// ── Note Card ─────────────────────────────────────────────────────────────────
function NoteTimelineCard({ note }: { note: Note }) {
  const preview = note.content
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  const displayTitle = formatNoteTitle(note)
  const color = subjectColor(note.subject)

  return (
    <Link
      href={`/dashboard/notes/${note.slug || note.id}`}
      className="group block rounded-2xl p-4 transition-all duration-200 hover:scale-[1.01] hover:-translate-y-0.5"
      style={{
        background: color.bg,
        border: `1px solid ${color.border}`,
        boxShadow: `0 4px 20px ${color.from}12`,
      }}
    >
      <div className="flex items-start gap-2.5 mb-2">
        <div
          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
          style={{
            background: `linear-gradient(135deg, ${color.from}, ${color.to})`,
            boxShadow: `0 0 6px ${color.from}80`,
          }}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm leading-snug line-clamp-2">{displayTitle}</h3>
          {note.subject && (
            <span
              className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md mt-1"
              style={{ background: `${color.from}20`, color: color.from }}
            >
              {note.subject}
            </span>
          )}
        </div>
        {note.aiAnalyzedAt && (
          <span title="AI analyzed" className="text-[10px] shrink-0" style={{ color: '#a5b4fc' }}>
            🧠
          </span>
        )}
      </div>

      {preview && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed pl-4">
          {preview}{note.content.length > 120 ? '…' : ''}
        </p>
      )}

      {note.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2 pl-4">
          {note.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'inherit',
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}

// ── Main Index ────────────────────────────────────────────────────────────────
export function NotesIndexClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [notes, setNotes] = useState<Note[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [subjects, setSubjects] = useState<SubjectCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Active filters from URL
  const activeSubject = searchParams.get('subject') || ''
  const activeMonth = searchParams.get('month') || ''
  const activeTag = searchParams.get('tag') || ''
  const activeQ = searchParams.get('q') || ''

  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      params.delete('page')
      router.push(`/dashboard/notes?${params}`)
    },
    [searchParams, router],
  )

  const clearFilters = () => router.push('/dashboard/notes')
  const hasActiveFilters = !!(activeSubject || activeMonth || activeTag || activeQ)

  // Fetch notes
  const fetchNotes = useCallback(
    async (page = 1, append = false) => {
      if (append) setIsLoadingMore(true)
      else { setIsLoading(true); setNotes([]) }
      setError(null)

      try {
        const params = new URLSearchParams({ page: String(page), limit: '20' })
        if (activeSubject) params.set('subject', activeSubject)
        if (activeMonth) params.set('month', activeMonth)
        if (activeTag) params.set('tag', activeTag)
        if (activeQ) params.set('q', activeQ)

        const res = await fetch(`/api/notes?${params}`)
        if (!res.ok) throw new Error('Failed to fetch notes')
        const { data, meta: m } = await res.json() as { data: Note[]; meta: Meta }

        setNotes((prev) => append ? [...prev, ...data] : data)
        setMeta(m)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load notes')
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [activeSubject, activeMonth, activeTag, activeQ],
  )

  // Fetch subjects sidebar
  useEffect(() => {
    fetch('/api/notes/subjects')
      .then((r) => r.json())
      .then(({ data }) => { if (Array.isArray(data)) setSubjects(data as SubjectCount[]) })
      .catch(() => {})
  }, [])

  // Fetch notes on filter change
  useEffect(() => { fetchNotes(1, false) }, [fetchNotes])

  // Debounced search input → URL
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (searchInput !== activeQ) setFilter('q', searchInput)
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const grouped = groupNotesByDate(notes)
  const sortedDateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              My Notes
            </span>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {meta
              ? `${meta.total.toLocaleString()} note${meta.total !== 1 ? 's' : ''}`
              : '…'}
            {hasActiveFilters && ' (filtered)'}
          </p>
        </div>
        <Link
          href="/dashboard/notes/new"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 shrink-0"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
          }}
        >
          <Plus className="h-4 w-4" /> New Note
        </Link>
      </div>

      {/* ── Search + Filters ── */}
      <div className="space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search notes…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'inherit',
            }}
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); setFilter('q', '') }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Subject filter chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setFilter('subject', '')}
            className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
            style={
              !activeSubject
                ? {
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: 'white',
                    boxShadow: '0 2px 10px rgba(99,102,241,0.35)',
                  }
                : {
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'inherit',
                  }
            }
          >
            All
          </button>

          {subjects.slice(0, 8).map(({ subject, count }) => (
            <button
              key={subject}
              onClick={() => setFilter('subject', activeSubject === subject ? '' : subject)}
              className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
              style={
                activeSubject === subject
                  ? {
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      color: 'white',
                      boxShadow: '0 2px 10px rgba(99,102,241,0.35)',
                    }
                  : {
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'inherit',
                    }
              }
            >
              {subject} <span className="opacity-60 ml-1">({count})</span>
            </button>
          ))}

          {/* Month filter */}
          <input
            type="month"
            value={activeMonth}
            onChange={(e) => setFilter('month', e.target.value)}
            className="text-xs px-3 py-1.5 rounded-full font-semibold cursor-pointer"
            style={
              activeMonth
                ? { background: 'linear-gradient(135deg, #10b981, #0ea5e9)', color: 'white', border: 'none' }
                : {
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'inherit',
                  }
            }
            title="Filter by month"
          />

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold text-muted-foreground hover:text-foreground transition-all"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171',
          }}
        >
          {error}
        </div>
      )}

      {/* ── Notes timeline ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-24 space-y-4">
          <p className="text-5xl">{hasActiveFilters ? '🔍' : '📓'}</p>
          <p className="text-lg font-semibold">
            {hasActiveFilters ? 'No notes match your filters' : 'No notes yet'}
          </p>
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters ? 'Try adjusting your filters' : 'Start by creating your first note'}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={clearFilters}
              className="mx-auto flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'inherit',
              }}
            >
              <X className="h-4 w-4" /> Clear filters
            </button>
          ) : (
            <Link
              href="/dashboard/notes/new"
              className="mx-auto flex items-center gap-2 w-fit px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
              }}
            >
              <Plus className="h-4 w-4" /> Create your first note
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {sortedDateKeys.map((dateKey) => (
            <section key={dateKey}>
              {/* Date heading */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
                    {formatTimelineHeading(dateKey)}
                  </h3>
                </div>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <span className="text-xs text-muted-foreground">
                  {grouped[dateKey].length} note{grouped[dateKey].length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Notes grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {grouped[dateKey].map((note) => (
                  <NoteTimelineCard key={note.id} note={note} />
                ))}
              </div>
            </section>
          ))}

          {/* Load more */}
          {meta?.hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => fetchNotes((meta.page || 1) + 1, true)}
                disabled={isLoadingMore}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  color: 'inherit',
                }}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </>
                ) : (
                  `Load more notes (${meta.total - notes.length} remaining)`
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
