import { renderHook, act } from '@testing-library/react'
import { useReflectionSummary, SUMMARY_DEBOUNCE_MS } from '@/hooks/useReflectionSummary'
import { progressFingerprint } from '@/lib/reflection-summary'

const s14 = (a: string, b: string, c: string) =>
  `<h2>14. Progress Summary</h2><ul><li><p><strong>What I worked on (and for how long):</strong> ${a}</p></li><li><p><strong>What was tricky &amp; how I improved:</strong> ${b}</p></li><li><p><strong>Plan for tomorrow:</strong> ${c}</p></li></ul>`

const EMPTY = s14('', '', '')
const DONE = s14('AMC geometry 40 min', 'Shaded areas, drew diagrams', 'Problems 7 to 10')

const stored = (html: string) => ({
  headline: 'Geometry clicked', quickSummary: 'You worked on geometry today.', wins: [], stillWorkingOn: [],
  tomorrow: ['Problems 7 to 10'], tip: '', parentNote: '', generatedAt: '2026-10-14T21:00:00Z',
  fingerprint: progressFingerprint(html), focusMinutes: 12,
})

function mockFetch(initial: unknown) {
  return jest.fn(async (_url: string, init?: RequestInit) => {
    if (!init || init.method !== 'POST') return { ok: true, json: async () => ({ data: initial }) }
    const body = JSON.parse(String(init.body))
    return { ok: true, json: async () => ({ data: stored(body.html) }) }
  })
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

describe('useReflectionSummary', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('generates once section 14 is finished, after a pause, and pops up', async () => {
    const fetchMock = mockFetch(null)
    global.fetch = fetchMock as unknown as typeof fetch
    const { result, rerender } = renderHook(({ html }) => useReflectionSummary({ noteId: 'n1', html, auto: true, getFocusMs: () => 12 * 60_000 }), { initialProps: { html: EMPTY } })
    await flush()
    rerender({ html: DONE })
    act(() => { jest.advanceTimersByTime(SUMMARY_DEBOUNCE_MS - 100) })
    expect(fetchMock).toHaveBeenCalledTimes(1) // only the GET so far
    await act(async () => { jest.advanceTimersByTime(200) })
    await flush()
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(String(post[1]!.body)).focusMs).toBe(12 * 60_000)
    expect(result.current.summary?.headline).toBe('Geometry clicked')
    expect(result.current.popup?.headline).toBe('Geometry clicked')
    expect(result.current.outdated).toBe(false)
  })

  it('still summarizes when the first save (note id) lands after section 14 is done', async () => {
    const fetchMock = mockFetch(null)
    global.fetch = fetchMock as unknown as typeof fetch
    const { result, rerender } = renderHook(
      ({ html, id }) => useReflectionSummary({ noteId: id, html, auto: true }),
      { initialProps: { html: '', id: null as string | null } },
    )
    rerender({ html: DONE, id: null })
    rerender({ html: DONE, id: 'n1' })
    await flush()
    await act(async () => { jest.advanceTimersByTime(SUMMARY_DEBOUNCE_MS + 100) })
    await flush()
    expect(result.current.popup?.headline).toBe('Geometry clicked')
  })

  it('waits while he is still typing', async () => {
    const fetchMock = mockFetch(null)
    global.fetch = fetchMock as unknown as typeof fetch
    const { rerender } = renderHook(({ html }) => useReflectionSummary({ noteId: 'n1', html, auto: true }), { initialProps: { html: EMPTY } })
    await flush()
    rerender({ html: s14('AMC geometry', 'Shaded areas', 'Probl') })
    act(() => { jest.advanceTimersByTime(3000) })
    rerender({ html: DONE })
    act(() => { jest.advanceTimersByTime(3000) })
    expect(fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(0)
    await act(async () => { jest.advanceTimersByTime(SUMMARY_DEBOUNCE_MS) })
    expect(fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(1)
  })

  it('does not regenerate when the stored summary already matches', async () => {
    const fetchMock = mockFetch(stored(DONE))
    global.fetch = fetchMock as unknown as typeof fetch
    const { result } = renderHook(() => useReflectionSummary({ noteId: 'n1', html: DONE, auto: true }))
    await flush()
    await act(async () => { jest.advanceTimersByTime(SUMMARY_DEBOUNCE_MS * 2) })
    expect(fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(0)
    expect(result.current.summary?.headline).toBe('Geometry clicked')
    expect(result.current.popup).toBeNull()
  })

  it('opening an old finished note without a summary does not auto-run', async () => {
    const fetchMock = mockFetch(null)
    global.fetch = fetchMock as unknown as typeof fetch
    const { result } = renderHook(() => useReflectionSummary({ noteId: 'n1', html: DONE, auto: true }))
    await flush()
    await act(async () => { jest.advanceTimersByTime(SUMMARY_DEBOUNCE_MS * 2) })
    expect(fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(0)
    expect(result.current.complete).toBe(true) // the card offers "Summarize now"
  })

  it('never auto-runs in read-only mode', async () => {
    const fetchMock = mockFetch(null)
    global.fetch = fetchMock as unknown as typeof fetch
    const { rerender } = renderHook(({ html }) => useReflectionSummary({ noteId: 'n1', html, auto: false }), { initialProps: { html: EMPTY } })
    await flush()
    rerender({ html: DONE })
    await act(async () => { jest.advanceTimersByTime(SUMMARY_DEBOUNCE_MS * 2) })
    expect(fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(0)
  })
})
