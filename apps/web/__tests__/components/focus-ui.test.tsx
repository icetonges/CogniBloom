import { render, screen, fireEvent } from '@testing-library/react'
import { createWritingTracker } from '@/lib/writing-session'
import { WritingTimer } from '@/components/notes/WritingTimer'
import { FocusToasts } from '@/components/notes/FocusToasts'
import { FocusCheckIn } from '@/components/notes/FocusCheckIn'

const MIN = 60_000

function sampleStats() {
  const t = createWritingTracker({ id: 'abc12345', kind: 'create', startedAt: 0 })
  for (let ms = 0; ms <= 3 * MIN; ms += 5000) t.input(ms)
  t.setWords(0)
  t.setForeground(false, 4 * MIN)
  t.setForeground(true, 7 * MIN)
  return t
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: null }) }) as unknown as typeof fetch
})

describe('focus UI', () => {
  it('timer chip shows focus time and starts a block', () => {
    const onStart = jest.fn()
    render(<WritingTimer stats={sampleStats().snapshot(8 * MIN)} onStartBlock={onStart} onCancelBlock={jest.fn()} />)
    expect(screen.getByText(/focus$/)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/focus$/))
    expect(screen.getByText('This session')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Start a 20-minute focus block/))
    expect(onStart).toHaveBeenCalledWith(20 * MIN)
  })

  it('timer chip shows the countdown during a block', () => {
    const t = sampleStats()
    t.startBlock(7 * MIN, 20 * MIN)
    render(<WritingTimer stats={t.snapshot(8 * MIN)} onStartBlock={jest.fn()} onCancelBlock={jest.fn()} />)
    expect(screen.getByText('19:00 left')).toBeInTheDocument()
  })

  it('welcome-back prompt resolves a trip away', () => {
    const onResolve = jest.fn()
    render(<FocusToasts stats={sampleStats().snapshot(7 * MIN)} completedBlock={null} onResolveAway={onResolve} onDismissBlock={jest.fn()} />)
    expect(screen.getByText(/You were away/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Yes, reference'))
    expect(onResolve).toHaveBeenCalledWith('reference', 4 * MIN)
  })

  it('check-in requires a rating, then reveals the measured focus', () => {
    const onSubmit = jest.fn()
    const t = sampleStats()
    t.resolveAway('reference')
    render(<FocusCheckIn stats={t.snapshot(8 * MIN)} onSubmit={onSubmit} onSkip={jest.fn()} />)
    const done = screen.getByText('Done').closest('button')!
    expect(done).toBeDisabled()
    expect(screen.queryByText(/The timer counted/)).toBeNull()
    fireEvent.click(screen.getByText('4'))
    expect(screen.getByText(/The timer counted/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Phone'))
    fireEvent.click(done)
    expect(onSubmit).toHaveBeenCalledWith({ selfRating: 4, distractions: ['Phone'], awayAnswers: [] })
  })

  it('check-in asks about every unanswered trip and updates the focus number', () => {
    const onSubmit = jest.fn()
    const t = createWritingTracker({ id: 'abc12345', kind: 'create', startedAt: 0 })
    for (let ms = 0; ms <= 3 * MIN; ms += 5000) t.input(ms)
    t.setForeground(false, 4 * MIN); t.setForeground(true, 26 * MIN)   // 22 min away
    t.setForeground(false, 27 * MIN); t.setForeground(true, 30 * MIN)  // 3 min away
    render(<FocusCheckIn stats={t.snapshot(31 * MIN)} onSubmit={onSubmit} onSkip={jest.fn()} />)
    expect(screen.getByText(/You left the page 2 times/)).toBeInTheDocument()
    const before = screen.getByText(/focus$/).parentElement!.textContent
    fireEvent.click(screen.getAllByRole('button', { name: /Reference/ })[0])
    const after = screen.getByText(/focus$/).parentElement!.textContent
    expect(before).toBe('6m focus')
    expect(after).toBe('26m focus') // + 20 min, the reference cap for the 22-min trip
    fireEvent.click(screen.getAllByRole('button', { name: /^Break$/ })[1])
    fireEvent.click(screen.getByText('Skip'))
    expect(onSubmit).toHaveBeenCalledWith({
      selfRating: null,
      distractions: [],
      awayAnswers: [{ startedAt: 4 * MIN, label: 'reference' }, { startedAt: 27 * MIN, label: 'break' }],
    })
  })

  it('welcome-back prompt counts the earlier trips still to answer', () => {
    const t = createWritingTracker({ id: 'abc12345', kind: 'create', startedAt: 0 })
    t.setForeground(false, MIN); t.setForeground(true, 5 * MIN)
    t.setForeground(false, 6 * MIN); t.setForeground(true, 9 * MIN)
    const onResolve = jest.fn()
    render(<FocusToasts stats={t.snapshot(9 * MIN)} completedBlock={null} onResolveAway={onResolve} onDismissBlock={jest.fn()} />)
    expect(screen.getByText(/1 earlier trip away still to answer/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Took a break'))
    expect(onResolve).toHaveBeenCalledWith('break', 6 * MIN)
  })

  it('"Nothing" clears the other distractions', () => {
    const onSubmit = jest.fn()
    render(<FocusCheckIn stats={sampleStats().snapshot(8 * MIN)} onSubmit={onSubmit} onSkip={jest.fn()} />)
    fireEvent.click(screen.getByText('3'))
    fireEvent.click(screen.getByText('Phone'))
    fireEvent.click(screen.getByText('Nothing'))
    fireEvent.click(screen.getByText('Done').closest('button')!)
    expect(onSubmit).toHaveBeenCalledWith({ selfRating: 3, distractions: ['Nothing'], awayAnswers: [] })
  })
})
