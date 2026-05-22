'use client'

import { useCallback, useState } from 'react'

export interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  subject?: string
  isBookmarked: boolean
  hasMath: boolean
  hasCode: boolean
  hasImages: boolean
  createdAt: string
  updatedAt: string
}

export interface NotesState {
  notes: Note[]
  currentNote: Note | null
  isLoading: boolean
  error: string | null
  total: number
  hasMore: boolean
}

export interface CreateNoteInput {
  title: string
  content: string
  tags?: string[]
  subject?: string
}

export interface UpdateNoteInput {
  title?: string
  content?: string
  tags?: string[]
  subject?: string
  isBookmarked?: boolean
}

export interface NotesOptions {
  limit?: number
}

export function useNotes(options: NotesOptions = {}) {
  const limit = options.limit || 20
  const [state, setState] = useState<NotesState>({
    notes: [],
    currentNote: null,
    isLoading: false,
    error: null,
    total: 0,
    hasMore: false,
  })
  const [offset, setOffset] = useState(0)

  // Create a new note
  const createNote = useCallback(
    async (input: CreateNoteInput) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })

        if (!response.ok) {
          throw new Error('Failed to create note')
        }

        const { data } = await response.json()

        setState((prev) => ({
          ...prev,
          notes: [data, ...prev.notes],
          isLoading: false,
        }))

        return data
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error'
        setState((prev) => ({
          ...prev,
          error: message,
          isLoading: false,
        }))
        throw error
      }
    },
    []
  )

  // Get all notes with pagination (optional subject filter)
  const getNotes = useCallback(
    async (newOffset: number = 0, subject?: string) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))
      setOffset(newOffset)

      try {
        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: newOffset.toString(),
        })
        if (subject) params.set('subject', subject)

        const response = await fetch(`/api/notes?${params}`)

        if (!response.ok) {
          throw new Error('Failed to fetch notes')
        }

        const { data, meta } = await response.json()

        setState((prev) => ({
          ...prev,
          notes: data,
          total: meta.total,
          hasMore: newOffset + limit < meta.total,
          isLoading: false,
        }))

        return data
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error'
        setState((prev) => ({
          ...prev,
          error: message,
          isLoading: false,
        }))
        throw error
      }
    },
    [limit]
  )

  // Get a specific note
  const getNote = useCallback(async (noteId: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch(`/api/notes/${noteId}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Note not found')
        }
        throw new Error('Failed to fetch note')
      }

      const { data } = await response.json()

      setState((prev) => ({
        ...prev,
        currentNote: data,
        isLoading: false,
      }))

      return data
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error'
      setState((prev) => ({
        ...prev,
        error: message,
        isLoading: false,
      }))
      throw error
    }
  }, [])

  // Update a note
  const updateNote = useCallback(
    async (noteId: string, input: UpdateNoteInput) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        const response = await fetch(`/api/notes/${noteId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Note not found')
          }
          throw new Error('Failed to update note')
        }

        const { data } = await response.json()

        setState((prev) => ({
          ...prev,
          notes: prev.notes.map((n) => (n.id === noteId ? data : n)),
          currentNote: prev.currentNote?.id === noteId ? data : prev.currentNote,
          isLoading: false,
        }))

        return data
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error'
        setState((prev) => ({
          ...prev,
          error: message,
          isLoading: false,
        }))
        throw error
      }
    },
    []
  )

  // Delete a note
  const deleteNote = useCallback(async (noteId: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Note not found')
        }
        throw new Error('Failed to delete note')
      }

      setState((prev) => ({
        ...prev,
        notes: prev.notes.filter((n) => n.id !== noteId),
        currentNote:
          prev.currentNote?.id === noteId ? null : prev.currentNote,
        isLoading: false,
      }))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error'
      setState((prev) => ({
        ...prev,
        error: message,
        isLoading: false,
      }))
      throw error
    }
  }, [])

  // Search notes
  const searchNotes = useCallback(
    async (query: string, newOffset: number = 0) => {
      if (query.length < 2) {
        setState((prev) => ({
          ...prev,
          error: 'Search query must be at least 2 characters',
        }))
        return
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }))
      setOffset(newOffset)

      try {
        const params = new URLSearchParams({
          q: query,
          limit: limit.toString(),
          offset: newOffset.toString(),
        })

        const response = await fetch(`/api/notes/search?${params}`)

        if (!response.ok) {
          throw new Error('Failed to search notes')
        }

        const { data, meta } = await response.json()

        setState((prev) => ({
          ...prev,
          notes: data,
          total: meta.total,
          hasMore: newOffset + limit < meta.total,
          isLoading: false,
        }))

        return data
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error'
        setState((prev) => ({
          ...prev,
          error: message,
          isLoading: false,
        }))
        throw error
      }
    },
    [limit]
  )

  // Toggle bookmark
  const toggleBookmark = useCallback(
    async (noteId: string) => {
      const note = state.notes.find((n) => n.id === noteId)
      if (!note) return

      return updateNote(noteId, { isBookmarked: !note.isBookmarked })
    },
    [state.notes, updateNote]
  )

  // Load more notes
  const loadMore = useCallback(async () => {
    const newOffset = offset + limit
    return getNotes(newOffset)
  }, [offset, limit, getNotes])

  return {
    ...state,
    offset,
    createNote,
    getNotes,
    getNote,
    updateNote,
    deleteNote,
    searchNotes,
    toggleBookmark,
    loadMore,
  }
}
