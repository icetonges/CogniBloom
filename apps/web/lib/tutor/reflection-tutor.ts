// Reflection tutor — the Socratic tutor that opens when the student writes an
// entry under "7. Concepts I Still Don't Fully Understand" or
// "9. Questions I Want to Ask Later" in the Daily Reflection template.
//
// Pure functions only (grade resolution, prompt building, takeaway parsing),
// so the pedagogy can be unit tested without a model call.

export type TutorSection = 'concept' | 'later'

export const TUTOR_HEADINGS: Record<string, TutorSection> = {
  "7. Concepts I Still Don't Fully Understand": 'concept',
  '9. Questions I Want to Ask Later': 'later',
}

/** The line the tutor writes once the student has explained it back correctly. */
export const TAKEAWAY_PREFIX = '✅ Takeaway:'

/** Sent by the "I think I get it" button; the prompt tells the tutor what it means. */
export const GOT_IT_MESSAGE = 'I think I get it now.'

export interface GradeInfo {
  /** US grade, 1-12. Null when nothing usable is set. */
  grade: number | null
  /** Typical age range for that grade. */
  ageLow: number | null
  ageHigh: number | null
  /** "7th grade (about age 12-13)" */
  label: string
  source: 'settings' | 'profile-grade' | 'profile-age' | 'default'
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

function fromGrade(grade: number, source: GradeInfo['source']): GradeInfo {
  const g = Math.min(12, Math.max(1, Math.round(grade)))
  // US convention: a student is typically grade + 5 at the start of the year.
  return { grade: g, ageLow: g + 5, ageHigh: g + 6, label: `${ordinal(g)} grade (about age ${g + 5}-${g + 6})`, source }
}

/** Parse the Settings value: "Year 7", "Grade 7", "7th", "7". */
export function parseGrade(value: string | null | undefined): number | null {
  if (!value) return null
  const m = value.match(/(\d{1,2})/)
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= 12 ? n : null
}

/**
 * Decide what level to tutor at. The Settings "Year Level" is what a parent
 * edits, so it wins; then the profile's grade, then age; then a middle-school
 * default. The result is shown in the tutor panel so a wrong setting is easy
 * to notice.
 */
export function resolveGrade(opts: {
  settingsGrade?: string | null
  profileGrade?: number | null
  profileAge?: number | null
}): GradeInfo {
  const fromSettings = parseGrade(opts.settingsGrade)
  if (fromSettings !== null) return fromGrade(fromSettings, 'settings')
  if (opts.profileGrade) return fromGrade(opts.profileGrade, 'profile-grade')
  if (opts.profileAge) return fromGrade(opts.profileAge - 5, 'profile-age')
  return fromGrade(7, 'default')
}

/** How to talk to this student, by grade band. */
export function levelGuidance(grade: number | null): string {
  const g = grade ?? 7
  if (g <= 3) {
    return `Use very short sentences and everyday words. One idea per message. Explain with toys, food, pets, playgrounds. No formulas.`
  }
  if (g <= 5) {
    return `Use short sentences and everyday words. Compare ideas to things a ${g + 5}-year-old has seen: sports, cooking, games, weather. Introduce at most one new word per message and say what it means. Whole numbers only.`
  }
  if (g <= 8) {
    return `Talk like a friendly coach for a ${g + 5}-${g + 6}-year-old. Short paragraphs (2-4 sentences). Use concrete examples first (thunderstorms, fireworks, a stadium, a phone camera, a soccer field), then the idea behind them. Introduce one scientific or math term at a time and define it right away. Simple numbers and simple formulas are fine; show the units.`
  }
  return `Talk to a high-school student. Use precise vocabulary and define technical terms briefly. Equations, units and orders of magnitude are welcome. Connect to how the idea is used in the real world and in later courses.`
}

export interface TutorContext {
  question: string
  section: TutorSection
  grade: GradeInfo
  noteTitle?: string | null
  noteSubject?: string | null
  /** Plain-text excerpt of the student's reflection, for connecting to today's learning. */
  noteExcerpt?: string | null
}

export function buildTutorSystemPrompt(ctx: TutorContext): string {
  const sectionGoal = ctx.section === 'concept'
    ? `The student wrote this under "Concepts I Still Don't Fully Understand". Your goal is real understanding: the student should be able to explain the idea in their own words by the end.`
    : `The student wrote this under "Questions I Want to Ask Later". Help them work out as much of the answer as they can themselves. At the end, also suggest one way to check it (a tiny experiment at home, an observation, or a trustworthy kind of source such as a textbook or encyclopedia) and one good follow-up question they could ask a teacher.`

  const excerpt = ctx.noteExcerpt?.trim()
    ? `\n\nToday's reflection, for context (connect to it when it helps, do not summarize it back):\n"""\n${ctx.noteExcerpt.trim().slice(0, 2500)}\n"""`
    : ''

  return `You are CogniBloom's reflection tutor: a patient, encouraging Socratic tutor for a ${ctx.grade.label} student.

The student's entry: "${ctx.question.trim()}"
${ctx.noteTitle ? `Note: "${ctx.noteTitle}"${ctx.noteSubject ? ` (subject: ${ctx.noteSubject})` : ''}\n` : ''}
${sectionGoal}

How to tutor:
1. Start by finding out what they already think. Ask ONE short question about their current idea or a related everyday experience. Do not explain yet.
2. Lead with questions, one at a time. Each message should end with exactly one question for the student, until the final takeaway.
3. Use a hint ladder. If they are stuck or say "I don't know": give a small hint. Still stuck: a bigger hint or a concrete example. After that, explain clearly in a few sentences and check understanding with a question.
4. If their idea is wrong, say what is right about it first, then gently show where it breaks, ideally with an example they can picture.
5. Never make them feel slow. Praise specific thinking ("Good, you noticed the flash comes first"), not just "great job".
6. If the entry is vague (for example just "fractions"), first help them pin down exactly what is confusing.
7. When the student says "${GOT_IT_MESSAGE}", ask them to explain it back in one or two sentences in their own words. Do not explain it for them at this step.
8. When they have explained it correctly in their own words (whether after the button or on their own), confirm what they got right, fix any small gap, and finish with a final line in exactly this form:
${TAKEAWAY_PREFIX} <one sentence, written in the student's voice ("I", "my"), that captures the idea>
Only write that line when they have shown they understand. Never write it in the first two messages.

Level: ${levelGuidance(ctx.grade.grade)}

Rules:
- Keep each message under about 120 words. Use **bold** for the one key idea. Use $...$ for math only when needed.
- Stay on learning. If the student goes off topic, steer back kindly. If they bring up something personal, worrying, or about health or safety, suggest they talk to a parent or teacher.
- If the question looks like a graded homework problem, guide them to the method; do not just hand over the final answer.
- Do not invent links, quotes, or facts. If you are unsure, say so and suggest how to find out.${excerpt}`
}

/** Pull the takeaway sentence out of a tutor message, if there is one. */
export function extractTakeaway(message: string): string | null {
  const i = message.lastIndexOf(TAKEAWAY_PREFIX)
  if (i === -1) return null
  const line = message.slice(i + TAKEAWAY_PREFIX.length).split('\n')[0]
  const text = line.replace(/^[\s*_"]+|[\s*_"]+$/g, '').trim()
  return text.length >= 5 ? text : null
}

/** Message text without the takeaway line, for display. */
export function withoutTakeaway(message: string): string {
  const i = message.lastIndexOf(TAKEAWAY_PREFIX)
  return i === -1 ? message : message.slice(0, i).trimEnd()
}
