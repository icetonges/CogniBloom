'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

  // Load notes on mount; also fetch distinct subjects for filter chips
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    notes.getNotes(0)
    // Fetch a larger page to collect all subjects seen
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

  // Debounced live search — 400 ms after typing stops
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
        // Directly update through the hook's internal state via search
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
    if (confirm('Are you sure you want to delete this note?')) {
      await notes.deleteNote(noteId).catch(() => {})
    }
  }

  const handleToggleBookmark = async (noteId: string) => {
    await notes.toggleBookmark(noteId).catch(() => {})
  }

  const isSearching = searchQuery.trim().length >= 2

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Notes</h2>
          <p className="text-sm text-muted-foreground">
            {isSearching
              ? `${notes.total} result${notes.total !== 1 ? 's' : ''}`
              : `${notes.total} note${notes.total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={onNewNote}>
          <Plus className="h-4 w-4 mr-2" />
          New Note
        </Button>
      </div>

      {/* Subject filter chips */}
      {subjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => selectSubject(null)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activeSubject === null
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            All
          </button>
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => selectSubject(s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activeSubject === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Search bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search notes — AI semantic search enabled…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search mode badge */}
        {isSearching && searchMode && (
          <div className="flex items-center gap-2 text-xs">
            {searchMode === 'semantic' ? (
              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                <Sparkles className="w-3 h-3" /> Semantic AI search
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                <Search className="w-3 h-3" /> Keyword search
              </span>
            )}
            <span className="text-muted-foreground">{notes.total} result{notes.total !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;</span>
          </div>
        )}
      </div>

      {/* Error */}
      {notes.error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          {notes.error}
        </div>
      )}

      {/* Loading */}
      {notes.isLoading && notes.notes.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : notes.notes.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-muted-foreground">
            {isSearching ? `No notes found for "${searchQuery}"` : 'No notes yet — create your first one!'}
          </p>
          {isSearching ? (
            <Button variant="outline" onClick={clearSearch}>
              <X className="h-4 w-4 mr-2" /> Clear search
            </Button>
          ) : (
            <Button onClick={onNewNote}>
              <Plus className="h-4 w-4 mr-2" /> Create Note
            </Button>
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
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => notes.loadMore()}
                disabled={notes.isLoading}
              >
                {notes.isLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
