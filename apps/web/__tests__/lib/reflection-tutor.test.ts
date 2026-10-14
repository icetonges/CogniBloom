import {
  parseGrade,
  resolveGrade,
  levelGuidance,
  buildTutorSystemPrompt,
  extractTakeaway,
  withoutTakeaway,
  TAKEAWAY_PREFIX,
  GOT_IT_MESSAGE,
} from '@/lib/tutor/reflection-tutor'

describe('grade resolution', () => {
  it('parses the Settings formats', () => {
    expect(parseGrade('Year 7')).toBe(7)
    expect(parseGrade('Grade 10')).toBe(10)
    expect(parseGrade('7th')).toBe(7)
    expect(parseGrade('kindergarten')).toBeNull()
    expect(parseGrade('Year 14')).toBeNull()
    expect(parseGrade(null)).toBeNull()
  })

  it('prefers Settings, then profile grade, then age, then a default', () => {
    expect(resolveGrade({ settingsGrade: 'Year 7', profileGrade: 9 })).toMatchObject({ grade: 7, source: 'settings' })
    expect(resolveGrade({ profileGrade: 8 })).toMatchObject({ grade: 8, source: 'profile-grade' })
    expect(resolveGrade({ profileAge: 12 })).toMatchObject({ grade: 7, source: 'profile-age' })
    expect(resolveGrade({})).toMatchObject({ grade: 7, source: 'default' })
  })

  it('infers the age range from the grade', () => {
    const g = resolveGrade({ settingsGrade: 'Year 7' })
    expect(g.ageLow).toBe(12)
    expect(g.ageHigh).toBe(13)
    expect(g.label).toBe('7th grade (about age 12-13)')
    expect(resolveGrade({ settingsGrade: 'Year 1' }).label).toBe('1st grade (about age 6-7)')
    expect(resolveGrade({ settingsGrade: 'Year 12' }).label).toBe('12th grade (about age 17-18)')
  })

  it('pitches the language by grade band', () => {
    expect(levelGuidance(2)).toMatch(/No formulas/)
    expect(levelGuidance(7)).toMatch(/12-13-year-old/)
    expect(levelGuidance(11)).toMatch(/high-school/)
  })
})

describe('system prompt', () => {
  const grade = resolveGrade({ settingsGrade: 'Year 7' })

  it('is Socratic and section-aware', () => {
    const concept = buildTutorSystemPrompt({ question: 'Why does light travel faster than sound?', section: 'concept', grade })
    expect(concept).toContain('7th grade (about age 12-13)')
    expect(concept).toContain('Why does light travel faster than sound?')
    expect(concept).toMatch(/Ask ONE short question/)
    expect(concept).toMatch(/hint ladder/)
    expect(concept).toContain(GOT_IT_MESSAGE)
    expect(concept).toContain(TAKEAWAY_PREFIX)
    expect(concept).not.toMatch(/follow-up question they could ask a teacher/)

    const later = buildTutorSystemPrompt({ question: 'Why light travel faster than sound?', section: 'later', grade })
    expect(later).toMatch(/follow-up question they could ask a teacher/)
  })

  it('includes the note context when given, trimmed', () => {
    const p = buildTutorSystemPrompt({
      question: 'q', section: 'concept', grade,
      noteTitle: 'Daily Learning Reflection', noteSubject: 'Science', noteExcerpt: 'x'.repeat(5000),
    })
    expect(p).toContain('subject: Science')
    expect(p.match(/x{100,}/)![0].length).toBe(2500)
  })
})

describe('takeaway parsing', () => {
  it('extracts the takeaway line', () => {
    const msg = `Exactly right!\n\n${TAKEAWAY_PREFIX} Light is a wave that doesn't need air, so it moves about a million times faster than sound.`
    expect(extractTakeaway(msg)).toBe("Light is a wave that doesn't need air, so it moves about a million times faster than sound.")
    expect(withoutTakeaway(msg)).toBe('Exactly right!')
  })

  it('handles markdown around the takeaway and missing ones', () => {
    expect(extractTakeaway(`**${TAKEAWAY_PREFIX}** *Sound needs something to travel through.*`)).toBe('Sound needs something to travel through.')
    expect(extractTakeaway('No takeaway yet. What do you think?')).toBeNull()
    expect(extractTakeaway(`${TAKEAWAY_PREFIX} ok`)).toBeNull()
  })
})
