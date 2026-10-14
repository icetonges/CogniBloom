import {
  extractProgressAnswers, isProgressComplete, progressFingerprint, reflectionPlainText,
  buildSummaryPrompt, parseSummary,
} from '@/lib/reflection-summary'

// The shape TipTap actually produces for the template (paragraphs inside list items).
const section14 = (a: string, b: string, c: string) => `
<h2>13. Self-Check Quiz (3 Questions)</h2><ol><li><p><strong>Q:</strong> Area of a trapezoid?<br><strong>A:</strong> (b1+b2)h/2</p></li></ol>
<h2>14. Progress Summary</h2>
<blockquote><p>A few sentences as if telling a teacher or parent. <em>e.g. "Today [Name] worked on AMC 8 geometry for 45 min."</em></p></blockquote>
<ul>
<li><p><strong>What I worked on (and for how long):</strong> ${a}</p></li>
<li><p><strong>What was tricky &amp; how I improved:</strong> ${b}</p></li>
<li><p><strong>Plan for tomorrow:</strong> ${c}</p></li>
</ul><p></p>`

describe('section 14 detection', () => {
  it('reads the three labeled answers', () => {
    expect(extractProgressAnswers(section14('AMC 8 geometry, 40 min', 'Shaded areas; drew diagrams', 'Problems 7-10'))).toEqual([
      { label: 'What I worked on (and for how long)', answer: 'AMC 8 geometry, 40 min' },
      { label: 'What was tricky & how I improved', answer: 'Shaded areas; drew diagrams' },
      { label: 'Plan for tomorrow', answer: 'Problems 7-10' },
    ])
  })

  it('is complete only when every line has a real answer', () => {
    expect(isProgressComplete(section14('AMC 8 geometry, 40 min', 'Shaded areas', 'Problems 7-10'))).toBe(true)
    expect(isProgressComplete(section14('AMC 8 geometry, 40 min', 'Shaded areas', ''))).toBe(false)
    expect(isProgressComplete(section14('AMC 8 geometry', '...', 'Review'))).toBe(false)
    expect(isProgressComplete(section14('', '', ''))).toBe(false)
    expect(isProgressComplete('<h2>3. What I Learned Today</h2><ul><li><p>stuff</p></li></ul>')).toBe(false)
  })

  it('fingerprints the answers, ignoring case and spacing', () => {
    const a = progressFingerprint(section14('Geometry 40 min', 'Shaded areas', 'Review 7-10'))
    expect(a).toMatch(/^[0-9a-f]{8}$/)
    expect(progressFingerprint(section14('geometry   40 MIN', 'Shaded areas', 'Review 7-10'))).toBe(a)
    expect(progressFingerprint(section14('Geometry 45 min', 'Shaded areas', 'Review 7-10'))).not.toBe(a)
    expect(progressFingerprint('<p>no section</p>')).toBeNull()
  })
})

describe('reflectionPlainText', () => {
  it('keeps headings and filled lines, drops hints and empty labeled lines', () => {
    const t = reflectionPlainText(section14('Geometry 40 min', 'Shaded areas', ''))
    expect(t).toContain('## 14. Progress Summary')
    expect(t).toContain('- What I worked on (and for how long): Geometry 40 min')
    expect(t).not.toContain('Plan for tomorrow')
    expect(t).not.toContain('A few sentences as if telling')
    expect(t).toContain('Q: Area of a trapezoid? A: (b1+b2)h/2')
  })
})

describe('prompt and parsing', () => {
  it('builds a grounded, grade-aware prompt', () => {
    const p = buildSummaryPrompt({ reflection: '## 3. What I Learned Today\n- Trapezoids', name: 'Daniel', gradeLabel: '7th grade (about age 12-13)', focusMinutes: 32 })
    expect(p).toContain('Daniel, a 7th grade (about age 12-13) student')
    expect(p).toContain('about 32 minutes of focused time')
    expect(p).toMatch(/do not invent/)
    expect(p).toContain('- Trapezoids')
  })

  it('parses JSON with fences and fills defaults', () => {
    const raw = '```json\n{"headline":"Geometry clicked","quickSummary":"You worked on geometry and it clicked."}\n```'
    expect(parseSummary(raw)).toEqual({
      headline: 'Geometry clicked', quickSummary: 'You worked on geometry and it clicked.',
      wins: [], stillWorkingOn: [], tomorrow: [], tip: '', parentNote: '',
    })
  })

  it('rejects malformed replies', () => {
    expect(parseSummary('Sorry, I cannot do that.')).toBeNull()
    expect(parseSummary('{"headline": 5}')).toBeNull()
    expect(parseSummary('{"headline":"ok"')).toBeNull()
  })
})
