/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'
import { useNotes } from '@/hooks/useNotes'

// ─── Fetch mock helpers ───────────────────────────────────────────────────────

function mockFetch(response: unknown, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
  })
}

function mockFetchFail(message = 'Network error') {
  global.fetch = jest.fn().mockRejectedValue(new Error(message))
}

const makeNote = (overrides: Partial<ReturnType<typeof buildNote>> = {}) =>
  buildNote(overrides)

function buildNote(overrides: Record<string, unknown> = {}) {
  return {
    id: 'note-1',
    title: 'Test Note',
    content: 'Some content',
    tags: [],
    subject: null,
    isBookmarked: false,
    hasMath: false,
    hasCode: false,
    hasImages: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ─── Initial state ────────────────────────────────────────────────────────────

describe('useNotes — initial state', () => {
  it('starts with empty notes and no loading', () => {
    const { result } = renderHook(() => useNotes())
    expect(result.current.notes).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.total).toBe(0)
    expect(result.current.hasMore).toBe(false)
  })
})

// ─── getNotes ─────────────────────────────────────────────────────────────────

describe('useNotes.getNotes', () => {
  it('fetches notes and updates state', async () => {
    const note = makeNote()
    mockFetch({ data: [note], meta: { total: 1 } })

    const { result } = renderHook(() => useNotes())

    await act(async () => {
      await result.current.getNotes(0)
    })

    expect(result.current.notes).toHaveLength(1)
    expect(result.current.notes[0].id).toBe('note-1')
    expect(result.current.total).toBe(1)
    expect(result.current.isLoading).toBe(false)
  })

  it('sets hasMore correctly when total exceeds limit', async () => {
    const notes = Array.from({ length: 20 }, (_, i) => makeNote({ id: `note-${i}` }))
    mockFetch({ data: notes, meta: { total: 50 } })

    const { result } = renderHook(() => useNotes({ limit: 20 }))

    await act(async () => { await result.current.getNotes(0) })

    expect(result.current.hasMore).toBe(true)
  })

  it('sets hasMore false when no more pages', async () => {
    mockFetch({ data: [makeNote()], meta: { total: 1 } })

    const { result } = renderHook(() => useNotes({ limit: 20 }))

    await act(async () => { await result.current.getNotes(0) })

    expect(result.current.hasMore).toBe(false)
  })

  it('sets error state on network failure', async () => {
    mockFetchFail('Connection failed')

    const { result } = renderHook(() => useNotes())

    await act(async () => {
      try { await result.current.getNotes(0) } catch { /* expected */ }
    })

    expect(result.current.error).toBe('Connection failed')
    expect(result.current.isLoading).toBe(false)
  })

  it('sets error on non-ok response', async () => {
    mockFetch({ error: 'Unauthorized' }, 401)

    const { result } = renderHook(() => useNotes())

    await act(async () => {
      try { await result.current.getNotes(0) } catch { /* expected */ }
    })

    expect(result.current.error).toBeTruthy()
  })

  it('appends subject param when provided', async () => {
    mockFetch({ data: [], meta: { total: 0 } })

    const { result } = renderHook(() => useNotes())

    await act(async () => { await result.current.getNotes(0, 'Math') })

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('subject=Math')
  })
})

// ─── createNote ───────────────────────────────────────────────────────────────

describe('useNotes.createNote', () => {
  it('adds new note to the front of the list', async () => {
    const existing = makeNote({ id: 'old', title: 'Old Note' })
    const newNote = makeNote({ id: 'new', title: 'New Note' })

    // First get notes
    mockFetch({ data: [existing], meta: { total: 1 } })
    const { result } = renderHook(() => useNotes())
    await act(async () => { await result.current.getNotes(0) })

    // Then create
    mockFetch({ data: newNote })
    await act(async () => {
      await result.current.createNote({ title: 'New Note', content: 'Content' })
    })

    expect(result.current.notes[0].id).toBe('new')
    expect(result.current.notes[1].id).toBe('old')
  })

  it('throws and sets error on failure', async () => {
    mockFetch({ error: 'Failed to create note' }, 500)

    const { result } = renderHook(() => useNotes())

    await act(async () => {
      await expect(
        result.current.createNote({ title: 'T', content: 'C' })
      ).rejects.toThrow()
    })

    expect(result.current.error).toBeTruthy()
  })
})

// ─── updateNote ───────────────────────────────────────────────────────────────

describe('useNotes.updateNote', () => {
  it('replaces updated note in list', async () => {
    const original = makeNote({ title: 'Original' })
    const updated = makeNote({ title: 'Updated' })

    mockFetch({ data: [original], meta: { total: 1 } })
    const { result } = renderHook(() => useNotes())
    await act(async () => { await result.current.getNotes(0) })

    mockFetch({ data: updated })
    await act(async () => {
      await result.current.updateNote('note-1', { title: 'Updated' })
    })

    expect(result.current.notes[0].title).toBe('Updated')
  })
})

// ─── deleteNote ───────────────────────────────────────────────────────────────

describe('useNotes.deleteNote', () => {
  it('removes deleted note from list', async () => {
    const note = makeNote({ id: 'del-1' })
    mockFetch({ data: [note], meta: { total: 1 } })

    const { result } = renderHook(() => useNotes())
    await act(async () => { await result.current.getNotes(0) })

    mockFetch({ success: true }, 200)
    await act(async () => { await result.current.deleteNote('del-1') })

    expect(result.current.notes).toHaveLength(0)
  })
})

// ─── searchNotes ──────────────────────────────────────────────────────────────

describe('useNotes.searchNotes', () => {
  it('updates notes with search results', async () => {
    const result1 = makeNote({ id: 'r1', title: 'Algebra Result' })
    mockFetch({ data: [result1], meta: { total: 1 } })

    const { result } = renderHook(() => useNotes())

    await act(async () => { await result.current.searchNotes('algebra', 0) })

    expect(result.current.notes[0].title).toBe('Algebra Result')
  })

  it('sets error when query is too short', async () => {
    const { result } = renderHook(() => useNotes())

    await act(async () => { await result.current.searchNotes('a') })

    expect(result.current.error).toMatch(/at least 2/i)
  })
})

// ─── toggleBookmark ───────────────────────────────────────────────────────────

describe('useNotes.toggleBookmark', () => {
  it('flips isBookmarked on a note', async () => {
    const note = makeNote({ isBookmarked: false })
    const bookmarked = makeNote({ isBookmarked: true })

    mockFetch({ data: [note], meta: { total: 1 } })
    const { result } = renderHook(() => useNotes())
    await act(async () => { await result.current.getNotes(0) })

    mockFetch({ data: bookmarked })
    await act(async () => { await result.current.toggleBookmark('note-1') })

    expect(result.current.notes[0].isBookmarked).toBe(true)
  })

  it('does nothing when note ID is not found', async () => {
    mockFetch({ data: [], meta: { total: 0 } })
    const { result } = renderHook(() => useNotes())
    await act(async () => { await result.current.getNotes(0) })

    // Should not throw or call fetch
    const fetchCallsBefore = (global.fetch as jest.Mock).mock.calls.length
    await act(async () => { await result.current.toggleBookmark('nonexistent') })
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCallsBefore)
  })
})

// ─── loadMore ─────────────────────────────────────────────────────────────────

describe('useNotes.loadMore', () => {
  it('fetches next page with correct offset', async () => {
    const firstPage = Array.from({ length: 20 }, (_, i) => makeNote({ id: `p1-${i}` }))
    mockFetch({ data: firstPage, meta: { total: 40 } })

    const { result } = renderHook(() => useNotes({ limit: 20 }))
    await act(async () => { await result.current.getNotes(0) })

    const secondPage = Array.from({ length: 20 }, (_, i) => makeNote({ id: `p2-${i}` }))
    mockFetch({ data: secondPage, meta: { total: 40 } })

    await act(async () => { await result.current.loadMore() })

    const url = (global.fetch as jest.Mock).mock.calls.at(-1)[0] as string
    expect(url).toContain('offset=20')
  })
})
