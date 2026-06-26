import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { chatWithFallback } from '@/lib/ai/fallback'

export const maxDuration = 60

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
  /^check the boxes you worked on/i,
  /^fill this out at the end/i,
  /^keep answers short and honest/i,
  /^copy this file and rename/i,
  /^write the question[,\s]/i,
  /^the real reason \(rushed/i,
  /^be specific\s*[—-]/i,
  /^save these for a parent/i,
  /^how does today link/i,
  /^something i.m proud of/i,
  /^a few sentences describing/i,
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

interface WriterOutput {
  publishTitle: string
  openingHook: string           // 2-4 sentences, scene-setting, never "Today I learned..."
  subjectSections: SubjectSection[]
  closingSection: string        // 3-5 sentence synthesis connecting subjects
  keyTerms: Array<{ term: string; definition: string; color: string }>
  selfQuiz: Array<{ question: string; answer: string }>
  reviewTomorrow: string[]
  socialPost: string            // max 250 chars, genuine teen voice
}

// ── Title pattern tracker (in-process rotation only) ─────────────────────────
let lastTitlePattern = 0

// ── AI Writer ─────────────────────────────────────────────────────────────────

async function generateWriterContent(note: {
  title: string
  subject: string | null
  tutorSummary: string | null
  content: string
  knowledgePoints: string | null
}): Promise<WriterOutput> {
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

  const titlePatterns = `
Pattern A — Two big ideas + one human anchor: "Gauss, Fibonacci, and a $5 Bet on the Future"
Pattern B — One concept + its implication: "The Only Even Prime and Why That Changes Everything"
Pattern C — A surprising contrast: "While True: Runs Forever. The Vocab Test Did Not."
Pattern D — A question from the day: "What Does a Flipped Sequence Actually Cost You?"
Pattern E — A vivid moment: "The Day the Pairing Trick Changed Addition Forever"
Pattern F — A concept name used poetically: "Indefinite Loops and the Interminable Beauty of Fibonacci"
Today, use Pattern ${lastTitlePattern}.`

  const prompt = `You are a professional writer and expert educator producing a published daily learning diary entry for Daniel, a motivated student.

─── DANIEL'S RAW NOTES ───────────────────────────────────────────────────────
Note title: ${note.title}
Subject area: ${note.subject ?? 'Multiple subjects'}

${rawContent}${aiContext}
──────────────────────────────────────────────────────────────────────────────

Your job is to transform these raw notes into a polished, story-driven piece that Daniel would be proud to publish. This is NOT a summary. It is literary, intellectually serious, and human.

━━ TITLE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Title rotation patterns (use the assigned one):
${titlePatterns}

Rule: The title must name the actual intellectual content — a concept, a breakthrough, a vivid moment. It must be specific enough that it could not describe any other day.
NEVER: "Math Reflection" / "Today's Learning" / "A Productive Study Session"
Max 95 characters.

━━ OPENING HOOK (openingHook) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2–4 sentences. Set the human scene before any academic content. Reference the energy/focus level of the day without being clinical. Use one vivid specific detail. The reader should feel the texture of the day before they learn anything.
NEVER open with "Today I learned…" or "In today's session…"
GOOD: "I wasn't running at full speed today — energy at a 3, focus holding at a 4. But I showed up for five subjects, passed a vocabulary test, and made my first real investment before the day was over."

━━ SUBJECT SECTIONS (subjectSections) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write one section per subject Daniel actually worked on. Skip subjects with no real content.

For each section:
- "emoji": single emoji that fits the subject (🔢 math, 💻 coding, 📖 vocabulary, 🌍 language, ∞ or 🏛️ theory, 💰 finance/real life, etc.)
- "subjectTitle": "SubjectName — A Short Vivid Description of What Happened" (NOT just the subject name)
  Example: "Math — The Sequence That Flipped and Fooled Me" (NOT "Math")
- "body": 2–4 paragraphs of flowing prose. Rules for body:
  * Use your expert knowledge to explain concepts deeply and correctly — if Daniel's understanding is partial or slightly off, write the correct version gently, without calling it out
  * Treat every concept as genuinely interesting. Find the elegance in math. Connect code to real-world use. Bring vocabulary words alive with scenes. Find structures hiding inside language phrases.
  * For any mistake Daniel made: name it specifically ("I read the sequence backwards — and then swapped the digits on top of that. Two errors folded into one wrong answer. Not a knowledge gap. A reading gap.") and state the lesson clearly
  * For any open question: treat it as an intellectual cliffhanger, not a gap to apologize for
  * Use <strong> for exactly ONE key insight per section — the thing worth remembering
  * Use <em> for emphasis within a sentence, or vocabulary words on first use
  * NO bullet points inside the body. No lists. Pure prose.
  * Vary sentence length: short sentences land hard after longer ones
  * Tone by subject type:
    - Math / Number Theory: precise but warm; show WHY the rule works, not just what it is; find the elegance
    - Coding / Programming: concrete and mechanical, but connect to what it unlocks in the real world
    - Vocabulary: bring words alive with context and scenes, not just definitions
    - Language learning: notice structures and patterns hiding inside phrases, not just words
    - Science / History / Other: lead with the most surprising or counterintuitive idea
    - Finance / Real life: connect to bigger thinking about the future

━━ CLOSING SECTION (closingSection) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3–5 sentences that synthesize the whole day. Connect at least two subjects to each other if possible. End with something specific — the small win, a decision, a moment of pride — without being sentimental. 
NEVER end with "Overall it was a great day." End with something real and specific.

━━ KEY TERMS (keyTerms) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3–6 terms from today's learning. Write definitions the way a brilliant teacher would explain them in one sentence — precise AND memorable, not dictionary-style.
COLOR options: "violet", "emerald", "amber", "sky", "rose"

━━ SELF-QUIZ (selfQuiz) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2–4 questions that test genuine understanding, not surface recall. Answers should be mini-explanations.

━━ REVIEW TOMORROW (reviewTomorrow) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2–4 specific items worth revisiting. Concrete, not vague.

━━ SOCIAL POST (socialPost) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HARD LIMIT: 250 characters including hashtags. Lead with the most surprising specific from the day. Include one concrete fact or number if possible. 1–3 hashtags max. Sound genuine, not performative — like a teen who's actually proud of something they figured out, not marketing copy.

Return ONLY this JSON (no markdown fences, no preamble, no trailing text):
{
  "publishTitle": "...",
  "openingHook": "...",
  "subjectSections": [
    { "emoji": "🔢", "subjectTitle": "Math — ...", "body": "paragraph 1\\n\\nparagraph 2\\n\\nparagraph 3" }
  ],
  "closingSection": "...",
  "keyTerms": [
    { "term": "...", "definition": "...", "color": "violet" }
  ],
  "selfQuiz": [
    { "question": "...", "answer": "..." }
  ],
  "reviewTomorrow": ["...", "..."],
  "socialPost": "..."
}`

  const defaults: WriterOutput = {
    publishTitle: note.title,
    openingHook: `The day started slow, but the ideas came anyway.`,
    subjectSections: [{
      emoji: '📚',
      subjectTitle: `${note.subject ?? 'Study Session'} — Notes from Today`,
      body: htmlToText(note.content).slice(0, 600),
    }],
    closingSection: `Every session adds something. Today was no different.`,
    keyTerms: [],
    selfQuiz: [],
    reviewTomorrow: [],
    socialPost: `learning something new every day 🧠 #studentlife #CogniBloom`,
  }

  try {
    const res = await chatWithFallback({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.75,
      maxTokens: 4000,
    })
    const parsed = JSON.parse(extractJSON(res.content)) as Partial<WriterOutput>

    return {
      publishTitle:    (typeof parsed.publishTitle === 'string' && parsed.publishTitle.trim()) ? parsed.publishTitle.trim() : defaults.publishTitle,
      openingHook:     (typeof parsed.openingHook === 'string' && parsed.openingHook.trim())   ? parsed.openingHook.trim() : defaults.openingHook,
      subjectSections: Array.isArray(parsed.subjectSections) && parsed.subjectSections.length  ? parsed.subjectSections   : defaults.subjectSections,
      closingSection:  (typeof parsed.closingSection === 'string' && parsed.closingSection.trim()) ? parsed.closingSection.trim() : defaults.closingSection,
      keyTerms:        Array.isArray(parsed.keyTerms)     ? parsed.keyTerms     : defaults.keyTerms,
      selfQuiz:        Array.isArray(parsed.selfQuiz)     ? parsed.selfQuiz     : defaults.selfQuiz,
      reviewTomorrow:  Array.isArray(parsed.reviewTomorrow) ? parsed.reviewTomorrow : defaults.reviewTomorrow,
      socialPost:      (typeof parsed.socialPost === 'string' && parsed.socialPost.trim()) ? parsed.socialPost.trim() : defaults.socialPost,
    }
  } catch {
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
  // Split on double newlines into paragraphs
  return body
    .split(/\n\n+/)
    .map(para => {
      const p = para.trim()
      if (!p) return ''
      // Allow <strong> and <em> only; escape everything else
      const safe = p
        .replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g, '&amp;')
        .replace(/<(?!\/?(?:strong|em)\s*>)/g, '&lt;')
      return `<p>${safe}</p>`
    })
    .filter(Boolean)
    .join('\n')
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
        <span style="font-size:13.5px;line-height:1.6;color:#94a3b8;padding-top:3px;">${escapeHtml(h.hint)}</span>
      </div>`).join('')
  } catch { /* */ }

  const safeTitle       = escapeHtml(writer.publishTitle)
  const safeSlug        = escapeHtml(note.publishedSlug)
  const safeOpening     = writer.openingHook.split(/\n+/).map(p => `<p>${escapeHtml(p.trim())}</p>`).filter(p => p !== '<p></p>').join('\n')
  const safeClosing     = writer.closingSection.split(/\n+/).map(p => `<p>${escapeHtml(p.trim())}</p>`).filter(p => p !== '<p></p>').join('\n')
  const safeOrigContent = sanitizeRichHtml(note.originalContent)
  const safeSummary     = note.tutorSummary ? sanitizeRichHtml(note.tutorSummary) : null
  const safeSocial      = escapeHtml(writer.socialPost)

  const xSvg  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.631L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>`
  const fbSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.411c0-3.025 1.791-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.971h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>`
  const igSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>`
  const ttSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.2 8.2 0 004.79 1.53V6.75a4.85 4.85 0 01-1.02-.06z"/></svg>`
  const thSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.5 12.069V12c.024-3.506.906-6.346 2.621-8.44C5.854 1.338 8.496.024 11.988 0h.013c2.7.016 4.987.758 6.787 2.205 1.72 1.385 2.768 3.24 3.116 5.515l-2.898.53c-.287-1.67-.971-3.027-2.033-4.033-1.11-1.05-2.65-1.603-4.574-1.632H12.1c-2.59.034-4.567.941-5.881 2.695C5.127 6.718 4.5 8.9 4.48 11.996v.07c.02 3.1.647 5.285 1.74 6.729 1.315 1.752 3.294 2.66 5.882 2.694h.08c2.19-.027 3.77-.517 4.879-1.496.985-.864 1.597-2.15 1.82-3.821l2.898.53c-.292 2.36-1.2 4.2-2.69 5.47-1.637 1.39-3.848 2.11-6.594 2.118h-.31z"/></svg>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle} — Daniel's Learning Diary</title>
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:type" content="article">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #060c18; color: #e2e8f0; min-height: 100vh; }
    .page { max-width: 720px; margin: 0 auto; padding: 52px 24px 100px; }

    /* Header */
    .eyebrow { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .14em; color: #374151; margin-bottom: 14px; }
    .pub-title { font-size: 2.15rem; font-weight: 900; line-height: 1.12; background: linear-gradient(135deg,#a5b4fc,#c4b5fd 50%,#f0abfc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 12px; }
    .meta { font-size: 11px; color: #374151; margin-bottom: 36px; }

    /* Opening hook */
    .opening { margin-bottom: 44px; }
    .opening p { font-size: 17px; line-height: 1.85; color: #cbd5e1; margin-bottom: 14px; }
    .opening p:last-child { margin-bottom: 0; }

    /* Divider */
    .divider { height: 1px; background: linear-gradient(90deg, transparent, rgba(99,102,241,0.3), transparent); margin: 36px 0; }

    /* Subject sections */
    .subject-section { margin-bottom: 44px; }
    .subject-heading { font-size: 1.1rem; font-weight: 800; color: #e2e8f0; margin-bottom: 18px; display: flex; align-items: baseline; gap: 10px; line-height: 1.3; }
    .subject-emoji { font-size: 1.3rem; flex-shrink: 0; }
    .subject-body p { font-size: 15.5px; line-height: 1.85; color: #94a3b8; margin-bottom: 16px; }
    .subject-body p:last-child { margin-bottom: 0; }
    .subject-body strong { color: #e2e8f0; font-weight: 700; }
    .subject-body em { color: #c4b5fd; font-style: italic; }

    /* Closing */
    .closing { background: linear-gradient(135deg, rgba(99,102,241,0.07), rgba(139,92,246,0.04)); border: 1px solid rgba(99,102,241,0.15); border-radius: 16px; padding: 22px 26px; margin-bottom: 44px; }
    .closing-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: #6366f1; margin-bottom: 10px; }
    .closing p { font-size: 15px; line-height: 1.8; color: #cbd5e1; margin-bottom: 10px; }
    .closing p:last-child { margin-bottom: 0; }

    /* Section headers */
    .sec-hdr { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: #475569; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .sec-hdr::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,.06); }
    .sec-wrap { margin-bottom: 32px; }

    /* Key Terms */
    .terms-card { background: rgba(255,255,255,.02); border: 1px solid rgba(255,255,255,.07); border-radius: 14px; padding: 18px 20px; margin-bottom: 24px; }
    .card-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: #475569; margin-bottom: 14px; }
    .term-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
    .term-pill { flex-shrink: 0; display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; border-width: 1px; border-style: solid; }
    .term-def { font-size: 13.5px; color: #94a3b8; line-height: 1.6; padding-top: 2px; }

    /* Self Quiz */
    .quiz-item { margin-bottom: 14px; border: 1px solid rgba(99,102,241,.2); border-radius: 12px; overflow: hidden; }
    .quiz-q { padding: 10px 14px; background: rgba(99,102,241,.08); font-size: 13px; font-weight: 600; color: #c4b5fd; }
    .quiz-details { background: rgba(0,0,0,.1); }
    .quiz-summary { cursor: pointer; padding: 8px 14px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .06em; list-style: none; display: flex; align-items: center; gap: 6px; }
    .quiz-summary::-webkit-details-marker { display: none; }
    .quiz-a { padding: 10px 14px; font-size: 13px; color: #6ee7b7; line-height: 1.6; }

    /* Review */
    .review-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.04); }
    .review-box { width: 18px; height: 18px; border: 1px solid rgba(99,102,241,.4); border-radius: 4px; flex-shrink: 0; display: inline-block; }
    .review-text { font-size: 13px; color: #94a3b8; }

    /* Collapsible raw notes */
    details.raw { background: rgba(255,255,255,.01); border: 1px solid rgba(255,255,255,.06); border-radius: 14px; margin-bottom: 20px; overflow: hidden; }
    details.raw summary { cursor: pointer; padding: 12px 18px; font-size: 11px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: .07em; list-style: none; display: flex; align-items: center; gap: 8px; user-select: none; }
    details.raw summary::-webkit-details-marker { display: none; }
    details.raw summary::before { content: '▶'; font-size: 8px; transition: transform .18s; color: #374151; }
    details.raw[open] summary::before { transform: rotate(90deg); }
    .raw-body { padding: 16px 20px 20px; border-top: 1px solid rgba(255,255,255,.05); }
    .raw-body p { font-size: 13px; color: #475569; line-height: 1.7; margin-bottom: 8px; }
    .raw-body h1,.raw-body h2,.raw-body h3 { color: #6366f1; font-size: .95rem; margin: 10px 0 5px; }
    .raw-body ul,.raw-body ol { padding-left: 16px; color: #475569; font-size: 13px; margin-bottom: 8px; }
    .raw-body li { margin-bottom: 3px; }
    .raw-body code { background: rgba(255,255,255,.07); padding: 1px 5px; border-radius: 4px; font-size: .8em; color: #93c5fd; font-family: monospace; }

    /* AI boxes */
    .ai-box { background: rgba(255,255,255,.02); border: 1px solid rgba(255,255,255,.07); border-radius: 14px; padding: 18px 20px; margin-bottom: 16px; }
    .tutor-body { font-size: 13.5px; color: #94a3b8; line-height: 1.8; }
    .tutor-body strong { color: #c4b5fd; }

    /* Social */
    .social { background: linear-gradient(135deg,rgba(15,23,42,.95),rgba(30,27,75,.8)); border: 1px solid rgba(99,102,241,.2); border-radius: 18px; padding: 24px; margin-top: 28px; }
    .soc-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
    .soc-icon-wrap { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg,#6366f1,#8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; }
    .soc-head h3 { font-size: 14px; font-weight: 800; color: #e2e8f0; }
    .soc-head p { font-size: 11px; color: #475569; margin-top: 1px; }
    .post-card { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07); border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; position: relative; }
    .post-text { font-size: 13.5px; line-height: 1.7; color: #cbd5e1; white-space: pre-wrap; padding-right: 70px; }
    .cpbtn { position: absolute; top: 10px; right: 10px; background: rgba(99,102,241,.18); border: 1px solid rgba(99,102,241,.35); color: #a5b4fc; border-radius: 7px; padding: 3px 10px; font-size: 11px; font-weight: 700; cursor: pointer; transition: all .15s; }
    .cpbtn:hover { background: rgba(99,102,241,.3); }
    .cpbtn.ok { color: #34d399; border-color: rgba(16,185,129,.4); background: rgba(16,185,129,.1); }
    .plat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px,1fr)); gap: 8px; }
    .pbtn { display: flex; align-items: center; justify-content: center; gap: 7px; padding: 9px 10px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; border: none; transition: all .15s; color: #fff; }
    .pbtn:hover { transform: translateY(-1px); filter: brightness(1.12); }
    .p-x  { background: #000; border: 1px solid #2d2d2d; }
    .p-fb { background: #1877f2; }
    .p-ig { background: linear-gradient(135deg,#f58529,#dd2a7b,#8134af); }
    .p-tt { background: #010101; border: 1px solid #2d2d2d; }
    .p-th { background: #111; border: 1px solid #2d2d2d; }
    .copy-hint { font-size: 10.5px; color: #374151; margin-top: 10px; text-align: center; }

    footer { margin-top: 44px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,.05); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
    .brand { font-size: 12px; font-weight: 800; background: linear-gradient(135deg,#6366f1,#8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .slug-txt { font-family: monospace; font-size: 10px; color: #374151; }

    @media(max-width:600px) {
      .pub-title { font-size: 1.7rem; }
      .plat-grid { grid-template-columns: 1fr 1fr; }
      .page { padding: 32px 16px 80px; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="eyebrow">Daniel's Learning Diary · CogniBloom · ${date}</div>
  <h1 class="pub-title">${safeTitle}</h1>
  <div class="meta">📅 ${date}</div>

  <!-- Opening Hook -->
  <div class="opening">
    ${safeOpening}
  </div>

  <div class="divider"></div>

  <!-- Subject Sections -->
  ${subjectSectionsHtml}

  <!-- Closing Synthesis -->
  <div class="closing">
    <div class="closing-label">What Today Added Up To</div>
    ${safeClosing}
  </div>

  <!-- Key Terms -->
  ${termPillsHtml ? `<div class="terms-card">
    <div class="card-label">🔑 Key Terms</div>
    ${termPillsHtml}
  </div>` : ''}

  <!-- Self-Quiz -->
  ${selfQuizHtml ? `<div class="sec-wrap">
    <div class="sec-hdr">❓ Self-Check Quiz</div>
    ${selfQuizHtml}
  </div>` : ''}

  <!-- Review Tomorrow -->
  ${reviewHtml ? `<div class="terms-card">
    <div class="card-label">📋 Review Tomorrow</div>
    ${reviewHtml}
  </div>` : ''}

  <!-- Original Notes -->
  <details class="raw">
    <summary>📓 Original Study Notes</summary>
    <div class="raw-body">${safeOrigContent}</div>
  </details>

  <!-- AI Tutor Summary -->
  ${safeSummary ? `<div class="ai-box">
    <div class="card-label" style="margin-bottom:10px;">✨ AI Tutor Summary</div>
    <div class="tutor-body">${safeSummary}</div>
  </div>` : ''}

  <!-- Reasoning Hints -->
  ${reasoningHtml ? `<div class="ai-box">
    <div class="card-label" style="margin-bottom:10px;">🧠 Reasoning Logic</div>
    ${reasoningHtml}
  </div>` : ''}

  <!-- Mind Map -->
  ${mindMapHtml ? `<div class="ai-box">
    <div class="card-label" style="margin-bottom:10px;">🗺️ Mind Map</div>
    ${mindMapHtml}
  </div>` : ''}

  <!-- Social Share -->
  <div class="social">
    <div class="soc-head">
      <div class="soc-icon-wrap">📱</div>
      <div>
        <h3>Share What I Learned</h3>
        <p>Inspire someone with your progress</p>
      </div>
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
  </div>

  <footer>
    <span class="brand">CogniBloom — Daniel's Learning Platform</span>
    <span class="slug-txt">${safeSlug}</span>
  </footer>

</div>
<script>
(function(){
  var T=function(){ return document.getElementById('spt').textContent.trim(); }
  var U=function(){ return window.location.href; }
  var clip=function(s,cb){
    if(navigator.clipboard){ navigator.clipboard.writeText(s).then(cb).catch(fb); }
    else { fb(); }
    function fb(){ var t=document.createElement('textarea');t.value=s;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);cb(); }
  };
  var flash=function(el,lbl){ var o=el.textContent;el.textContent=lbl;el.classList.add('ok');setTimeout(function(){el.textContent=o;el.classList.remove('ok');},2000); };
  window.copyPost=function(){ clip(T()+'\n\n'+U(),function(){ flash(document.getElementById('cpbtn'),'✓ Copied!'); }); };
  window.copyFor=function(el){ clip(T()+'\n\n'+U(),function(){ flash(el,'✓ Copied!'); }); };
  window.shareX=function(){ window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(T()+'\n\n')+'&url='+encodeURIComponent(U()),'_blank','width=600,height=480'); };
  window.shareFB=function(){ window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(U()),'_blank','width=600,height=480'); };
  window.shareTH=function(){ window.open('https://www.threads.net/intent/post?text='+encodeURIComponent(T()+'\n\n'+U()),'_blank','width=600,height=560'); };
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
    const writer = await generateWriterContent({
      title: note.title, subject: note.subject, tutorSummary: note.tutorSummary,
      content: note.content, knowledgePoints: note.knowledgePoints,
    })
    const publishedHtml = buildPublishedPage({
      originalTitle: note.title, subject: note.subject, originalContent: note.content,
      tutorSummary: note.tutorSummary, knowledgePoints: note.knowledgePoints,
      mindMap: note.mindMap, reasoningHints: note.reasoningHints,
      publishedSlug: slug, createdAt: note.createdAt, writer,
    })
    const updated = await db.note.update({
      where: { id: noteId },
      data: { publishedHtml, publishedSlug: slug, publishedAt: new Date() },
    })
    return NextResponse.json({
      success: true,
      data: { slug: updated.publishedSlug, publishedAt: updated.publishedAt, url: `/notes/view/${slug}`, publishTitle: writer.publishTitle },
    })
  } catch {
    return NextResponse.json({ error: 'Publish failed' }, { status: 500 })
  }
}

// ── DELETE /api/notes/[noteId]/publish ── (unpublish) ────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { noteId } = await params
    const note = await db.note.findFirst({
      where: { id: noteId, userId: DANIEL_USER_ID },
      select: { id: true, publishedSlug: true },
    })
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    if (!note.publishedSlug) return NextResponse.json({ error: 'Note is not published' }, { status: 400 })

    await db.note.update({
      where: { id: noteId },
      data: { publishedHtml: null, publishedSlug: null, publishedAt: null },
    })
    return NextResponse.json({ success: true, message: 'Note unpublished' })
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
