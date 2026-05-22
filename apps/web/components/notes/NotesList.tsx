'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Plus, Search } from 'lucide-react'
import { useNotes } from '@/hooks/useNotes'
import { NoteCard } from './NoteCard'
import type { Note } from '@/hooks/useNotes'

interface NotesListProps {
  onNewNote?: () => void
  onEditNote?: (note: Note) => void
}

export function NotesList({ onNewNote, onEditNote }: NotesListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const notes = useNotes()

  // Load notes on mount
  useEffect(() => {
    notes.getNotes(0)
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      await notes.searchNotes(searchQuery, 0)
    } else {
      await notes.getNotes(0)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (confirm('Are you sure you want to delete this note?')) {
      try {
        await notes.deleteNote(noteId)
      } catch (error) {
        console.error('Failed to delete note:', error)
      }
    }
  }

  const handleToggleBookmark = async (noteId: string) => {
    try {
      await notes.toggleBookmark(noteId)
    } catch (error) {
      console.error('Failed to toggle bookmark:', error)
    }
  }

  const handleEditNote = (note: Note) => {
    onEditNote?.(note)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Notes</h2>
          <p className="text-sm text-muted-foreground">
            {notes.total} note{notes.total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={onNewNote}>
          <Plus className="h-4 w-4 mr-2" />
          New Note
        </Button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
        {searchQuery && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearchQuery('')
              notes.getNotes(0)
            }}
          >
            Clear
          </Button>
        )}
      </form>

      {/* Error Display */}
      {notes.error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          {notes.error}
        </div>
      )}

      {/* Loading State */}
      {notes.isLoading && notes.notes.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : notes.notes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? 'No notes found matching your search'
              : 'No notes yet. Create your first note!'}
          </p>
          {!searchQuery && (
            <Button onClick={onNewNote}>
              <Plus className="h-4 w-4 mr-2" />
              Create Note
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Notes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {notes.notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={handleEditNote}
                onDelete={handleDeleteNote}
                onToggleBookmark={handleToggleBookmark}
              />
            ))}
          </div>

          {/* Load More */}
          {notes.hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => notes.loadMore()}
                disabled={notes.isLoading}
              >
                {notes.isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
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
