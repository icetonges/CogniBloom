import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { chatWithFallback } from '@/lib/ai/fallback'

export const maxDuration = 60

type RouteParams = { params: Promise<{ noteId: string }> }

// ── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeSlugPart(str: string): string {
  return str.trim().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 40)
}
function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function escapeAttribute(v: string): string {
  return escapeHtml(v).replace(/`/g, '&#96;')
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
    .replace(/\s+/g, ' ').trim()
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface EditorialPlan {
  coreTension: string
  keyInsights: Array<{ insight: string; plain: string }>
  relayAnalogy: string
  bigPicture: string
  sectionTitles: string[]
  hook: string
  tryThis: string
}

interface WriterOutput {
  publishTitle: string
  hook: string
  sections: Array<{ title: string; body: string }>
  lightbulbMoment: string
  keyTerms: Array<{ term: string; definition: string; color: string }>
  tryThis: string
  bigPicture: string
  encouragement: string
  reviewTips: string[]
  socialPost: string
}

// ── Step 1: Editorial Plan ────────────────────────────────────────────────────

async function buildEditorialPlan(note: {
  title: string
  subject: string | null
  content: string
  tutorSummary: string | null
  knowledgePoints: string | null
}): Promise<EditorialPlan | null> {
  const plainText = htmlToText(note.content).slice(0, 2500)
  const summaryLine = note.tutorSummary ? `\nSummary: ${htmlToText(note.tutorSummary).slice(0, 400)}` : ''
  let keyTerms = ''
  try {
    const kps = JSON.parse(note.knowledgePoints ?? '[]') as { term: string; definition: string; importance: string }[]
    keyTerms = kps.map(k => `• ${k.term} [${k.importance}]: ${k.definition}`).join('\n')
  } catch { /* ignore */ }

  const prompt = `You are an educational editor for a smart 12-year-old student. A student named Daniel wrote these study notes. Build an editorial plan before writing anything.

NOTE:
Title: ${note.title}
Subject: ${note.subject ?? 'General'}${summaryLine}
${keyTerms ? `\nKey concepts:\n${keyTerms}` : ''}
Content: ${plainText.slice(0, 2000)}

Answer each question clearly and briefly:

1. CORE TENSION: In one plain sentence, what confusion or problem does this topic solve for a 12-year-old who has never seen it?

2. KEY INSIGHTS: List 2-3 core insights from the note. For each, write it in two ways:
   - "insight": the actual concept
   - "plain": how you'd explain it to a curious 12-year-old in one casual sentence (use words they know)

3. RELAY ANALOGY: One vivid analogy to something a 12-year-old already knows (a game, their phone, a sport, food, school). This should make the hardest concept click instantly.

4. BIG PICTURE: One sentence connecting this to real life or a bigger idea — "This is why..." or "This is the same reason..."

5. SECTION TITLES: 2-3 short, punchy section headings (max 5 words each) that guide the article. Should feel like chapter names in an exciting book, not textbook labels.

6. HOOK: The very first sentence — a surprising fact, a relatable problem, or a bold claim that grabs a 12-year-old in the first 3 seconds.

7. TRY THIS: One short, doable activity (under 2 minutes) a 12-year-old can do RIGHT NOW to test what they just learned. Specific and fun.

Return ONLY this JSON:
{
  "coreTension": "...",
  "keyInsights": [{ "insight": "...", "plain": "..." }, { "insight": "...", "plain": "..." }],
  "relayAnalogy": "...",
  "bigPicture": "...",
  "sectionTitles": ["...", "...", "..."],
  "hook": "...",
  "tryThis": "..."
}`

  try {
    const res = await chatWithFallback({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 800,
    })
    return JSON.parse(extractJSON(res.content)) as EditorialPlan
  } catch {
    return null
  }
}

// ── Step 2: Write the Article ─────────────────────────────────────────────────

async function writeFromPlan(note: {
  title: string
  subject: string | null
  content: string
  tutorSummary: string | null
  knowledgePoints: string | null
}, plan: EditorialPlan | null): Promise<WriterOutput> {
  const plainText = htmlToText(note.content).slice(0, 2500)
  const summaryLine = note.tutorSummary ? htmlToText(note.tutorSummary).slice(0, 300) : ''
  let rawTerms: Array<{ term: string; definition: string; importance: string }> = []
  try {
    rawTerms = JSON.parse(note.knowledgePoints ?? '[]')
  } catch { /* ignore */ }
  const keyTermsList = rawTerms.slice(0, 5).map(k => `${k.term}: ${k.definition}`).join('\n')

  const planBlock = plan ? `
EDITORIAL PLAN:
Hook: "${plan.hook}"
Core tension: ${plan.coreTension}
Analogy to use: ${plan.relayAnalogy}
Big picture: ${plan.bigPicture}
Insights:
${plan.keyInsights.map((k, i) => `  ${i + 1}. ${k.insight} → Plain: "${k.plain}"`).join('\n')}
Sections: ${plan.sectionTitles.join(' | ')}
Try This activity: ${plan.tryThis}
` : ''

  const prompt = `You are writing a short educational article for a SMART 12-YEAR-OLD named Daniel who just studied something and wants to share what he learned.

${planBlock}
NOTE:
Title: ${note.title}
Subject: ${note.subject ?? 'General'}
${summaryLine ? `Summary: ${summaryLine}` : ''}
${keyTermsList ? `Key terms:\n${keyTermsList}` : ''}
Content: ${plainText.slice(0, 2000)}

YOUR JOB: Write a structured JSON representing a VISUALLY RICH, SHORT educational article.

RULES:
- Total article body: 350-450 words across all sections. Count carefully.
- Paragraphs: 2-3 sentences max. Short. Punchy. No walls of text.
- Language: casual, confident, clear. No jargon without immediate explanation. Write like a knowledgeable friend, not a textbook.
- Each section body: plain text only (no HTML tags) — the page renderer handles styling.
- Use the analogy from the plan to make the hardest concept concrete.
- keyTerms: 2-4 important words from the note with a one-sentence plain-English definition and a color (choose from: "violet", "emerald", "amber", "sky", "rose").
- lightbulbMoment: the single most surprising or satisfying insight — the "wow, I never thought of it that way" moment. 1-2 sentences.
- tryThis: a quick, fun, specific activity to test the learning RIGHT NOW (under 2 min).
- bigPicture: 1-2 sentences connecting this topic to the real world or a bigger idea.
- encouragement: 2 warm, specific sentences to Daniel about what he studied today.
- reviewTips: exactly 3 tips — specific to this topic, not generic ("re-read your notes" is not acceptable).
- socialPost: Instagram/TikTok style. Bold hook. One surprising fact. Casual. Max 220 chars. 3 specific hashtags.

TITLE RULES:
- Capture the specific insight learned, not just the topic
- Bad: "Notes on Variables" | Good: "Why Every Computer Program Starts With a Box"
- Max 70 chars. A 12-year-old should think "wait, what?" and want to read it.

Return ONLY this JSON — no markdown, no preamble:
{
  "publishTitle": "...",
  "hook": "...",
  "sections": [
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." }
  ],
  "lightbulbMoment": "...",
  "keyTerms": [
    { "term": "...", "definition": "...", "color": "violet" }
  ],
  "tryThis": "...",
  "bigPicture": "...",
  "encouragement": "...",
  "reviewTips": ["...", "...", "..."],
  "socialPost": "..."
}`

  const defaults: WriterOutput = {
    publishTitle: note.title,
    hook: `Here's something about ${note.subject ?? 'this topic'} that most people never think about.`,
    sections: [{ title: 'What We Learned', body: htmlToText(note.content).slice(0, 300) }],
    lightbulbMoment: 'Understanding this changes how you see everything connected to it.',
    keyTerms: [],
    tryThis: 'Try explaining the main idea out loud to someone — if you can teach it, you know it.',
    bigPicture: 'This concept shows up everywhere once you know to look for it.',
    encouragement: `Great work studying this today, Daniel. Every session builds your foundation.`,
    reviewTips: [
      'Explain the main concept out loud without looking at your notes.',
      'Find one real-world example of this topic that you encounter today.',
      'Write a one-sentence summary of what you learned from memory.',
    ],
    socialPost: `just learned something about ${note.subject ?? 'a cool topic'} that changed how I see it 🧠 #LearnInPublic #StudyWithMe #CogniBloom`,
  }

  try {
    const res = await chatWithFallback({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      maxTokens: 1600,
    })
    const parsed = JSON.parse(extractJSON(res.content)) as Partial<WriterOutput>
    return {
      publishTitle: parsed.publishTitle?.trim() || defaults.publishTitle,
      hook: parsed.hook || defaults.hook,
      sections: Array.isArray(parsed.sections) && parsed.sections.length > 0
        ? parsed.sections : defaults.sections,
      lightbulbMoment: parsed.lightbulbMoment || defaults.lightbulbMoment,
      keyTerms: Array.isArray(parsed.keyTerms) ? parsed.keyTerms : defaults.keyTerms,
      tryThis: parsed.tryThis || defaults.tryThis,
      bigPicture: parsed.bigPicture || defaults.bigPicture,
      encouragement: parsed.encouragement || defaults.encouragement,
      reviewTips: Array.isArray(parsed.reviewTips) && parsed.reviewTips.length === 3
        ? parsed.reviewTips : defaults.reviewTips,
      socialPost: parsed.socialPost || defaults.socialPost,
    }
  } catch {
    return defaults
  }
}

async function generateWriterContent(note: {
  title: string
  subject: string | null
  tutorSummary: string | null
  content: string
  knowledgePoints: string | null
}): Promise<WriterOutput> {
  const plan = await buildEditorialPlan(note)
  return writeFromPlan(note, plan)
}

// ── Color map for key term pills ──────────────────────────────────────────────

const TERM_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  violet: { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.35)', text: '#a78bfa' },
  emerald:{ bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', text: '#34d399' },
  amber:  { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', text: '#fbbf24' },
  sky:    { bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.35)', text: '#38bdf8' },
  rose:   { bg: 'rgba(244,63,94,0.12)',  border: 'rgba(244,63,94,0.35)',  text: '#fb7185' },
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
  const date = new Date(note.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const { writer } = note

  // ── Key term pills ──
  const termPillsHtml = writer.keyTerms.map(kt => {
    const c = TERM_COLORS[kt.color] ?? TERM_COLORS['violet']!
    return `<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
      <span style="flex-shrink:0;display:inline-block;padding:3px 12px;border-radius:999px;font-size:12px;font-weight:700;background:${c.bg};border:1px solid ${c.border};color:${c.text};">${escapeHtml(kt.term)}</span>
      <span style="font-size:13.5px;color:#94a3b8;line-height:1.6;padding-top:2px;">${escapeHtml(kt.definition)}</span>
    </div>`
  }).join('')

  // ── Article sections ──
  const sectionsHtml = writer.sections.map(s => `
    <div style="margin-bottom:24px;">
      <h3 style="font-size:1rem;font-weight:800;color:#a5b4fc;margin:0 0 8px;display:flex;align-items:center;gap:8px;">
        <span style="display:inline-block;width:4px;height:16px;border-radius:2px;background:linear-gradient(135deg,#6366f1,#8b5cf6);flex-shrink:0;"></span>
        ${escapeHtml(s.title)}
      </h3>
      <p style="font-size:15px;color:#cbd5e1;line-height:1.8;margin:0;">${escapeHtml(s.body)}</p>
    </div>`).join('')

  // ── Review tips ──
  const reviewTipsHtml = writer.reviewTips.map((tip, i) => {
    const colors = [
      { num: 'rgba(99,102,241,0.2)', border: 'rgba(99,102,241,0.4)', text: '#a5b4fc' },
      { num: 'rgba(16,185,129,0.2)', border: 'rgba(16,185,129,0.4)', text: '#34d399' },
      { num: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.4)', text: '#fbbf24' },
    ][i] ?? { num: 'rgba(99,102,241,0.2)', border: 'rgba(99,102,241,0.4)', text: '#a5b4fc' }
    return `<div style="display:flex;gap:12px;margin-bottom:10px;align-items:flex-start;">
      <span style="flex-shrink:0;width:24px;height:24px;border-radius:7px;background:${colors.num};border:1px solid ${colors.border};color:${colors.text};font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;">${i + 1}</span>
      <span style="font-size:14px;line-height:1.65;color:#cbd5e1;padding-top:3px;">${escapeHtml(tip)}</span>
    </div>`
  }).join('')

  // ── Original note (collapsible) ──
  const safeOriginalContent = sanitizeRichHtml(note.originalContent)
  const safeSummary = note.tutorSummary ? sanitizeRichHtml(note.tutorSummary) : null

  // ── Mind map ──
  let mindMapHtml = ''
  try {
    interface MindNode { label: string; children?: MindNode[] }
    const renderNode = (node: MindNode, depth = 0): string => {
      const ch = node.children?.length
        ? `<ul style="margin:4px 0 4px 18px;padding:0;list-style:none;">${node.children.map(c => renderNode(c, depth + 1)).join('')}</ul>` : ''
      const bg = depth === 0 ? '#6366f1' : depth === 1 ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)'
      return `<li style="margin:4px 0;"><span style="display:inline-block;background:${bg};color:${depth === 0 ? '#fff' : 'inherit'};padding:${depth === 0 ? '5px 14px' : '3px 10px'};border-radius:7px;font-size:${depth === 0 ? '13px' : '12px'};font-weight:${depth === 0 ? 700 : 500};">${escapeHtml(node.label)}</span>${ch}</li>`
    }
    const root = JSON.parse(note.mindMap ?? 'null') as MindNode | null
    if (root) mindMapHtml = `<ul style="list-style:none;margin:0;padding:0;">${renderNode(root)}</ul>`
  } catch { /* */ }

  // ── Reasoning hints ──
  let reasoningHtml = ''
  try {
    const hints = JSON.parse(note.reasoningHints ?? '[]') as { step: number; hint: string }[]
    reasoningHtml = hints.map(h => `
      <div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;">
        <span style="flex-shrink:0;width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">${h.step}</span>
        <span style="font-size:13.5px;line-height:1.6;color:#94a3b8;padding-top:3px;">${escapeHtml(h.hint)}</span>
      </div>`).join('')
  } catch { /* */ }

  // ── Escaped strings ──
  const safeTitle = escapeHtml(writer.publishTitle)
  const safeOrigTitle = escapeHtml(note.originalTitle)
  const safeSubject = note.subject ? escapeHtml(note.subject) : null
  const safeSlug = escapeHtml(note.publishedSlug)
  const safeHook = escapeHtml(writer.hook)
  const safeLightbulb = escapeHtml(writer.lightbulbMoment)
  const safeTryThis = escapeHtml(writer.tryThis)
  const safeBigPicture = escapeHtml(writer.bigPicture)
  const safeEncourage = escapeHtml(writer.encouragement)
  const safeSocial = escapeHtml(writer.socialPost)

  // ── Social icons ──
  const xSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.631L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>`
  const fbSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.411c0-3.025 1.791-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.971h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>`
  const igSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>`
  const ttSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.2 8.2 0 004.79 1.53V6.75a4.85 4.85 0 01-1.02-.06z"/></svg>`
  const thSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.5 12.069V12c.024-3.506.906-6.346 2.621-8.44C5.854 1.338 8.496.024 11.988 0h.013c2.7.016 4.987.758 6.787 2.205 1.72 1.385 2.768 3.24 3.116 5.515l-2.898.53c-.287-1.67-.971-3.027-2.033-4.033-1.11-1.05-2.65-1.603-4.574-1.632H12.1c-2.59.034-4.567.941-5.881 2.695C5.127 6.718 4.5 8.9 4.48 11.996v.07c.02 3.1.647 5.285 1.74 6.729 1.315 1.752 3.294 2.66 5.882 2.694h.08c2.19-.027 3.77-.517 4.879-1.496.985-.864 1.597-2.15 1.82-3.821l2.898.53c-.292 2.36-1.2 4.2-2.69 5.47-1.637 1.39-3.848 2.11-6.594 2.118h-.31z"/></svg>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle} — CogniBloom</title>
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:type" content="article">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #060c18; color: #e2e8f0; min-height: 100vh; }
    .page { max-width: 760px; margin: 0 auto; padding: 44px 20px 80px; }

    /* ── Header ── */
    .eyebrow { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .14em; color: #374151; margin-bottom: 10px; }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(99,102,241,.15); color: #a5b4fc; border: 1px solid rgba(99,102,241,.3); border-radius: 999px; padding: 3px 12px; font-size: 11px; font-weight: 700; margin-bottom: 14px; }
    .pub-title { font-size: 2rem; font-weight: 900; background: linear-gradient(135deg,#a5b4fc,#c4b5fd 50%,#f0abfc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 1.15; margin-bottom: 8px; }
    .meta { font-size: 11px; color: #374151; margin-bottom: 28px; }

    /* ── Hook card ── */
    .hook-card { background: linear-gradient(135deg,rgba(99,102,241,.12),rgba(139,92,246,.07)); border: 1px solid rgba(99,102,241,.25); border-radius: 16px; padding: 18px 22px; margin-bottom: 28px; font-size: 16px; font-weight: 600; color: #e2e8f0; line-height: 1.6; }

    /* ── Sections ── */
    .sections-wrap { background: rgba(255,255,255,.025); border: 1px solid rgba(255,255,255,.07); border-radius: 18px; padding: 28px; margin-bottom: 20px; }

    /* ── Lightbulb moment ── */
    .lightbulb { display: flex; gap: 14px; align-items: flex-start; background: linear-gradient(135deg,rgba(245,158,11,.1),rgba(251,191,36,.06)); border: 1px solid rgba(245,158,11,.3); border-radius: 14px; padding: 16px 18px; margin: 24px 0; }
    .lb-icon { font-size: 22px; flex-shrink: 0; }
    .lb-text { font-size: 14.5px; font-weight: 600; color: #fde68a; line-height: 1.65; }

    /* ── Key terms ── */
    .terms-card { background: rgba(255,255,255,.02); border: 1px solid rgba(255,255,255,.07); border-radius: 14px; padding: 18px 20px; margin-bottom: 20px; }
    .card-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: #475569; margin-bottom: 14px; }

    /* ── Try This ── */
    .try-this { display: flex; gap: 14px; align-items: flex-start; background: linear-gradient(135deg,rgba(16,185,129,.1),rgba(5,150,105,.06)); border: 1px solid rgba(16,185,129,.3); border-radius: 14px; padding: 16px 18px; margin-bottom: 20px; }
    .try-icon { font-size: 22px; flex-shrink: 0; }
    .try-text { font-size: 14px; color: #6ee7b7; line-height: 1.7; }
    .try-text strong { color: #34d399; font-weight: 800; display: block; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .07em; }

    /* ── Big Picture ── */
    .big-pic { display: flex; gap: 14px; align-items: flex-start; background: rgba(14,165,233,.08); border: 1px solid rgba(14,165,233,.25); border-radius: 14px; padding: 16px 18px; margin-bottom: 24px; }
    .big-icon { font-size: 22px; flex-shrink: 0; }
    .big-text { font-size: 14px; color: #7dd3fc; line-height: 1.7; }

    /* ── Collapsible ── */
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
    .raw-body strong { color: #64748b; }

    /* ── AI sections ── */
    .ai-box { background: rgba(255,255,255,.02); border: 1px solid rgba(255,255,255,.07); border-radius: 14px; padding: 18px 20px; margin-bottom: 16px; }
    .tutor-body { font-size: 13.5px; color: #94a3b8; line-height: 1.8; }
    .tutor-body strong { color: #c4b5fd; }

    /* ── Encouragement ── */
    .encourage { background: linear-gradient(135deg,rgba(99,102,241,.09),rgba(139,92,246,.05)); border: 1px solid rgba(99,102,241,.2); border-radius: 14px; padding: 16px 20px; margin-bottom: 20px; display: flex; gap: 12px; align-items: flex-start; }
    .enc-text { font-size: 13.5px; color: #c4b5fd; line-height: 1.7; }

    /* ── Social ── */
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

    /* ── Footer ── */
    footer { margin-top: 44px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,.05); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
    .brand { font-size: 12px; font-weight: 800; background: linear-gradient(135deg,#6366f1,#8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .slug-txt { font-family: monospace; font-size: 10px; color: #374151; }

    @media(max-width:600px){
      .pub-title { font-size: 1.6rem; }
      .sections-wrap { padding: 18px; }
      .plat-grid { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="eyebrow">CogniBloom · Published Study Note</div>
  ${safeSubject ? `<div class="badge">📚 ${safeSubject}</div>` : ''}
  <div class="pub-title">${safeTitle}</div>
  <div class="meta">📅 ${date}${safeOrigTitle !== safeTitle ? ` &nbsp;·&nbsp; Original: "${safeOrigTitle}"` : ''}</div>

  <!-- Hook -->
  <div class="hook-card">${safeHook}</div>

  <!-- Article sections -->
  <div class="sections-wrap">
    ${sectionsHtml}

    <!-- Lightbulb Moment -->
    <div class="lightbulb">
      <div class="lb-icon">💡</div>
      <div class="lb-text">${safeLightbulb}</div>
    </div>
  </div>

  <!-- Key Terms -->
  ${termPillsHtml ? `
  <div class="terms-card">
    <div class="card-label">🔑 Key Terms</div>
    ${termPillsHtml}
  </div>` : ''}

  <!-- Try This -->
  <div class="try-this">
    <div class="try-icon">🎯</div>
    <div class="try-text">
      <strong>Try This Right Now</strong>
      ${safeTryThis}
    </div>
  </div>

  <!-- Big Picture -->
  <div class="big-pic">
    <div class="big-icon">🌍</div>
    <div class="big-text">${safeBigPicture}</div>
  </div>

  <!-- Encouragement -->
  <div class="encourage">
    <span style="font-size:20px;">🌟</span>
    <div class="enc-text">${safeEncourage}</div>
  </div>

  <!-- Original notes -->
  <details class="raw">
    <summary>📓 Original Study Notes</summary>
    <div class="raw-body">${safeOriginalContent}</div>
  </details>

  <!-- Review Tips -->
  ${reviewTipsHtml ? `
  <div class="terms-card">
    <div class="card-label">📖 Review Tips</div>
    ${reviewTipsHtml}
  </div>` : ''}

  <!-- AI Summary -->
  ${safeSummary ? `
  <div class="ai-box">
    <div class="card-label" style="margin-bottom:10px;">✨ AI Tutor Summary</div>
    <div class="tutor-body">${safeSummary}</div>
  </div>` : ''}

  <!-- Reasoning -->
  ${reasoningHtml ? `
  <div class="ai-box">
    <div class="card-label" style="margin-bottom:10px;">🧠 Reasoning Logic</div>
    ${reasoningHtml}
  </div>` : ''}

  <!-- Mind Map -->
  ${mindMapHtml ? `
  <div class="ai-box">
    <div class="card-label" style="margin-bottom:10px;">🗺️ Mind Map</div>
    ${mindMapHtml}
  </div>` : ''}

  <!-- Social Share -->
  <div class="social">
    <div class="soc-head">
      <div class="soc-icon-wrap">📱</div>
      <div>
        <h3>Share What You Learned</h3>
        <p>Post it and inspire someone else</p>
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
    <span class="brand">CogniBloom — AI Learning Platform</span>
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
  window.copyPost=function(){ clip(T()+'\\n\\n'+U(),function(){ flash(document.getElementById('cpbtn'),'✓ Copied!'); }); };
  window.copyFor=function(el){ clip(T()+'\\n\\n'+U(),function(){ flash(el,'✓ Copied!'); }); };
  window.shareX=function(){ window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(T()+'\\n\\n')+'&url='+encodeURIComponent(U()),'_blank','width=600,height=480'); };
  window.shareFB=function(){ window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(U()),'_blank','width=600,height=480'); };
  window.shareTH=function(){ window.open('https://www.threads.net/intent/post?text='+encodeURIComponent(T()+'\\n\\n'+U()),'_blank','width=600,height=560'); };
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
