'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Search, X, Loader2, Calendar, ArrowUpDown,
  Clock, BookOpen, Brain, Tag as TagIcon,
} from 'lucide-react'
import { formatNoteTitle, formatTimelineHeading, getDateGroupKey } from '@/lib/note-format'
import { cn } from '@/lib/utils'
import type { Note } from '@/hooks/useNotes'

type SortOption = 'newest' | 'oldest' | 'updated' | 'subject'

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  updated: 'Recently updated',
  subject: 'Subject A–Z',
}

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
  const plainText = note.content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  const preview = plainText.slice(0, 130)
  const wordCount = plainText.split(/\s+/).filter(Boolean).length
  const readMins = Math.max(1, Math.ceil(wordCount / 200))
  const displayTitle = formatNoteTitle(note)
  const color = subjectColor(note.subject)
  const hasAI = !!(note.aiAnalyzedAt || note.mindMap || note.tutorSummary)

  return (
    <Link
      href={`/dashboard/notes/${note.slug || note.id}`}
      className="group block rounded-2xl transition-all duration-200 hover:scale-[1.01] hover:-translate-y-0.5 overflow-hidden"
      style={{
        background: color.bg,
        border: `1px solid ${color.border}`,
        boxShadow: `0 4px 20px ${color.from}10`,
      }}
    >
      {/* Color accent stripe */}
      <div
        className="h-0.5 w-full"
        style={{ background: `linear-gradient(90deg, ${color.from}, ${color.to})` }}
      />

      <div className="p-4">
        {/* Top row: subject + AI badge */}
        <div className="flex items-center gap-2 mb-2">
          {note.subject && (
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md"
              style={{ background: `${color.from}20`, color: color.from }}
            >
              <BookOpen className="w-2.5 h-2.5 inline mr-1" />
              {note.subject}
            </span>
          )}
          <div className="flex-1" />
          {hasAI && (
            <span
              title="AI analyzed"
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <Brain className="w-2.5 h-2.5" /> AI
            </span>
          )}
          {note.hasMath && (
            <span
              title="Contains math"
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
            >
              ∑
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-bold text-sm leading-snug line-clamp-2 mb-2">{displayTitle}</h3>

        {/* Preview */}
        {preview && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {preview}{plainText.length > 130 ? '…' : ''}
          </p>
        )}

        {/* Tags */}
        {note.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-2.5">
            {note.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <TagIcon className="w-2 h-2" />#{tag}
              </span>
            ))}
            {note.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{note.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Footer: time + word count */}
        <div className="flex items-center gap-3 mt-3 pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="w-2.5 h-2.5" />
            {readMins} min read
          </span>
          <span className="text-[10px] text-muted-foreground">{wordCount.toLocaleString()} words</span>
          <div className="flex-1" />
          <span className="text-[10px] text-muted-foreground">
            {new Date(note.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
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
  const [sort, setSort] = useState<SortOption>('newest')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sortMenuRef = useRef<HTMLDivElement>(null)

  // Close sort dropdown on outside click
  useEffect(() => {
    if (!showSortMenu) return
    const handler = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSortMenu])

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

  // Sort notes before grouping
  const sortedNotes = [...notes].sort((a, b) => {
    switch (sort) {
      case 'newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case 'updated': return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      case 'subject': return (a.subject ?? '').localeCompare(b.subject ?? '')
      default: return 0
    }
  })

  const grouped = groupNotesByDate(sortedNotes)
  const sortedDateKeys = sort === 'oldest'
    ? Object.keys(grouped).sort((a, b) => a.localeCompare(b))
    : Object.keys(grouped).sort((a, b) => b.localeCompare(a))

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

          {/* Sort dropdown */}
          <div ref={sortMenuRef} className="relative ml-auto">
            <button
              onClick={() => setShowSortMenu((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold transition-all',
                showSortMenu ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
              style={showSortMenu
                ? { background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }
                : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }
              }
            >
              <ArrowUpDown className="h-3 w-3" />
              {SORT_LABELS[sort]}
            </button>
            {showSortMenu && (
              <div
                className="absolute right-0 top-full mt-1 w-44 rounded-xl overflow-hidden shadow-2xl z-40"
                style={{ background: '#0d1117', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setSort(key); setShowSortMenu(false) }}
                    className={cn(
                      'w-full text-left text-xs px-4 py-2.5 font-semibold transition-colors',
                      sort === key
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
                    )}
                  >
                    {sort === key && <span className="mr-2">✓</span>}
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
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
