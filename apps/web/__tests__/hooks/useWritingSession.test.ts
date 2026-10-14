import { renderHook, act } from '@testing-library/react'
import { useWritingSession } from '@/hooks/useWritingSession'

describe('useWritingSession', () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-10-14T12:00:00Z'))
    fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    global.fetch = fetchMock as unknown as typeof fetch
    jest.spyOn(document, 'hasFocus').mockReturnValue(true)
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    document.body.innerHTML = ''
  })

  function typeInto(el: HTMLElement, times: number, everyMs: number) {
    for (let i = 0; i < times; i++) {
      act(() => { jest.advanceTimersByTime(everyMs) })
      el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  it('tracks typing and posts a snapshot for the note', () => {
    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    const { result } = renderHook(() =>
      useWritingSession({ enabled: true, noteId: 'note1', kind: 'create', words: 0 }),
    )

    typeInto(ta, 10, 1000)
    act(() => { jest.advanceTimersByTime(1000) })

    const s = result.current.stats!
    expect(s.inputEvents).toBe(10)
    expect(s.typingSpanMs).toBe(9000)
    // Short quiet stretches next to typing (<= 20s) count as writing too.
    expect(s.writeMs).toBe(11_000)
    expect(s.focusMs).toBe(11_000)

    act(() => { result.current.flush() })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/notes/note1/writing-sessions')
    const body = JSON.parse(init.body)
    expect(body.kind).toBe('create')
    expect(body.inputEvents).toBe(10)
    expect(body.firstInputAt).toBe('2026-10-14T12:00:01.000Z')
  })

  it('ignores input events from non-text controls', () => {
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    document.body.appendChild(cb)
    const { result } = renderHook(() =>
      useWritingSession({ enabled: true, noteId: 'n', kind: 'edit', words: 0 }),
    )
    act(() => { cb.dispatchEvent(new Event('input', { bubbles: true })) })
    act(() => { jest.advanceTimersByTime(1000) })
    expect(result.current.stats!.inputEvents).toBe(0)
  })

  it('does not post before the note exists, and sends once it does', () => {
    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    const { rerender } = renderHook(
      ({ id }: { id: string | null }) => useWritingSession({ enabled: true, noteId: id, kind: 'create', words: 0 }),
      { initialProps: { id: null as string | null } },
    )
    typeInto(ta, 3, 500)
    act(() => { jest.advanceTimersByTime(31_000) })
    expect(fetchMock).not.toHaveBeenCalled()
    rerender({ id: 'created' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/notes/created/writing-sessions')
  })

  it('sends a final snapshot when the session ends', () => {
    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    const { rerender, result } = renderHook(
      ({ on }: { on: boolean }) => useWritingSession({ enabled: on, noteId: 'n', kind: 'edit', words: 0 }),
      { initialProps: { on: true } },
    )
    typeInto(ta, 2, 1000)
    rerender({ on: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.stats).toBeNull()
  })

  it('asks about a long trip away and records the answer', () => {
    const { result } = renderHook(() =>
      useWritingSession({ enabled: true, noteId: 'n', kind: 'edit', words: 0 }),
    )
    const hasFocus = document.hasFocus as jest.Mock
    act(() => { hasFocus.mockReturnValue(false); window.dispatchEvent(new Event('blur')) })
    act(() => { jest.advanceTimersByTime(3 * 60_000) })
    act(() => { hasFocus.mockReturnValue(true); window.dispatchEvent(new Event('focus')) })
    expect(result.current.stats!.pendingAway?.durationMs).toBe(3 * 60_000)
    act(() => { result.current.resolveAway('reference') })
    expect(result.current.stats!.pendingAway).toBeNull()
    expect(result.current.stats!.referenceMs).toBe(3 * 60_000)
  })

  it('announces a completed focus block', () => {
    const { result } = renderHook(() =>
      useWritingSession({ enabled: true, noteId: 'n', kind: 'edit', words: 0 }),
    )
    act(() => { result.current.startBlock(60_000) })
    expect(result.current.stats!.block?.remainingMs).toBe(60_000)
    act(() => { jest.advanceTimersByTime(61_000) })
    expect(result.current.completedBlock).toEqual({ durationMs: 60_000, focusMs: 59_000 })
    expect(result.current.stats!.blocksCompleted).toBe(1)
    // The block counts as worth saving even without typing.
    expect(fetchMock).toHaveBeenCalled()
  })

  it('sends the check-in with the snapshot', () => {
    const { result } = renderHook(() =>
      useWritingSession({ enabled: true, noteId: 'n', kind: 'edit', words: 0 }),
    )
    act(() => { result.current.submitCheckIn({ selfRating: 4, distractions: ['Phone'] }) })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.selfRating).toBe(4)
    expect(body.distractions).toEqual(['Phone'])
    expect(body.block).toBeUndefined()
    expect(body.pendingAway).toBeUndefined()
    expect(body.unansweredAways).toBeUndefined()
  })

  it('applies away answers from the check-in before sending', () => {
    const { result } = renderHook(() =>
      useWritingSession({ enabled: true, noteId: 'n', kind: 'edit', words: 0 }),
    )
    const hasFocus = document.hasFocus as jest.Mock
    act(() => { hasFocus.mockReturnValue(false); window.dispatchEvent(new Event('blur')) })
    act(() => { jest.advanceTimersByTime(5 * 60_000) })
    act(() => { hasFocus.mockReturnValue(true); window.dispatchEvent(new Event('focus')) })
    const trip = result.current.stats!.unansweredAways[0]
    act(() => { result.current.submitCheckIn({ selfRating: 3, distractions: [], awayAnswers: [{ startedAt: trip.startedAt, label: 'reference' }] }) })
    const body = JSON.parse(fetchMock.mock.calls.at(-1)[1].body)
    expect(body.referenceMs).toBe(5 * 60_000)
    expect(body.timeline.some((e: [number, number, string]) => e[2] === 'a')).toBe(false)
  })

  it('skips sessions with no activity at all', () => {
    const { unmount } = renderHook(() =>
      useWritingSession({ enabled: true, noteId: 'n', kind: 'edit', words: 0 }),
    )
    act(() => { jest.advanceTimersByTime(60_000) })
    unmount()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
