'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Search, Sparkles, X } from 'lucide-react'
import { useNotes } from '@/hooks/useNotes'
import { NoteCard } from './NoteCard'
import type { Note } from '@/hooks/useNotes'

interface NotesListProps {
  onNewNote?: () => void
  onEditNote?: (note: Note) => void
}

export function NotesList({ onNewNote, onEditNote }: NotesListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'semantic' | 'keyword' | null>(null)
  const [activeSubject, setActiveSubject] = useState<string | null>(null)
  const [subjects, setSubjects] = useState<string[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notes = useNotes()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    notes.getNotes(0)
    fetch('/api/notes?limit=100&offset=0')
      .then((r) => r.json())
      .then(({ data }) => {
        if (Array.isArray(data)) {
          const seen = new Set<string>()
          ;(data as { subject?: string | null }[]).forEach((n) => { if (n.subject) seen.add(n.subject) })
          setSubjects(Array.from(seen).sort())
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!searchQuery.trim()) {
      setSearchMode(null)
      debounceRef.current = setTimeout(() => notes.getNotes(0), 200)
      return
    }
    if (searchQuery.trim().length < 2) return

    debounceRef.current = setTimeout(async () => {
      const params = new URLSearchParams({ q: searchQuery.trim(), limit: '20', offset: '0' })
      const res = await fetch(`/api/notes/search?${params}`)
      if (!res.ok) return
      const json = await res.json()
      if (json.success) {
        setSearchMode(json.meta?.searchType === 'semantic' ? 'semantic' : 'keyword')
        notes.searchNotes(searchQuery.trim(), 0)
      }
    }, 400)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  const clearSearch = () => {
    setSearchQuery('')
    setSearchMode(null)
    notes.getNotes(0, activeSubject ?? undefined)
  }

  const selectSubject = (subject: string | null) => {
    setActiveSubject(subject)
    setSearchQuery('')
    setSearchMode(null)
    notes.getNotes(0, subject ?? undefined)
  }

  const handleDeleteNote = async (noteId: string) => {
    if (confirm('Delete this note?')) await notes.deleteNote(noteId).catch(() => {})
  }

  const handleToggleBookmark = async (noteId: string) => {
    await notes.toggleBookmark(noteId).catch(() => {})
  }

  const isSearching = searchQuery.trim().length >= 2

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">My Notes</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isSearching
              ? `${notes.total} result${notes.total !== 1 ? 's' : ''} found`
              : `${notes.total} note${notes.total !== 1 ? 's' : ''} total · click any note to open the rich editor`}
          </p>
        </div>
        <button
          onClick={onNewNote}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 shrink-0"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
          }}
        >
          <Plus className="h-4 w-4" />
          New Note
        </button>
      </div>

      {/* ── Search bar ── */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search notes — AI semantic search enabled…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'inherit',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search mode badge */}
        {isSearching && searchMode && (
          <div className="flex items-center gap-2 text-xs">
            {searchMode === 'semantic' ? (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold"
                style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}
              >
                <Sparkles className="w-3 h-3" /> Semantic AI search
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'inherit' }}
              >
                <Search className="w-3 h-3" /> Keyword search
              </span>
            )}
            <span className="text-muted-foreground">{notes.total} result{notes.total !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;</span>
          </div>
        )}
      </div>

      {/* ── Subject filter chips ── */}
      {subjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => selectSubject(null)}
            className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
            style={
              activeSubject === null
                ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', boxShadow: '0 2px 10px rgba(99,102,241,0.35)' }
                : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'inherit' }
            }
          >
            All
          </button>
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => selectSubject(s)}
              className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
              style={
                activeSubject === s
                  ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', boxShadow: '0 2px 10px rgba(99,102,241,0.35)' }
                  : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'inherit' }
              }
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Error ── */}
      {notes.error && (
        <div className="rounded-xl p-4 text-sm text-destructive"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {notes.error}
        </div>
      )}

      {/* ── Notes grid / empty states ── */}
      {notes.isLoading && notes.notes.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : notes.notes.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-5xl">{isSearching ? '🔍' : '📝'}</p>
          <p className="text-muted-foreground font-medium">
            {isSearching ? `No notes found for "${searchQuery}"` : 'No notes yet — create your first one!'}
          </p>
          {isSearching ? (
            <button
              onClick={clearSearch}
              className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'inherit' }}
            >
              <X className="h-4 w-4" /> Clear search
            </button>
          ) : (
            <button
              onClick={onNewNote}
              className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}
            >
              <Plus className="h-4 w-4" /> Create Note
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {notes.notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={(n) => onEditNote?.(n)}
                onDelete={handleDeleteNote}
                onToggleBookmark={handleToggleBookmark}
              />
            ))}
          </div>

          {notes.hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => notes.loadMore()}
                disabled={notes.isLoading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'inherit' }}
              >
                {notes.isLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Loading…</>
                  : 'Load more notes'
                }
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
