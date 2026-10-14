// Reflection summary — generated automatically once the student finishes
// "14. Progress Summary" in the Daily Reflection template. Pure functions
// (detection, plain-text extraction, prompt, parsing) so all of it is tested
// without a model call. Works on the TipTap HTML string, in the browser and
// on the server alike.

import { z } from 'zod'

export const PROGRESS_HEADING = '14. Progress Summary'

/** The three labeled lines of section 14. Only the part after the colon counts as an answer. */
export interface ProgressAnswer { label: string; answer: string }

const decode = (s: string) =>
  s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")

const text = (html: string) => decode(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

/** The list right after the section-14 heading, as label/answer pairs. Null when the section is missing. */
export function extractProgressAnswers(html: string): ProgressAnswer[] | null {
  const h = html.search(/<h2[^>]*>\s*14\. Progress Summary\s*<\/h2>/i)
  if (h === -1) return null
  const rest = html.slice(h)
  const ulStart = rest.search(/<ul[\s>]/i)
  // Stop at the next section if there is no list in this one.
  const nextH2 = rest.slice(5).search(/<h2[\s>]/i)
  if (ulStart === -1 || (nextH2 !== -1 && ulStart > nextH2 + 5)) return []
  const ulEnd = rest.indexOf('</ul>', ulStart)
  const list = rest.slice(ulStart, ulEnd === -1 ? undefined : ulEnd)
  const items = list.split(/<li[\s>]/i).slice(1)
  return items.map((li) => {
    const t = text(li.replace(/^[^>]*>/, ''))
    const i = t.indexOf(':')
    return i === -1 ? { label: '', answer: t } : { label: t.slice(0, i).trim(), answer: t.slice(i + 1).trim() }
  })
}

const MIN_ANSWER = 3

/** Section 14 is finished when every labeled line has a real answer (at least 3 lines). */
export function isProgressComplete(html: string): boolean {
  const answers = extractProgressAnswers(html)
  if (!answers || answers.length < 3) return false
  return answers.every((a) => a.answer.replace(/[^\p{L}\p{N}]/gu, '').length >= MIN_ANSWER)
}

/** Stable fingerprint of the section-14 answers, to know when they changed. */
export function progressFingerprint(html: string): string | null {
  const answers = extractProgressAnswers(html)
  if (!answers) return null
  const s = answers.map((a) => a.answer.toLowerCase().replace(/\s+/g, ' ').trim()).join('|')
  // FNV-1a, 32-bit. Collisions only cost one skipped auto-refresh.
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0')
}

/**
 * The reflection as readable plain text: headings become "## Heading",
 * list items "- item", template hint quotes are dropped, empty items skipped.
 */
export function reflectionPlainText(html: string, max = 8000): string {
  const out: string[] = []
  const withoutHints = html.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '')
  const re = /<(h[1-3])[^>]*>([\s\S]*?)<\/\1>|<li[^>]*>([\s\S]*?)<\/li>|<p[^>]*>([\s\S]*?)<\/p>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(withoutHints))) {
    if (m[1]) { out.push(`\n## ${text(m[2])}`); continue }
    if (m[3] !== undefined) {
      const t = text(m[3])
      // A labeled line with nothing after the label is still empty.
      if (t && !/^[^:]{1,60}:\s*$/.test(t)) out.push(`- ${t}`)
      continue
    }
    const t = text(m[4] ?? '')
    if (t) out.push(t)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max)
}

export const summarySchema = z.object({
  headline: z.string().min(3).max(140),
  quickSummary: z.string().min(10).max(600),
  wins: z.array(z.string().max(220)).max(5).default([]),
  stillWorkingOn: z.array(z.string().max(220)).max(4).default([]),
  tomorrow: z.array(z.string().max(220)).max(4).default([]),
  tip: z.string().max(300).default(''),
  parentNote: z.string().max(700).default(''),
})
export type ReflectionSummary = z.infer<typeof summarySchema>

export interface StoredSummary extends ReflectionSummary {
  generatedAt: string
  fingerprint: string | null
  focusMinutes: number | null
}

export function buildSummaryPrompt(opts: {
  reflection: string
  name: string
  gradeLabel: string
  focusMinutes: number | null
  noteTitle?: string | null
}): string {
  const focus = opts.focusMinutes !== null
    ? `The writing timer measured about ${opts.focusMinutes} minute${opts.focusMinutes === 1 ? '' : 's'} of focused time on this reflection.`
    : ''
  return `You are a warm, encouraging learning coach for ${opts.name}, a ${opts.gradeLabel} student. They just finished their daily learning reflection${opts.noteTitle ? ` ("${opts.noteTitle}")` : ''}. ${focus}

Read the reflection and write a summary of their day. Base everything on what they actually wrote; do not invent subjects, scores or events. If a section is empty, leave it out.

Return ONLY a JSON object, no markdown fences, in exactly this shape:
{
  "headline": "one upbeat, specific line, at most 12 words, e.g. 'Geometry clicked once you drew the diagram'",
  "quickSummary": "2-3 short sentences talking to ${opts.name} ('you'), naming the main thing they worked on, one real win, and the plan",
  "wins": ["2-4 specific wins from today, in their words where possible"],
  "stillWorkingOn": ["0-3 things still confusing or got wrong, phrased as next steps, never as failures"],
  "tomorrow": ["1-3 concrete actions for tomorrow, from their plan and review list"],
  "tip": "one specific, practical study tip that fits what they struggled with today",
  "parentNote": "2-3 sentences in the third person for a parent or teacher: what ${opts.name} worked on, how it went, what is next"
}

Tone: like a supportive older teammate. Short sentences, words a ${opts.gradeLabel} student uses every day. Praise specific effort and thinking, not just results. No guilt, no lecturing.

The reflection:
"""
${opts.reflection}
"""`
}

/** Parse the model's reply: tolerate code fences and stray text around the JSON object. */
export function parseSummary(raw: string): ReflectionSummary | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const parsed = summarySchema.safeParse(JSON.parse(raw.slice(start, end + 1)))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
