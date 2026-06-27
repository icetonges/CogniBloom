import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { chatWithFallback } from '@/lib/ai/fallback'

export const maxDuration = 120

type RouteParams = { params: Promise<{ noteId: string }> }

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitizeSlugPart(str: string): string {
  return str.trim().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 40)
}
function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function sanitizeRichHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s(?:href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, '')
}
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()
}
function htmlToTextLines(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<h[1-6][^>]*>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .split('\n').map((l: string) => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim()
}
function extractJSON(text: string): string {
  const s = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim()
  let depth = 0, start = -1, inStr = false, esc = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (esc) { esc = false; continue }
    if (ch === '\\' && inStr) { esc = true; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (ch === '{') { if (depth === 0) start = i; depth++ }
    else if (ch === '}') { depth--; if (depth === 0 && start !== -1) return s.slice(start, i + 1) }
  }
  return s.replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/im, '').trim()
}
async function generateSlug(subject: string | null, date: Date): Promise<string> {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const subjectPart = sanitizeSlugPart(subject ?? 'Note') || 'Note'
  const prefix = `${dateStr}_${subjectPart}_`
  const existing = await db.note.findMany({
    where: { publishedSlug: { startsWith: prefix } },
    select: { publishedSlug: true },
  })
  return `${prefix}${(existing.length + 1).toString().padStart(3, '0')}`
}

// ── Section Parser ────────────────────────────────────────────────────────────

interface DanielInputSections {
  whatILearned: string | null
  knowledgePoints: string | null
  problemsWrong: string | null
  whyWrong: string | null
  stillConfused: string | null
  improvementNotes: string | null
  connections: string | null
  smallWin: string | null
  reviewTomorrow: string | null
  selfQuiz: string | null
  subjectsPracticed: string | null
  questionsToAsk: string | null
}

const TEMPLATE_NOISE: RegExp[] = [
  // Form instructions
  /^check the boxes you worked on/i,
  /^fill this out at the end/i,
  /^keep answers short and honest/i,
  /^short, honest answers/i,
  /^copy this file and rename/i,
  /^change ☐ to ☑/i,
  /^write the question[,\s]/i,
  /^the real reason \(rushed/i,
  /^be specific\s*[—-]/i,
  /^be specific[—\s]/i,
  /^save (for|these for) a parent/i,
  /^how does today link/i,
  /^something i.m proud of/i,
  /^a few sentences (describing|as if)/i,
  /^example:/i,
  /^today.s ___/i,
  /^write 3 questions/i,
  /^cover the answers/i,
  /^at the end of the week/i,
  /^what i.ll do differently/i,
  /^facts, rules, formulas/i,
  /^the big ideas/i,
  /^one bullet per subject/i,
  /^star .* the ones to memorize/i,
  /^subject\s*\|\s*question/i,
  /^\|-+\|/,
  /^\|[\s_]*\|/,
  // "e.g." example lines (form placeholder examples)
  /^e\.g\.\s/i,
  /^e\.g\.,/i,
  // Empty or near-empty form fields
  /^date:\s*$/i,
  /^day of week:\s*$/i,
  /^focus level[^:]*:\s*$/i,
  /^energy level[^:]*:\s*$/i,
  /^one word for today:\s*$/i,
  /^q:\s*a:\s*$/i,
  /^q\d*:\s*a\d*:\s*$/i,
  // Section header of the form itself
  /^📘\s*daily learning reflection/i,
  /^date & check.in/i,
  /^progress summary/i,
  /^format:\s*(subject|q:)/i,
]

function isNoiseLine(line: string): boolean {
  const l = line.trim()
  if (!l) return true
  if (l === '-' || l === '•' || l === '[ ]' || l === '[x]' || l === '[X]') return true
  if (/^_{2,}$/.test(l)) return true
  if (/^\[[ xX]\]\s*$/.test(l)) return true
  if (/^>\s*_/.test(l)) return true
  if (/^[📚🧠📝🎯🔗📅🌍💡🎉🔍⭐]+\s*$/.test(l)) return true
  if (/^\s*[-*]\s+_{3,}/.test(l)) return true
  if (/^[-*]\s*$/.test(l)) return true
  // Unfilled checkbox items: "☐ Math —" or "☐ " with nothing after the dash
  if (/^☐\s/.test(l)) return true
  // Lines that are just a checkbox + subject stub (no actual content after the dash)
  if (/^[•\-]\s*☐/.test(l)) return true
  for (const p of TEMPLATE_NOISE) if (p.test(l)) return true
  return false
}

function parseReflectionSections(html: string): DanielInputSections {
  const text = htmlToTextLines(html)
  const lines = text.split('\n')

  const MATCHERS: [RegExp, keyof DanielInputSections][] = [
    [/(?:\d+\.\s+)?what i learned today/i,              'whatILearned'],
    [/(?:\d+\.\s+)?important knowledge points/i,         'knowledgePoints'],
    [/(?:\d+\.\s+)?problems or questions i got wrong/i,  'problemsWrong'],
    [/(?:\d+\.\s+)?why i got them wrong/i,               'whyWrong'],
    [/(?:\d+\.\s+)?concepts i still don.t fully understand/i, 'stillConfused'],
    [/(?:\d+\.\s+)?improvement notes/i,                  'improvementNotes'],
    [/(?:\d+\.\s+)?connections to things i learned before/i, 'connections'],
    [/(?:\d+\.\s+)?one small win today/i,                'smallWin'],
    [/(?:\d+\.\s+)?what i should review tomorrow/i,      'reviewTomorrow'],
    [/(?:\d+\.\s+)?self-check quiz/i,                    'selfQuiz'],
    [/(?:\d+\.\s+)?subjects practiced today/i,           'subjectsPracticed'],
    [/(?:\d+\.\s+)?questions i want to ask later/i,      'questionsToAsk'],
  ]

  const matchHeading = (line: string): keyof DanielInputSections | null => {
    const cleaned = line.replace(/^#+\s*/, '').replace(/^\d+\.\s*/, '').trim()
    if (cleaned.length > 120) return null
    for (const [pat, key] of MATCHERS) if (pat.test(cleaned)) return key
    return null
  }

  const result: DanielInputSections = {
    whatILearned: null, knowledgePoints: null, problemsWrong: null,
    whyWrong: null, stillConfused: null, improvementNotes: null,
    connections: null, smallWin: null, reviewTomorrow: null,
    selfQuiz: null, subjectsPracticed: null, questionsToAsk: null,
  }

  let curKey: keyof DanielInputSections | null = null
  const curLines: string[] = []

  const flush = () => {
    if (!curKey) return
    const content = curLines.filter(l => !isNoiseLine(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim()
    if (content.length > 5) result[curKey] = content
    curLines.length = 0
  }

  for (const line of lines) {
    const heading = matchHeading(line)
    if (heading) { flush(); curKey = heading }
    else if (curKey) curLines.push(line)
  }
  flush()
  return result
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubjectSection {
  emoji: string
  subjectTitle: string   // e.g. "Math — The Sequence That Flipped and Fooled Me"
  body: string           // 2-4 flowing prose paragraphs (may include <strong> and <em>)
}

interface BigIdea {
  idea: string
  whatItMeans: string
  whyItMatters: string
  howItWorks: string
  example: string
  analogy: string
}

interface Mistake {
  whatHappened: string   // what was wrong / not understood
  keyIdea: string        // the correct knowledge point / concept
  whyItMatters: string   // why this concept matters
  howItWorks: string     // the logic and reasoning, step by step
  example: string        // a concrete worked example
  howToRemember: string  // how to lock it in / avoid it next time
}

interface WriterOutput {
  publishTitle: string
  openingHook: string
  subjectSections: SubjectSection[]
  bigIdeas: BigIdea[]
  learningTips: string[]
  mistakes: Mistake[]
  connections: string[]
  selfQuiz: Array<{ question: string; answer: string }>
  tryThisNext: { practice: string; reflection: string; habit: string; challenge: string }
  closingSection: string
  keyTerms: Array<{ term: string; definition: string; color: string }>
  reviewTomorrow: string[]
  socialPosts: { instagram: string; facebook: string; x: string }
  socialPost: string
}

// ── Note type detection ───────────────────────────────────────────────────────


// ── Title pattern tracker (in-process rotation only) ─────────────────────────
let lastTitlePattern = 0

// ── Unified Learning Chronicle skill ──────────────────────────────────────────
// One shared writer + skill for EVERY note type, so all published chronicles have
// the same depth and quality. The default model and fallback order match the rest
// of the app: Gemini 3.5 Flash first, then Gemini 3.1/2.5, Groq/Llama, then Claude.

const DEFAULT_CHRONICLE_MODEL = 'gemini-3.5-flash'

function computeStudentProfile(subject: string | null): string {
  const dob = new Date('2014-02-15T00:00:00Z')
  const now = new Date()
  let age = now.getUTCFullYear() - dob.getUTCFullYear()
  const m = now.getUTCMonth() - dob.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--
  // School year flips in August; born Feb 2014 -> entering 7th grade in 2026-27.
  const schoolYearStart = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const grade = 7 + (schoolYearStart - 2026)
  const gradeLabel = grade <= 7 ? 'rising 7th grade' : 'grade ' + grade
  const subj = subject && subject.trim() ? subject.trim() : 'multiple subjects'
  return 'Age ' + age + ' (DOB February 2014), ' + gradeLabel + '. Subject(s) in this note: ' + subj + '. Write for this reader: a curious middle-schooler around 7th grade.'
}

const CHRONICLE_SYSTEM_PROMPT = `You are a professional teen-education writer, learning coach, creative explainer, and cross-subject mentor. Your job is to transform a student's daily learning note into a polished Learning Chronicle for a curious middle-schooler (around 7th grade). The final product should read like a short, inspiring learning essay that helps the student understand, remember, and connect ideas across subjects.

The topic can be anything: regular school subjects, competition math, reading, writing, vocabulary, grammar, science, physics, biology, chemistry, history, geography, language learning, Duolingo, AI, coding, computing, robotics, logic, debate, public speaking, music, art, sports, or study habits. Adapt your explanation and tips to the actual topic in the note.

The note may be messy: typos, unfinished sentences, repeated ideas, copied text, wrong answers, or comments about what the student struggled with. Read carefully and extract the real learning signal. Do not just summarize. Think like a teacher, writer, coach, and curriculum designer.

Your goals:
- Turn the note into a clear, engaging, publish-ready Learning Chronicle.
- Explain the knowledge BEHIND the note, not just what happened: why it matters, how it works, where it connects.
- Treat every wrong answer, error, or "I still don't understand this" as the MOST IMPORTANT part of the note and the single biggest opportunity to teach. Never gloss over it. Teach the underlying knowledge point in full: name the concept, explain what it is, why it matters, how it works (the logic and reasoning, step by step), and give a concrete worked example. Then show how to remember it and avoid the slip next time. Be encouraging and specific, never shaming.
- If the note shows confusion or a half-formed idea, rebuild the concept from the ground up with age-appropriate examples, analogies, and clear reasoning until it would actually click.
- If the note asks a question, answer it and expand it into a learning opportunity.
- Train the student to connect dots, reason logically, and reflect on growth.
- Build confidence, curiosity, discipline, and a growth mindset.

Subject adaptation:
- Math / competition math: explain the core concept, pattern, or strategy and the logic behind the solution, not just the answer. Flag common traps (rushing, missed conditions, weak number sense, unchecked cases). Encourage drawing diagrams, testing small numbers, finding patterns, organizing cases.
- Coding / AI / computing / robotics: use simple systems thinking (input, process, output, data, logic, debugging). If there is an error, explain what it reveals about the logic. Do not exaggerate what AI can do. Encourage reading the error, isolating the problem, changing one thing at a time.
- Science / physics: explain through cause and effect with real-world examples and analogies. Note units, variables, and assumptions. If a formula appears, explain what each part means and why it makes sense.
- Language arts / reading / writing / grammar: explain the underlying skill. Connect vocabulary, grammar, structure, tone, evidence, and theme. Encourage asking what the author wants the reader to notice and whether the evidence proves the claim.
- History / civics / social studies: explain events and systems in terms of people, choices, causes, consequences, and perspectives. Avoid oversimplifying.
- Language learning: explain the pattern behind vocabulary, grammar, or pronunciation. Connect memory, repetition, and context. Give one practical practice tip.
- Multiple subjects: organize around the biggest learning themes and show how they connect. Focus more on the most meaningful signals; do not force equal attention.

Style:
Write warmly, intelligently, and vividly for a curious 7th grader. Make hard ideas feel understandable with analogies, mini-stories, and visual language. Vary sentence length. You may use phrases like Think of it like..., The hidden idea is..., The mistake is useful because..., This connects to..., A good learner notices..., The big pattern is..., but do not overuse them. When useful, include a SHORT, accurate background story about how a concept or method came about. Never invent fake history, scientists, quotes, dates, or experiments.

Hard rules:
- Do not make up facts the note does not support. If the note is unclear, make the best reasonable interpretation and say briefly what you assumed.
- Fix spelling and grammar silently. Do not embarrass the student, sound childish, sound like a generic AI summary, or overpraise. Honest struggle is part of learning; do not turn every note into a victory story.
- When the note is messy, find the learning signal inside the noise instead of copying the mess.`

// ── AI Writer ─────────────────────────────────────────────────────────────────

async function generateWriterContent(note: {
  title: string
  subject: string | null
  tutorSummary: string | null
  content: string
  knowledgePoints: string | null
}, storedWriter: WriterOutput | null = null): Promise<WriterOutput> {
  const sections = parseReflectionSections(note.content)

  const parts: string[] = []
  if (sections.subjectsPracticed) parts.push(`SUBJECTS PRACTICED:\n${sections.subjectsPracticed}`)
  if (sections.whatILearned)      parts.push(`WHAT I LEARNED:\n${sections.whatILearned}`)
  if (sections.knowledgePoints)   parts.push(`KEY KNOWLEDGE POINTS:\n${sections.knowledgePoints}`)
  if (sections.problemsWrong)     parts.push(`PROBLEMS I GOT WRONG:\n${sections.problemsWrong}`)
  if (sections.whyWrong)         parts.push(`WHY I GOT THEM WRONG:\n${sections.whyWrong}`)
  if (sections.stillConfused)    parts.push(`CONCEPTS I STILL DON'T FULLY UNDERSTAND:\n${sections.stillConfused}`)
  if (sections.improvementNotes) parts.push(`IMPROVEMENT NOTES:\n${sections.improvementNotes}`)
  if (sections.connections)      parts.push(`CONNECTIONS TO PRIOR LEARNING:\n${sections.connections}`)
  if (sections.smallWin)         parts.push(`MY SMALL WIN TODAY:\n${sections.smallWin}`)
  if (sections.reviewTomorrow)   parts.push(`WHAT TO REVIEW TOMORROW:\n${sections.reviewTomorrow}`)
  if (sections.selfQuiz)         parts.push(`SELF-CHECK QUIZ:\n${sections.selfQuiz}`)
  if (sections.questionsToAsk)   parts.push(`OPEN QUESTIONS:\n${sections.questionsToAsk}`)

  const rawContent = parts.length > 0
    ? parts.join('\n\n')
    : htmlToText(note.content).slice(0, 4000)

  // Gate: if the note has almost no real content, throw a clear error
  // rather than letting the AI hallucinate from the blank template
  const meaningfulChars = rawContent
    .replace(/[A-Z\s,.:;!?•\-\[\]()#]+/g, ' ')  // strip structural chars
    .replace(/\s+/g, ' ')
    .trim().length
  if (meaningfulChars < 60) {
    throw Object.assign(
      new Error('NOTE_TOO_EMPTY'),
      { userMessage: 'This reflection has very little content. Fill in at least a few sections before publishing.' }
    )
  }

  let aiContext = ''
  if (note.tutorSummary) {
    aiContext += `\nAI TUTOR CONTEXT: ${htmlToText(note.tutorSummary).slice(0, 600)}`
  }
  if (note.knowledgePoints) {
    try {
      const kps = JSON.parse(note.knowledgePoints) as { term: string; definition: string; importance: string }[]
      aiContext += `\nKEY CONCEPTS IDENTIFIED:\n${kps.map(k => `• ${k.term}: ${k.definition}`).join('\n')}`
    } catch { /* ignore */ }
  }

  // Rotate title pattern suggestion
  lastTitlePattern = (lastTitlePattern % 6) + 1
  const titlePatternGuide = `TITLE STRUCTURE — use Pattern ${lastTitlePattern}. Ground the title in what Daniel actually studied, then ELEVATE it with deeper context: the person behind the idea, its origin, or its real-world stakes. Never copy an example below — generate a fresh title.
  Pattern 1 — Two ideas + a human anchor:     "Gauss, Fibonacci, and a $5 Bet on the Future"
  Pattern 2 — One concept + its implication:  "The Only Even Prime and Why That Changes Everything"
  Pattern 3 — A surprising contrast:          "while True Runs Forever. The Vocab Test Did Not."
  Pattern 4 — A question from the day:        "What Does a Flipped Sequence Actually Cost You?"
  Pattern 5 — A vivid moment:                 "The Wednesday the Pairing Trick Rewired Addition"
  Pattern 6 — A concept name used poetically: "Indefinite Loops and the Quiet Beauty of Fibonacci"`

  const prompt = `${CHRONICLE_SYSTEM_PROMPT}

STUDENT PROFILE (auto-updated to today's date): ${computeStudentProfile(note.subject)}

─── DANIEL'S RAW NOTES ──────────────────────────────────────────────
Note title: ${note.title}
Subject area: ${note.subject ?? 'Multiple subjects'}

${rawContent}${aiContext}
─────────────────────────────────────────────────────────────────────

${titlePatternGuide}

OUTPUT — return ONLY this JSON object. No markdown fences, no preamble, no trailing text. Use an empty array for any section that does not apply; never invent facts to fill a section.
{
  "publishTitle": "max 95 chars; names the actual intellectual content of the day",
  "openingHook": "2-4 sentences; set the human scene before any academic content; never begin with 'Today I learned' or by listing subjects",
  "subjectSections": [{ "emoji": "single emoji for the subject", "subjectTitle": "Subject — a vivid description of what happened", "body": "2-4 prose paragraphs separated by \\n\\n; no bullet points; explain WHY the idea works, gently correct any misunderstanding, treat open questions as cliffhangers; use <strong> for exactly one key insight and <em> for a term on first use" }],
  "bigIdeas": [{ "idea": "the concept name", "whatItMeans": "one clear sentence", "whyItMatters": "one sentence", "howItWorks": "one or two sentences", "example": "one concrete example", "analogy": "a think-of-it-like analogy" }],
  "learningTips": ["3-6 SPECIFIC tips tied to the actual topic; never generic advice like study harder or review more"],
  "mistakes": [{ "whatHappened": "what was wrong or not understood (include this for EVERY error or confusion in the note)", "keyIdea": "the correct knowledge point / concept, named clearly", "whyItMatters": "why this concept matters", "howItWorks": "the logic and reasoning, step by step", "example": "a concrete worked example that makes it click", "howToRemember": "how to lock it in and avoid the slip next time" }],
  "connections": ["2-5 connect-the-dots links from today's learning to other subjects or real life"],
  "selfQuiz": [{ "question": "3-5 reasoning questions that train logic and explanation, not memorization", "answer": "a short model answer, hint, or thinking path" }],
  "tryThisNext": { "practice": "one small, doable practice action for tomorrow", "reflection": "one reflection question", "habit": "one habit to build", "challenge": "one optional stretch challenge" },
  "keyTerms": [{ "term": "term from the note", "definition": "one memorable, precise sentence", "color": "one of: violet, emerald, amber, sky, rose" }],
  "reviewTomorrow": ["2-4 specific items worth revisiting — concrete, not just review math"],
  "closingSection": "3-5 sentences synthesizing the day; connect at least two ideas; end on something real and specific, never overall it was a great day",
  "socialPosts": { "instagram": "warm and visual, 1-3 hashtags", "facebook": "slightly longer and friendly", "x": "punchy, 250 characters max including 1-3 hashtags" },
  "socialPost": "the single best short post to feature, 250 characters max including hashtags, genuine teen voice"
}`

  const ask = async (extra: string): Promise<string> => {
    const res = await chatWithFallback(
      { messages: [{ role: 'user', content: extra ? `${prompt}\n\n${extra}` : prompt }], temperature: extra ? 0.4 : 0.72, maxTokens: 8000 },
      DEFAULT_CHRONICLE_MODEL,
    )
    return res.content
  }

  const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
  const sArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()) : []

  const defaults: WriterOutput = {
    publishTitle: note.title,
    openingHook: `The day started slow, but the ideas came anyway.`,
    subjectSections: [{
      emoji: '📚',
      subjectTitle: `${note.subject ?? 'Study Session'} — Notes from Today`,
      body: htmlToText(note.content).slice(0, 600),
    }],
    bigIdeas: [],
    learningTips: [],
    mistakes: [],
    connections: [],
    selfQuiz: [],
    tryThisNext: { practice: '', reflection: '', habit: '', challenge: '' },
    closingSection: `Every session adds something. Today was no different.`,
    keyTerms: [],
    reviewTomorrow: [],
    socialPosts: { instagram: '', facebook: '', x: '' },
    socialPost: `learning something new every day 🧠 #studentlife #CogniBloom`,
  }

  try {
    let parsed: Partial<WriterOutput>
    try {
      parsed = JSON.parse(extractJSON(await ask(''))) as Partial<WriterOutput>
    } catch {
      // One repair attempt — same canonical chain, lower temperature
      parsed = JSON.parse(extractJSON(await ask('Your previous reply was not valid JSON. Return ONLY the JSON object, minified, with every string properly escaped.'))) as Partial<WriterOutput>
    }

    const ttn = (parsed.tryThisNext && typeof parsed.tryThisNext === 'object') ? parsed.tryThisNext : undefined
    const sp = (parsed.socialPosts && typeof parsed.socialPosts === 'object') ? parsed.socialPosts : undefined

    return {
      publishTitle:    s(parsed.publishTitle) || defaults.publishTitle,
      openingHook:     s(parsed.openingHook) || defaults.openingHook,
      subjectSections: Array.isArray(parsed.subjectSections) && parsed.subjectSections.length ? parsed.subjectSections : defaults.subjectSections,
      bigIdeas:        Array.isArray(parsed.bigIdeas) ? parsed.bigIdeas : defaults.bigIdeas,
      learningTips:    sArr(parsed.learningTips),
      mistakes:        Array.isArray(parsed.mistakes) ? parsed.mistakes : defaults.mistakes,
      connections:     sArr(parsed.connections),
      selfQuiz:        Array.isArray(parsed.selfQuiz) ? parsed.selfQuiz : defaults.selfQuiz,
      tryThisNext:     ttn ? { practice: s(ttn.practice), reflection: s(ttn.reflection), habit: s(ttn.habit), challenge: s(ttn.challenge) } : defaults.tryThisNext,
      closingSection:  s(parsed.closingSection) || defaults.closingSection,
      keyTerms:        Array.isArray(parsed.keyTerms) ? parsed.keyTerms : defaults.keyTerms,
      reviewTomorrow:  sArr(parsed.reviewTomorrow),
      socialPosts:     sp ? { instagram: s(sp.instagram), facebook: s(sp.facebook), x: s(sp.x) } : defaults.socialPosts,
      socialPost:      s(parsed.socialPost) || defaults.socialPost,
    }
  } catch {
    // AI failed — reuse the last good writer output rather than raw note text
    if (storedWriter) return storedWriter
    return defaults
  }
}

// ── Color map ─────────────────────────────────────────────────────────────────

const TERM_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  violet: { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.35)', text: '#a78bfa' },
  emerald:{ bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', text: '#34d399' },
  amber:  { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', text: '#fbbf24' },
  sky:    { bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.35)', text: '#38bdf8' },
  rose:   { bg: 'rgba(244,63,94,0.12)',  border: 'rgba(244,63,94,0.35)',  text: '#fb7185' },
}

// ── Prose renderer — convert body text to safe HTML paragraphs ────────────────
// The AI body may include \n\n paragraph breaks, <strong>, <em>

function renderProseBody(body: string): string {
  // ── Inline markdown → safe HTML ──────────────────────────────────
  function inlineMd(raw: string): string {
    // Protect price dollar signs ($5, $10 etc) so KaTeX ignores them
    let s = raw.replace(/\$(\d)/g, '&#36;$1')
    // HTML-escape dangerous chars; allow existing <strong><em><code> tags
    s = s
      .replace(/&(?!amp;|lt;|gt;|quot;|#39;|#36;)/g, '&amp;')
      .replace(/<(?!\/?(?:strong|em|code)\s*>)/g, '&lt;')
    // Bold **...**
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic *...* (not double-star)
    s = s.replace(/(^|\s|>)\*(?!\*)([^*\n]+?)\*(?!\*)($|\s|[.,;:!?<])/g, '$1<em>$2</em>$3')
    // Inline code `...`
    s = s.replace(/`([^`]+)`/g, '<code style="background:rgba(99,102,241,0.12);color:#a5b4fc;padding:1px 6px;border-radius:4px;font-family:monospace;font-size:.82em;">$1</code>')
    return s
  }

  // ── Block-level line processor ────────────────────────────────────
  const lines = body.split('\n')
  const out: string[] = []
  let listTag = '' // 'ul' | 'ol' | ''
  const hStyle = 'font-weight:800;color:var(--text);line-height:1.3;border-bottom:1px solid var(--border);padding-bottom:10px;'

  function closeList() {
    if (listTag) { out.push(`</${listTag}>`); listTag = '' }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) { closeList(); continue }

    // Headings: #, ##, ###, ####
    const hm = line.match(/^(#{1,6})\s+(.+)/)
    if (hm) {
      closeList()
      const lvl = Math.min(hm[1].length + 1, 5)
      const sz = lvl <= 2 ? '1.2rem' : lvl === 3 ? '1.05rem' : '0.95rem'
      const mt = lvl <= 2 ? '32px' : '24px'
      out.push(`<h${lvl} style="font-size:${sz};${hStyle}margin:${mt} 0 14px;">${inlineMd(hm[2])}</h${lvl}>`)
      continue
    }

    // Unordered bullets: * item / - item / + item
    const bm = line.match(/^[*\-+]\s+(.+)/)
    if (bm) {
      if (listTag !== 'ul') { closeList(); out.push('<ul style="margin:14px 0 14px 26px;padding:0;list-style:disc;">'); listTag = 'ul' }
      out.push(`<li style="margin-bottom:8px;">${inlineMd(bm[1])}</li>`)
      continue
    }

    // Ordered lists: 1. / 2. etc
    const om = line.match(/^\d+\.\s+(.+)/)
    if (om) {
      if (listTag !== 'ol') { closeList(); out.push('<ol style="margin:14px 0 14px 26px;padding:0;list-style:decimal;">'); listTag = 'ol' }
      out.push(`<li style="margin-bottom:8px;">${inlineMd(om[1])}</li>`)
      continue
    }

    // Regular paragraph
    closeList()
    out.push(`<p>${inlineMd(line)}</p>`)
  }

  closeList()
  return out.filter(Boolean).join('\n')
}

// ── Page Builder ──────────────────────────────────────────────────────────────

function buildPublishedPage(note: {
  originalTitle: string
  subject: string | null
  originalContent: string
  tutorSummary: string | null
  knowledgePoints: string | null
  mindMap: string | null
  reasoningHints: string | null
  publishedSlug: string
  createdAt: Date
  writer: WriterOutput
}): string {
  const date = new Date(note.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const { writer } = note

  // ── Subject sections ──
  const subjectSectionsHtml = writer.subjectSections.map(sec => {
    const safeTitle = escapeHtml(sec.subjectTitle)
    const body = renderProseBody(sec.body)
    return `
  <section class="subject-section">
    <h2 class="subject-heading">
      <span class="subject-emoji">${escapeHtml(sec.emoji)}</span>
      ${safeTitle}
    </h2>
    <div class="subject-body">${body}</div>
  </section>`
  }).join('\n')

  // ── Key Terms ──
  const termPillsHtml = writer.keyTerms.map(kt => {
    const c = TERM_COLORS[kt.color] ?? TERM_COLORS['violet']!
    return `<div class="term-row">
      <span class="term-pill" style="background:${c.bg};border-color:${c.border};color:${c.text};">${escapeHtml(kt.term)}</span>
      <span class="term-def">${escapeHtml(kt.definition)}</span>
    </div>`
  }).join('')

  // ── Self-Quiz ──
  const selfQuizHtml = writer.selfQuiz.map((q, i) => `
    <div class="quiz-item">
      <div class="quiz-q">Q${i + 1}: ${escapeHtml(q.question)}</div>
      <details class="quiz-details">
        <summary class="quiz-summary">▶ Show Answer</summary>
        <div class="quiz-a">${escapeHtml(q.answer)}</div>
      </details>
    </div>`).join('')

  // ── Review Checklist ──
  const reviewHtml = writer.reviewTomorrow.map(r => `
    <div class="review-item">
      <span class="review-box"></span>
      <span class="review-text">${escapeHtml(r)}</span>
    </div>`).join('')

  // ── Big Ideas ──
  const biRow = (k: string, v: string): string => (v && v.trim())
    ? `<div style="display:flex;gap:8px;margin-bottom:5px;font-size:13.5px;line-height:1.6;"><span style="flex-shrink:0;min-width:108px;font-weight:700;color:var(--text3);">${k}</span><span style="color:var(--text2);">${escapeHtml(v)}</span></div>`
    : ''
  const bigIdeasHtml = (writer.bigIdeas ?? []).map((b) => `
    <div style="margin-bottom:14px;padding:13px 15px;border:1px solid rgba(139,92,246,0.25);border-radius:12px;background:rgba(139,92,246,0.06);">
      <div style="font-weight:800;font-size:15px;color:#a78bfa;margin-bottom:8px;">${escapeHtml(b.idea || '')}</div>
      ${biRow('What it means', b.whatItMeans)}${biRow('Why it matters', b.whyItMatters)}${biRow('How it works', b.howItWorks)}${biRow('Example', b.example)}${biRow('Think of it like', b.analogy)}
    </div>`).join('')

  // ── Topic-Based Learning Tips ──
  const learningTipsHtml = (writer.learningTips ?? []).map((t) => `
    <div style="display:flex;gap:9px;margin-bottom:8px;align-items:flex-start;">
      <span style="flex-shrink:0;color:#34d399;font-weight:800;">✓</span>
      <span style="font-size:14px;line-height:1.65;color:var(--text2);">${escapeHtml(t)}</span>
    </div>`).join('')

  // ── Mistakes / Aha ──
  const mistakesHtml = (writer.mistakes ?? []).map((m) => `
    <div style="margin-bottom:14px;padding:13px 15px;border:1px solid rgba(245,158,11,0.28);border-radius:12px;background:rgba(245,158,11,0.06);">
      ${biRow('What went wrong', m.whatHappened)}${biRow('The key idea', m.keyIdea)}${biRow('Why it matters', m.whyItMatters)}${biRow('How it works', m.howItWorks)}${biRow('Worked example', m.example)}${biRow('Remember it by', m.howToRemember)}
    </div>`).join('')

  // ── Connect the Dots ──
  const connectionsHtml = (writer.connections ?? []).map((c) => `
    <div style="display:flex;gap:9px;margin-bottom:8px;align-items:flex-start;">
      <span style="flex-shrink:0;color:#38bdf8;font-weight:800;">→</span>
      <span style="font-size:14px;line-height:1.65;color:var(--text2);">${escapeHtml(c)}</span>
    </div>`).join('')

  // ── Try This Next ──
  const ttn = writer.tryThisNext ?? { practice: '', reflection: '', habit: '', challenge: '' }
  const ttnRows: Array<[string, string]> = [['🎯 Practice', ttn.practice], ['🤔 Reflect', ttn.reflection], ['🔁 Habit', ttn.habit], ['🏆 Challenge', ttn.challenge]]
  const tryThisNextHtml = ttnRows.filter((r) => r[1] && r[1].trim()).map((r) => `
    <div style="margin-bottom:9px;font-size:14px;line-height:1.65;"><span style="font-weight:800;color:var(--text3);margin-right:8px;">${r[0]}</span><span style="color:var(--text2);">${escapeHtml(r[1])}</span></div>`).join('')

  // ── Ready-to-post social captions ──
  const sv = writer.socialPosts ?? { instagram: '', facebook: '', x: '' }
  const svRows: Array<[string, string]> = [['Instagram', sv.instagram], ['Facebook', sv.facebook], ['X', sv.x]]
  const socialVariantsHtml = svRows.filter((p) => p[1] && p[1].trim()).map((p) => `
    <div style="margin-top:10px;padding:10px 12px;border:1px solid rgba(255,255,255,0.08);border-radius:10px;background:rgba(255,255,255,0.03);">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--text3);margin-bottom:4px;">${p[0]}</div>
      <div style="font-size:13.5px;line-height:1.6;color:var(--text2);">${escapeHtml(p[1])}</div>
    </div>`).join('')

  // ── Mind Map ──
  let mindMapHtml = ''
  try {
    interface MindNode { label: string; children?: MindNode[] }
    const renderNode = (node: MindNode, depth = 0): string => {
      const ch = node.children?.length
        ? `<ul style="margin:4px 0 4px 18px;padding:0;list-style:none;">${node.children.map((c: MindNode) => renderNode(c, depth + 1)).join('')}</ul>` : ''
      const bg = depth === 0 ? '#6366f1' : depth === 1 ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)'
      return `<li style="margin:4px 0;"><span style="display:inline-block;background:${bg};color:${depth === 0 ? '#fff' : 'inherit'};padding:${depth === 0 ? '5px 14px' : '3px 10px'};border-radius:7px;font-size:${depth === 0 ? '13px' : '12px'};font-weight:${depth === 0 ? 700 : 500};">${escapeHtml(node.label)}</span>${ch}</li>`
    }
    const root = JSON.parse(note.mindMap ?? 'null') as MindNode | null
    if (root) mindMapHtml = `<ul style="list-style:none;margin:0;padding:0;">${renderNode(root)}</ul>`
  } catch { /* */ }

  // ── Reasoning Hints ──
  let reasoningHtml = ''
  try {
    const hints = JSON.parse(note.reasoningHints ?? '[]') as { step: number; hint: string }[]
    reasoningHtml = hints.map(h => `
      <div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;">
        <span style="flex-shrink:0;width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">${h.step}</span>
        <span style="font-size:14px;line-height:1.7;color:var(--text3);padding-top:3px;">${escapeHtml(h.hint)}</span>
      </div>`).join('')
  } catch { /* */ }

  const safeTitle       = escapeHtml(writer.publishTitle)
  const safeSlug        = escapeHtml(note.publishedSlug)
  const safeOpening     = writer.openingHook.split(/\n+/).map(p => `<p>${escapeHtml(p.trim())}</p>`).filter(p => p !== '<p></p>').join('\n')
  const safeClosing     = writer.closingSection.split(/\n+/).map(p => `<p>${escapeHtml(p.trim())}</p>`).filter(p => p !== '<p></p>').join('\n')
  const safeSummary     = note.tutorSummary ? sanitizeRichHtml(note.tutorSummary) : null
  const safeSocial      = escapeHtml(writer.socialPost)
  const safeSubject     = note.subject ? escapeHtml(note.subject) : ''

  const xSvg  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.631L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>`
  const fbSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.411c0-3.025 1.791-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.971h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>`
  const igSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>`
  const ttSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.2 8.2 0 004.79 1.53V6.75a4.85 4.85 0 01-1.02-.06z"/></svg>`
  const thSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.5 12.069V12c.024-3.506.906-6.346 2.621-8.44C5.854 1.338 8.496.024 11.988 0h.013c2.7.016 4.987.758 6.787 2.205 1.72 1.385 2.768 3.24 3.116 5.515l-2.898.53c-.287-1.67-.971-3.027-2.033-4.033-1.11-1.05-2.65-1.603-4.574-1.632H12.1c-2.59.034-4.567.941-5.881 2.695C5.127 6.718 4.5 8.9 4.48 11.996v.07c.02 3.1.647 5.285 1.74 6.729 1.315 1.752 3.294 2.66 5.882 2.694h.08c2.19-.027 3.77-.517 4.879-1.496.985-.864 1.597-2.15 1.82-3.821l2.898.53c-.292 2.36-1.2 4.2-2.69 5.47-1.637 1.39-3.848 2.11-6.594 2.118h-.31z"/></svg>`

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle} — Daniel's Learning Diary</title>
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:type" content="article">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}

    /* ── Theme transition ───────────────────────── */
    html{transition:background-color .18s ease,color .18s ease;}
    body,
    .sidebar,.topbar,.main,
    .note-link,.terms-card,.quiz-item,.ai-box,.closing,
    .raw,.sb-brand{
      transition:background-color .18s ease,color .18s ease,border-color .18s ease;
    }

    /* ── Theme tokens ─────────────────────────────── */
    [data-theme="dark"]{
      --bg:#090e1a; --bg2:#0f1629; --bg3:rgba(255,255,255,0.025);
      --border:rgba(255,255,255,0.07); --border2:rgba(99,102,241,0.25);
      --text:#f1f5f9; --text2:#e2e8f0; --text3:#cbd5e1; --text4:#64748b;
      --accent:#6366f1; --accent2:#8b5cf6;
      --tag-bg:rgba(99,102,241,0.12); --tag-text:#a5b4fc;
      --card-bg:rgba(255,255,255,0.02);
    }
    [data-theme="light"]{
      --bg:#f1f5f9; --bg2:#ffffff; --bg3:rgba(0,0,0,0.02);
      --border:rgba(0,0,0,0.09); --border2:rgba(99,102,241,0.3);
      --text:#0f172a; --text2:#1e293b; --text3:#334155; --text4:#94a3b8;
      --accent:#6366f1; --accent2:#8b5cf6;
      --tag-bg:rgba(99,102,241,0.09); --tag-text:#6366f1;
      --card-bg:rgba(0,0,0,0.025);
    }

    /* ── Base ─────────────────────────────────────── */
    body{
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;
      background:var(--bg); color:var(--text);
      min-height:100vh; display:flex; line-height:1;
    }

    /* ── Sidebar ──────────────────────────────────── */
    .sidebar{
      width:264px; min-width:264px; height:100vh;
      position:sticky; top:0;
      background:var(--bg2); border-right:1px solid var(--border);
      display:flex; flex-direction:column; overflow:hidden; z-index:100;
    }
    .sb-brand{
      display:flex; align-items:center; gap:10px;
      padding:18px 18px 16px; border-bottom:1px solid var(--border); flex-shrink:0;
    }
    .sb-logo{
      width:32px; height:32px; border-radius:9px;
      background:linear-gradient(135deg,#6366f1,#8b5cf6);
      display:flex; align-items:center; justify-content:center;
      font-size:16px; flex-shrink:0;
    }
    .sb-name{font-size:13.5px;font-weight:800;color:var(--text);line-height:1.2;}
    .sb-sub{font-size:10px;color:var(--text4);margin-top:2px;font-weight:500;}
    .sb-section-label{
      font-size:9px; font-weight:800; text-transform:uppercase;
      letter-spacing:.13em; color:var(--text4);
      padding:16px 18px 8px; flex-shrink:0;
    }
    .sb-tools{display:flex; flex-direction:column; gap:6px; padding:0 12px 10px; flex-shrink:0;}
    .sb-input,.sb-select{
      width:100%; font-size:11px; padding:6px 8px; border-radius:7px;
      background:var(--bg3); border:1px solid var(--border); color:var(--text2); outline:none;
    }
    .sb-input::placeholder{color:var(--text4);}
    .sb-select{cursor:pointer;}
    .sb-scroll{
      flex:1; overflow-y:auto; padding:0 8px 24px;
      scrollbar-width:thin; scrollbar-color:var(--border) transparent;
    }
    .sb-scroll::-webkit-scrollbar{width:4px;}
    .sb-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px;}
    .note-link{
      display:block; padding:9px 10px; border-radius:8px;
      text-decoration:none; margin-bottom:2px;
      border:1px solid transparent; transition:background .12s,border-color .12s;
    }
    .note-link:hover{background:var(--bg3);border-color:var(--border);}
    .note-link.active{background:var(--tag-bg);border-color:var(--border2);}
    .nl-subj{
      font-size:9px; font-weight:700; text-transform:uppercase;
      letter-spacing:.08em; color:var(--accent); margin-bottom:3px;
    }
    .nl-title{
      font-size:12px; font-weight:600; color:var(--text); line-height:1.45;
      display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
    }
    .note-link.active .nl-title{color:var(--tag-text);}
    .nl-date{font-size:10px;color:var(--text4);margin-top:3px;}
    .sb-loading{padding:12px 18px;font-size:12px;color:var(--text4);}

    /* ── Main ─────────────────────────────────────── */
    .main{flex:1;min-width:0;display:flex;flex-direction:column;}

    /* ── Top bar ──────────────────────────────────── */
    .topbar{
      height:52px; display:flex; align-items:center;
      justify-content:space-between; padding:0 36px;
      border-bottom:1px solid var(--border);
      background:var(--bg2); position:sticky; top:0; z-index:50; flex-shrink:0;
    }
    .topbar-left{display:flex;align-items:center;gap:10px;}
    .ham{display:none;background:none;border:none;cursor:pointer;padding:6px;color:var(--text4);font-size:18px;line-height:1;}
    .breadcrumb{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text4);}
    .breadcrumb a{color:var(--accent);text-decoration:none;font-weight:600;}
    .breadcrumb a:hover{text-decoration:underline;}
    .bc-sep{color:var(--border);}
    .bc-cur{color:var(--text3);font-weight:500;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .topbar-right{display:flex;align-items:center;gap:10px;}
    .theme-btn{
      background:var(--bg3); border:1px solid var(--border); border-radius:8px;
      padding:5px 12px; font-size:12px; font-weight:600; color:var(--text3);
      cursor:pointer; display:flex; align-items:center; gap:5px; transition:all .13s;
    }
    .theme-btn:hover{border-color:var(--accent);color:var(--accent);}
    .back-btn{
      text-decoration:none; border-radius:8px; padding:6px 14px;
      font-size:12px; font-weight:700; color:var(--accent);
      border:1px solid var(--border2); background:var(--tag-bg); transition:opacity .13s;
    }
    .back-btn:hover{opacity:.8;}

    /* ── Article ──────────────────────────────────── */
    .article-wrap{padding:52px clamp(24px,5%,80px) 96px;}

    .eyebrow{
      font-size:10px;font-weight:800;text-transform:uppercase;
      letter-spacing:.15em;color:var(--text4);margin-bottom:16px;
    }
    .pub-title{
      font-size:2.9rem;font-weight:900;line-height:1.08;letter-spacing:-.02em;
      background:linear-gradient(135deg,#a5b4fc,#c4b5fd 50%,#f0abfc);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;
      margin-bottom:16px;
    }
    .meta{
      display:flex;align-items:center;gap:8px;
      font-size:12.5px;color:var(--text4);margin-bottom:44px;
    }
    .meta-chip{
      display:inline-flex;align-items:center;
      background:var(--tag-bg);color:var(--tag-text);
      border:1px solid var(--border2);border-radius:999px;
      padding:2px 10px;font-size:11px;font-weight:700;
    }
    .meta-dot{width:3px;height:3px;border-radius:50%;background:var(--border);}

    /* Opening */
    .opening{margin-bottom:52px;}
    .opening p{font-size:21px;line-height:1.9;color:var(--text3);margin-bottom:22px;}
    .opening p:last-child{margin-bottom:0;}

    .divider{height:1px;background:linear-gradient(90deg,transparent,rgba(99,102,241,0.3),transparent);margin:44px 0;}

    /* Subject sections */
    .subject-section{margin-bottom:52px;}
    .subject-heading{
      font-size:1.15rem;font-weight:800;color:var(--text);
      margin-bottom:22px;display:flex;align-items:baseline;gap:10px;line-height:1.35;
      padding-bottom:14px;border-bottom:1px solid var(--border);
    }
    .subject-emoji{font-size:1.2rem;flex-shrink:0;}
    .subject-body p{font-size:21px;line-height:1.9;color:var(--text3);margin-bottom:22px;}
    .subject-body p:last-child{margin-bottom:0;}
    .subject-body strong{color:var(--text2);font-weight:700;}
    .subject-body em{color:#c4b5fd;font-style:italic;}

    /* Closing */
    .closing{
      background:linear-gradient(135deg,rgba(99,102,241,0.07),rgba(139,92,246,0.04));
      border:1px solid var(--border2);border-radius:16px;
      padding:26px 30px;margin-bottom:52px;
    }
    .closing-label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);margin-bottom:12px;}
    .closing p{font-size:20px;line-height:1.9;color:var(--text3);margin-bottom:14px;}
    .closing p:last-child{margin-bottom:0;}

    /* Sec headers */
    .sec-hdr{
      font-size:10px;font-weight:800;text-transform:uppercase;
      letter-spacing:.1em;color:var(--text4);margin-bottom:16px;
      display:flex;align-items:center;gap:8px;
    }
    .sec-hdr::after{content:'';flex:1;height:1px;background:var(--border);}
    .sec-wrap{margin-bottom:32px;}

    /* Key Terms */
    .terms-card{background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:20px 22px;margin-bottom:24px;}
    .card-label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--text4);margin-bottom:14px;}
    .term-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;}
    .term-pill{flex-shrink:0;display:inline-block;padding:3px 12px;border-radius:999px;font-size:12px;font-weight:700;border-width:1px;border-style:solid;}
    .term-def{font-size:17px;color:var(--text4);line-height:1.65;padding-top:2px;}

    /* Quiz */
    .quiz-item{margin-bottom:12px;border:1px solid var(--border2);border-radius:12px;overflow:hidden;}
    .quiz-q{padding:13px 18px;background:rgba(99,102,241,0.08);font-size:17px;font-weight:600;color:#c4b5fd;}
    .quiz-details{background:var(--bg3);}
    .quiz-summary{cursor:pointer;padding:8px 15px;font-size:11px;font-weight:700;color:var(--text4);text-transform:uppercase;letter-spacing:.06em;list-style:none;display:flex;align-items:center;gap:6px;}
    .quiz-summary::-webkit-details-marker{display:none;}
    .quiz-a{padding:12px 18px;font-size:17px;color:#6ee7b7;line-height:1.7;}

    /* Review */
    .review-item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);}
    .review-box{width:18px;height:18px;border:1.5px solid var(--border2);border-radius:4px;flex-shrink:0;display:inline-block;}
    .review-text{font-size:17px;color:var(--text3);}

    /* Raw notes */
    details.raw{background:var(--bg3);border:1px solid var(--border);border-radius:14px;margin-bottom:20px;overflow:hidden;}
    details.raw summary{cursor:pointer;padding:12px 18px;font-size:11px;font-weight:700;color:var(--text4);text-transform:uppercase;letter-spacing:.07em;list-style:none;display:flex;align-items:center;gap:8px;user-select:none;}
    details.raw summary::-webkit-details-marker{display:none;}
    details.raw summary::before{content:'▶';font-size:8px;transition:transform .18s;color:var(--text4);}
    details.raw[open] summary::before{transform:rotate(90deg);}
    .raw-body{padding:16px 20px 20px;border-top:1px solid var(--border);}
    .raw-body p{font-size:17px;color:var(--text4);line-height:1.75;margin-bottom:10px;}
    .raw-body h1,.raw-body h2,.raw-body h3{color:var(--accent);font-size:.95rem;margin:10px 0 5px;}
    .raw-body ul,.raw-body ol{padding-left:16px;color:var(--text4);font-size:17px;margin-bottom:10px;}
    .raw-body li{margin-bottom:3px;}
    .raw-body code{background:rgba(255,255,255,.07);padding:1px 5px;border-radius:4px;font-size:.8em;color:#93c5fd;font-family:monospace;}

    /* AI boxes */
    .ai-box{background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:20px 22px;margin-bottom:16px;}
    .tutor-body{font-size:17px;color:var(--text3);line-height:1.85;}
    .tutor-body strong{color:#c4b5fd;}

    /* Social */
    .social{background:var(--bg2);border:1px solid var(--border2);border-radius:18px;padding:26px;margin-top:32px;}
    .soc-head{display:flex;align-items:center;gap:10px;margin-bottom:16px;}
    .soc-icon-wrap{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;}
    .soc-head h3{font-size:14px;font-weight:800;color:var(--text);}
    .soc-head p{font-size:11px;color:var(--text4);margin-top:1px;}
    .post-card{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:16px;position:relative;}
    .post-text{font-size:14px;line-height:1.75;color:var(--text3);white-space:pre-wrap;padding-right:70px;}
    .cpbtn{position:absolute;top:10px;right:10px;background:rgba(99,102,241,.18);border:1px solid rgba(99,102,241,.35);color:#a5b4fc;border-radius:7px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;transition:all .15s;}
    .cpbtn:hover{background:rgba(99,102,241,.3);}
    .cpbtn.ok{color:#34d399;border-color:rgba(16,185,129,.4);background:rgba(16,185,129,.1);}
    .plat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;}
    .pbtn{display:flex;align-items:center;justify-content:center;gap:7px;padding:9px 10px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;border:none;transition:all .15s;color:#fff;}
    .pbtn:hover{transform:translateY(-1px);filter:brightness(1.12);}
    .p-x{background:#000;border:1px solid #2d2d2d;}.p-fb{background:#1877f2;}
    .p-ig{background:linear-gradient(135deg,#f58529,#dd2a7b,#8134af);}
    .p-tt{background:#010101;border:1px solid #2d2d2d;}.p-th{background:#111;border:1px solid #2d2d2d;}
    .copy-hint{font-size:10.5px;color:var(--text4);margin-top:10px;text-align:center;}

    /* Footer */
    .article-footer{margin-top:52px;padding-top:20px;border-top:1px solid var(--border);display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;}
    .brand{font-size:12px;font-weight:800;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
    .slug-txt{font-family:monospace;font-size:10px;color:var(--text4);}

    /* Sidebar overlay */
    .sb-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99;}

    /* Responsive */
    @media(max-width:960px){
      .sidebar{position:fixed;left:-280px;top:0;height:100%;transition:left .22s ease;z-index:200;box-shadow:4px 0 24px rgba(0,0,0,.55);}
      .sidebar.open{left:0;}
      .sb-overlay.open{display:block;}
      .ham{display:flex;}
      .article-wrap{padding:36px 24px 72px;}
      .pub-title{font-size:2rem;}
      .opening p,.subject-body p{font-size:18px;}
      .closing p{font-size:17px;}
    }
    @media(max-width:600px){
      .topbar{padding:0 16px;}
      .back-btn{display:none;}
      .article-wrap{padding:24px 16px 56px;}
      .plat-grid{grid-template-columns:1fr 1fr;}
      .pub-title{font-size:1.65rem;}
      .opening p,.subject-body p{font-size:16px;}
      .closing p{font-size:15.5px;}
      .term-def,.review-text,.quiz-q,.quiz-a,.tutor-body{font-size:15px;}
    }
    body{overflow-x:hidden;}
    /* KaTeX math display overrides */
    .katex-display{overflow-x:auto;overflow-y:hidden;padding:6px 0;}
    .katex{font-size:1.05em;color:inherit;}
  </style>
  <!-- KaTeX math rendering -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
</head>
<body>
  <div class="sb-overlay" id="overlay" onclick="closeSidebar()"></div>

  <!-- Left sidebar -->
  <aside class="sidebar" id="sidebar">
    <a href="/" class="sb-brand" title="Go to CogniBloom home" style="text-decoration:none;">
      <div class="sb-logo">✨</div>
      <div>
        <div class="sb-name">CogniBloom</div>
        <div class="sb-sub">Daniel's Learning Diary</div>
      </div>
    </a>
    <div class="sb-section-label">All Entries</div>
    <div class="sb-tools">
      <input id="nl-search" class="sb-input" type="text" placeholder="Filter entries…" oninput="renderList()" />
      <select id="nl-subject" class="sb-select" onchange="renderList()"><option value="">All subjects</option></select>
      <select id="nl-sort" class="sb-select" onchange="renderList()">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="az">Title A–Z</option>
      </select>
    </div>
    <div class="sb-scroll" id="note-list">
      <div class="sb-loading">Loading entries…</div>
    </div>
  </aside>

  <!-- Main area -->
  <div class="main">

    <!-- Top bar -->
    <div class="topbar">
      <div class="topbar-left">
        <button class="ham" onclick="toggleSidebar()">☰</button>
        <nav class="breadcrumb">
          <a href="/dashboard/notes/archive">Archive</a>
          <span class="bc-sep">/</span>
          <span class="bc-cur">${safeTitle}</span>
        </nav>
      </div>
      <div class="topbar-right">
        <button class="theme-btn" id="themeBtn" onclick="toggleTheme()">☀ Light</button>
        <a href="/dashboard/notes/archive" class="back-btn">← All entries</a>
      </div>
    </div>

    <!-- Article -->
    <div class="article-wrap">
      <div class="eyebrow">Daniel's Learning Diary · CogniBloom · ${date}</div>
      <h1 class="pub-title">${safeTitle}</h1>
      <div class="meta">
        <span>📅 ${date}</span>
        ${safeSubject ? `<span class="meta-dot"></span><span class="meta-chip">${safeSubject}</span>` : ''}
      </div>

      <!-- Opening Hook -->
      <div class="opening">${safeOpening}</div>

      <div class="divider"></div>

      <!-- Subject Sections -->
      ${subjectSectionsHtml}

      <!-- Big Ideas -->
      ${bigIdeasHtml ? `<div class="ai-box"><div class="card-label" style="margin-bottom:12px;">💡 The Big Ideas Hidden Inside</div>${bigIdeasHtml}</div>` : ''}

      <!-- Topic-Based Learning Tips -->
      ${learningTipsHtml ? `<div class="terms-card"><div class="card-label">🎯 Topic-Based Learning Tips</div>${learningTipsHtml}</div>` : ''}

      <!-- Mistakes, Confusions & Aha Moments -->
      ${mistakesHtml ? `<div class="ai-box"><div class="card-label" style="margin-bottom:12px;">🔁 Mistakes, Confusions &amp; Aha Moments</div>${mistakesHtml}</div>` : ''}

      <!-- Connect the Dots -->
      ${connectionsHtml ? `<div class="terms-card"><div class="card-label">🔗 Connect the Dots</div>${connectionsHtml}</div>` : ''}

      <!-- Closing -->
      <div class="closing">
        <div class="closing-label">What Today Added Up To</div>
        ${safeClosing}
      </div>

      <!-- Key Terms -->
      ${termPillsHtml ? `<div class="terms-card"><div class="card-label">🔑 Key Terms</div>${termPillsHtml}</div>` : ''}

      <!-- Self-Quiz -->
      ${selfQuizHtml ? `<div class="sec-wrap"><div class="sec-hdr">🧠 Reasoning Workout</div>${selfQuizHtml}</div>` : ''}

      <!-- Review Tomorrow -->
      ${reviewHtml ? `<div class="terms-card"><div class="card-label">📋 Review Tomorrow</div>${reviewHtml}</div>` : ''}

      <!-- Try This Next -->
      ${tryThisNextHtml ? `<div class="ai-box"><div class="card-label" style="margin-bottom:12px;">🚀 Try This Next</div>${tryThisNextHtml}</div>` : ''}


      <!-- AI Tutor Summary -->
      ${safeSummary ? `<div class="ai-box"><div class="card-label" style="margin-bottom:10px;">✨ AI Tutor Summary</div><div class="tutor-body">${safeSummary}</div></div>` : ''}

      <!-- Reasoning Hints -->
      ${reasoningHtml ? `<div class="ai-box"><div class="card-label" style="margin-bottom:10px;">🧠 Reasoning Logic</div>${reasoningHtml}</div>` : ''}

      <!-- Mind Map -->
      ${mindMapHtml ? `<div class="ai-box"><div class="card-label" style="margin-bottom:10px;">🗺️ Mind Map</div>${mindMapHtml}</div>` : ''}

      <!-- Social Share -->
      <div class="social">
        <div class="soc-head">
          <div class="soc-icon-wrap">📱</div>
          <div><h3>Share What I Learned</h3><p>Inspire someone with your progress</p></div>
        </div>
        <div class="post-card">
          <div class="post-text" id="spt">${safeSocial}</div>
          <button class="cpbtn" id="cpbtn" onclick="copyPost()">Copy</button>
        </div>
        <div class="plat-grid">
          <button class="pbtn p-x"  onclick="shareX()">${xSvg} X</button>
          <button class="pbtn p-fb" onclick="shareFB()">${fbSvg} Facebook</button>
          <button class="pbtn p-ig" onclick="copyFor(this)">${igSvg} Instagram</button>
          <button class="pbtn p-tt" onclick="copyFor(this)">${ttSvg} TikTok</button>
          <button class="pbtn p-th" onclick="shareTH()">${thSvg} Threads</button>
        </div>
        <p class="copy-hint">Instagram &amp; TikTok: copies caption → paste in your post</p>
        ${socialVariantsHtml ? `<div style="margin-top:14px;"><div class="card-label" style="margin-bottom:6px;">✍️ Ready-to-Post Captions</div>${socialVariantsHtml}</div>` : ''}
      </div>

      <div class="article-footer">
        <span class="brand">CogniBloom — Daniel's Learning Platform</span>
        <span class="slug-txt">${safeSlug}</span>
      </div>
    </div>
  </div>

<script>
(function(){
  // ── Social share ────────────────────────────────
  var T=function(){return document.getElementById('spt').textContent.trim();};
  var U=function(){return window.location.href;};
  var clip=function(s,cb){
    if(navigator.clipboard){navigator.clipboard.writeText(s).then(cb).catch(fb);}
    else{fb();}
    function fb(){var t=document.createElement('textarea');t.value=s;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);cb();}
  };
  var flash=function(el,lbl){var o=el.textContent;el.textContent=lbl;el.classList.add('ok');setTimeout(function(){el.textContent=o;el.classList.remove('ok');},2000);};
  window.copyPost=function(){clip(T()+'\\n\\n'+U(),function(){flash(document.getElementById('cpbtn'),'✓ Copied!');});};
  window.copyFor=function(el){clip(T()+'\\n\\n'+U(),function(){flash(el,'✓ Copied!');});};
  window.shareX=function(){window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(T()+'\\n\\n')+'&url='+encodeURIComponent(U()),'_blank','width=600,height=480');};
  window.shareFB=function(){window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(U()),'_blank','width=600,height=480');};
  window.shareTH=function(){window.open('https://www.threads.net/intent/post?text='+encodeURIComponent(T()+'\\n\\n'+U()),'_blank','width=600,height=560');};

  // ── Dark / Light toggle ─────────────────────────
  window.toggleTheme=function(){
    var html=document.documentElement;
    var dark=html.getAttribute('data-theme')==='dark';
    html.setAttribute('data-theme',dark?'light':'dark');
    document.getElementById('themeBtn').textContent=dark?'🌙 Dark':'\u2600 Light';
    try{localStorage.setItem('cogni-theme',dark?'light':'dark');}catch(e){}
  };
  (function(){
    try{
      var saved=localStorage.getItem('cogni-theme');
      if(saved==='light'){
        document.documentElement.setAttribute('data-theme','light');
        document.getElementById('themeBtn').textContent='🌙 Dark';
      }
    }catch(e){}
  })();

  // ── Mobile sidebar ──────────────────────────────
  window.toggleSidebar=function(){
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('open');
  };
  window.closeSidebar=function(){
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('open');
  };

  // ── Sidebar note list (filter + sort) ───────────
  var currentSlug='${safeSlug}';
  var ALL=[];
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function fmtDate(iso){if(!iso)return'';try{return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}catch(e){return'';}}
  function ts(n){return new Date(n.publishedAt||n.createdAt||0).getTime()||0;}
  window.renderList=function(){
    var list=document.getElementById('note-list');
    if(!list)return;
    var qEl=document.getElementById('nl-search');
    var subjEl=document.getElementById('nl-subject');
    var sortEl=document.getElementById('nl-sort');
    var q=(qEl&&qEl.value?qEl.value:'').toLowerCase().trim();
    var subj=subjEl&&subjEl.value?subjEl.value:'';
    var sort=sortEl&&sortEl.value?sortEl.value:'newest';
    var rows=ALL.filter(function(n){
      if(subj&&(n.subject||'')!==subj)return false;
      if(!q)return true;
      var hay=((n.title||'')+' '+(n.subject||'')+' '+((n.tags||[]).join(' '))).toLowerCase();
      return hay.indexOf(q)>=0;
    });
    rows.sort(function(a,b){
      if(sort==='az')return (a.title||'').localeCompare(b.title||'');
      return sort==='oldest'?ts(a)-ts(b):ts(b)-ts(a);
    });
    if(!rows.length){list.innerHTML='<div class="sb-loading">No matching entries.</div>';return;}
    list.innerHTML=rows.map(function(n){
      var active=n.publishedSlug===currentSlug?' active':'';
      var subj2=n.subject?'<div class="nl-subj">'+esc(n.subject)+'</div>':'';
      var slug2=n.publishedSlug?esc(n.publishedSlug):'';
      return '<a href="/notes/view/'+slug2+'" class="note-link'+active+'">'+subj2+
        '<div class="nl-title">'+esc(n.title||'Untitled')+'</div>'+
        '<div class="nl-date">'+fmtDate(n.publishedAt||n.createdAt)+'</div></a>';
    }).join('');
  };
  function fillSubjects(){
    var sel=document.getElementById('nl-subject');
    if(!sel)return;
    var seen={},opts='<option value="">All subjects</option>';
    ALL.forEach(function(n){var s=n.subject;if(s&&!seen[s]){seen[s]=1;opts+='<option value="'+esc(s)+'">'+esc(s)+'</option>';}});
    sel.innerHTML=opts;
  }
  window.loadSidebar=function(isRetry){
    var list=document.getElementById('note-list');
    if(!list)return;
    if(!isRetry)list.innerHTML='<div class="sb-loading">Loading entries…</div>';
    var ctrl=new AbortController();
    var timer=setTimeout(function(){ctrl.abort();},30000);
    fetch('/api/notes/published',{signal:ctrl.signal})
      .then(function(r){clearTimeout(timer);if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
      .then(function(res){
        if(!res||!res.success||!Array.isArray(res.data))throw new Error('Bad response');
        ALL=res.data;
        fillSubjects();
        window.renderList();
      })
      .catch(function(e){
        clearTimeout(timer);
        var msg=e&&e.name==='AbortError'?'Timed out':(e&&e.message?e.message.slice(0,60):'Network error');
        if(list)list.innerHTML='<div class="sb-loading" style="color:#fb7185;font-size:11px;">'+msg+'<br><button onclick="loadSidebar(true)" style="margin-top:8px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;border-radius:6px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;display:block;">Retry</button></div>';
      });
  };
  window.loadSidebar(false);
  // ── KaTeX math render ───────────────────────────────────
  function _tryKatex(){
    if(window.renderMathInElement){
      renderMathInElement(document.body,{
        delimiters:[
          {left:'$$',right:'$$',display:true},
          {left:'$',right:'$',display:false},
          {left:'\\(',right:'\\)',display:false},
          {left:'\\[',right:'\\]',display:true}
        ],
        throwOnError:false,
        ignoredTags:['script','noscript','style','textarea','pre','code','button']
      });
    } else {
      setTimeout(_tryKatex,120);
    }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',_tryKatex);
  } else {
    _tryKatex();
  }
})();
</script>
</body>
</html>`
}


// ── POST /api/notes/[noteId]/publish ─────────────────────────────────────────

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { noteId } = await params
    const userId = DANIEL_USER_ID
    const note = await db.note.findFirst({ where: { id: noteId, userId } })
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    const slug = note.publishedSlug ?? await generateSlug(note.subject, note.createdAt)
    const noteBase = { title: note.title, subject: note.subject, tutorSummary: note.tutorSummary, content: note.content, knowledgePoints: note.knowledgePoints }
    const pageBase = { originalTitle: note.title, subject: note.subject, originalContent: note.content, tutorSummary: note.tutorSummary, knowledgePoints: note.knowledgePoints, mindMap: note.mindMap, reasoningHints: note.reasoningHints, publishedSlug: slug, createdAt: note.createdAt }

    // ── Unified Learning Chronicle writer for ALL note types ──
    let storedWriter: WriterOutput | null = null
    if (note.writerJson) {
      try { storedWriter = JSON.parse(note.writerJson) as WriterOutput } catch { /* ignore */ }
    }
    const writer = await generateWriterContent(noteBase, storedWriter)
    const publishedHtml = buildPublishedPage({ ...pageBase, writer })
    const publishTitle = writer.publishTitle
    await db.note.update({
      where: { id: noteId },
      data: { publishedHtml, publishedSlug: slug, publishedAt: new Date(), writerJson: JSON.stringify(writer) },
    })

    const updated = await db.note.findFirst({ where: { id: noteId }, select: { publishedSlug: true, publishedAt: true } })
    return NextResponse.json({
      success: true,
      data: { slug: updated?.publishedSlug, publishedAt: updated?.publishedAt, url: `/notes/view/${slug}`, publishTitle },
    })
  } catch (err) {
    const e = err as { message?: string; userMessage?: string }
    if (e?.message === 'NOTE_TOO_EMPTY') {
      return NextResponse.json({ error: e.userMessage ?? 'Note has too little content to publish.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Publish failed' }, { status: 500 })
  }
}

// ── DELETE /api/notes/[noteId]/publish ───────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { noteId } = await params
    const note = await db.note.findFirst({
      where: { id: noteId, userId: DANIEL_USER_ID },
      select: { id: true },
    })
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    await db.note.update({
      where: { id: noteId },
      data: { publishedHtml: null, publishedSlug: null, publishedAt: null },
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── GET /api/notes/[noteId]/publish ──────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { noteId } = await params
    const note = await db.note.findFirst({
      where: { id: noteId, userId: DANIEL_USER_ID },
      select: { publishedSlug: true, publishedAt: true },
    })
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    return NextResponse.json({
      success: true,
      data: { slug: note.publishedSlug, publishedAt: note.publishedAt, url: note.publishedSlug ? `/notes/view/${note.publishedSlug}` : null },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
