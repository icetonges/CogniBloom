import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { chatWithFallback } from '@/lib/ai/fallback'

export const maxDuration = 60

type RouteParams = { params: Promise<{ noteId: string }> }

function sanitizeSlugPart(str: string): string {
  return str
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 40)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;')
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
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractJSON(text: string): string {
  const noThinking = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim()
  const s = noThinking || text
  let depth = 0; let start = -1; let inString = false; let escape = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
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
  const index = (existing.length + 1).toString().padStart(3, '0')
  return `${prefix}${index}`
}

interface AIEnrichment {
  encouragement: string
  reviewTips: string[]
}

async function generateEnrichment(note: {
  title: string
  subject: string | null
  tutorSummary: string | null
  content: string
}): Promise<AIEnrichment> {
  const plainText = htmlToText(note.content).slice(0, 3000)
  const summaryLine = note.tutorSummary ? `\nAI Tutor Summary: ${htmlToText(note.tutorSummary)}` : ''

  const prompt = `You are Daniel's personal AI learning coach. He has just published a study note.
Write personalized content for the published page based on this note.

Title: ${note.title}
Subject: ${note.subject ?? 'General'}${summaryLine}

Content (excerpt):
${plainText.slice(0, 2000)}

Return ONLY a JSON object with exactly these fields:
{
  "encouragement": "<2-3 warm, specific sentences encouraging Daniel about this particular work. Reference what he studied. Be genuine, not generic.>",
  "reviewTips": [
    "<specific, actionable tip for reviewing or practicing THIS content — not generic study advice>",
    "<another tip specific to this note's topic>",
    "<a third tip, e.g. connections to make, problems to try, or follow-up questions to explore>"
  ]
}

Rules:
- encouragement: mention something specific from the content; speak directly to Daniel
- reviewTips: 3 tips, each 1 sentence, highly specific to the note's subject matter
- Return ONLY the JSON. No markdown, no preamble.`

  try {
    const response = await chatWithFallback(
      { messages: [{ role: 'user', content: prompt }], temperature: 0.4, maxTokens: 600 },
    )
    const raw = extractJSON(response.content)
    const parsed = JSON.parse(raw) as Partial<AIEnrichment>
    return {
      encouragement: parsed.encouragement ?? 'Great work publishing this note — keep building your knowledge!',
      reviewTips: Array.isArray(parsed.reviewTips) && parsed.reviewTips.length > 0
        ? parsed.reviewTips
        : ['Re-read the key concepts without notes, then check what you missed.'],
    }
  } catch {
    return {
      encouragement: 'Great work publishing this note — every note you write is a step forward in your learning journey.',
      reviewTips: [
        'Cover the note and try to recall the main ideas from memory.',
        'Create a practice problem based on the concepts in this note.',
        'Explain the topic out loud as if teaching it to someone else.',
      ],
    }
  }
}

function buildPublishedPage(note: {
  title: string
  subject: string | null
  content: string
  tutorSummary: string | null
  knowledgePoints: string | null
  mindMap: string | null
  reasoningHints: string | null
  publishedSlug: string
  createdAt: Date
  enrichment: AIEnrichment
}): string {
  const date = new Date(note.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  // ── Knowledge concept pills ──
  let knowledgePillsHtml = ''
  try {
    const kps = JSON.parse(note.knowledgePoints ?? '[]') as { term: string; definition: string; importance: string }[]
    knowledgePillsHtml = kps.map((kp) => {
      const color = kp.importance === 'core' ? '#6366f1' : kp.importance === 'supporting' ? '#10b981' : '#f59e0b'
      return `<span title="${escapeAttribute(kp.definition)}" style="display:inline-flex;align-items:center;gap:6px;background:${color}18;border:1px solid ${color}40;color:${color};border-radius:999px;padding:3px 12px;font-size:12px;font-weight:600;cursor:help;margin:3px;">${escapeHtml(kp.term)}</span>`
    }).join('')
  } catch { /* empty */ }

  // ── Mind map ──
  let mindMapHtml = ''
  try {
    interface MindNode { label: string; children?: MindNode[] }
    const renderNode = (node: MindNode, depth = 0): string => {
      const children = node.children?.length
        ? `<ul style="margin:4px 0 4px 20px;padding:0;list-style:none;">${node.children.map((c) => renderNode(c, depth + 1)).join('')}</ul>`
        : ''
      const bg = depth === 0 ? '#6366f1' : depth === 1 ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)'
      const color = depth === 0 ? '#fff' : 'inherit'
      const padding = depth === 0 ? '6px 16px' : '4px 12px'
      const fontSize = depth === 0 ? '14px' : '13px'
      return `<li style="margin:4px 0;"><span style="display:inline-block;background:${bg};color:${color};padding:${padding};border-radius:8px;font-size:${fontSize};font-weight:${depth === 0 ? 700 : 500};">${escapeHtml(node.label)}</span>${children}</li>`
    }
    const root = JSON.parse(note.mindMap ?? 'null') as MindNode | null
    if (root) {
      mindMapHtml = `<ul style="list-style:none;margin:0;padding:0;">${renderNode(root)}</ul>`
    }
  } catch { /* empty */ }

  // ── Reasoning hints ──
  let reasoningHtml = ''
  try {
    const hints = JSON.parse(note.reasoningHints ?? '[]') as { step: number; hint: string }[]
    reasoningHtml = hints.map((h) => `
      <div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start;">
        <span style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;">${h.step}</span>
        <span style="font-size:14px;line-height:1.6;padding-top:4px;color:#cbd5e1;">${escapeHtml(h.hint)}</span>
      </div>`).join('')
  } catch { /* empty */ }

  // ── Review tips ──
  const reviewTipsHtml = note.enrichment.reviewTips.map((tip, i) => `
    <div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start;">
      <span style="flex-shrink:0;width:22px;height:22px;border-radius:6px;background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.4);color:#10b981;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">${i + 1}</span>
      <span style="font-size:14px;line-height:1.6;padding-top:2px;color:#cbd5e1;">${escapeHtml(tip)}</span>
    </div>`).join('')

  const safeTitle = escapeHtml(note.title)
  const safeSubject = note.subject ? escapeHtml(note.subject) : null
  const safeContent = sanitizeRichHtml(note.content)
  const safeSummary = note.tutorSummary ? sanitizeRichHtml(note.tutorSummary) : null
  const safeSlug = escapeHtml(note.publishedSlug)
  const safeEncouragement = escapeHtml(note.enrichment.encouragement)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle} — CogniBloom</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #060c18;
      color: #e2e8f0;
      min-height: 100vh;
      line-height: 1.6;
    }
    .page { max-width: 860px; margin: 0 auto; padding: 48px 24px 80px; }
    /* Header */
    .badge { display:inline-flex;align-items:center;gap:6px;background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);border-radius:999px;padding:4px 14px;font-size:12px;font-weight:600;margin-bottom:16px; }
    h1 { font-size:2.1rem;font-weight:900;background:linear-gradient(135deg,#a5b4fc,#c4b5fd);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:10px;line-height:1.2; }
    .meta { font-size:13px;color:#64748b;display:flex;gap:16px;flex-wrap:wrap;margin-bottom:32px; }
    /* Encouragement banner */
    .encourage { background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08));border:1px solid rgba(99,102,241,0.25);border-radius:16px;padding:20px 24px;margin-bottom:28px;display:flex;gap:14px;align-items:flex-start; }
    .encourage-icon { font-size:24px;flex-shrink:0;margin-top:2px; }
    .encourage-text { font-size:15px;line-height:1.7;color:#c4b5fd; }
    /* Note content */
    .note-content { background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:28px 32px;margin-bottom:28px; }
    .note-content h1 { font-size:1.6rem;font-weight:800;color:#c4b5fd;margin:0 0 12px; }
    .note-content h2 { font-size:1.25rem;font-weight:700;color:#c4b5fd;margin:20px 0 8px; }
    .note-content h3 { font-size:1.05rem;font-weight:700;color:#a5b4fc;margin:16px 0 6px; }
    .note-content p { margin-bottom:12px;color:#cbd5e1; }
    .note-content ul,.note-content ol { padding-left:20px;margin-bottom:12px;color:#cbd5e1; }
    .note-content li { margin-bottom:4px; }
    .note-content code { background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:0.85em;color:#93c5fd; }
    .note-content pre { background:#0d1117;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;overflow-x:auto;margin:12px 0; }
    .note-content pre code { background:none;padding:0;color:#e2e8f0; }
    .note-content strong { color:#e2e8f0;font-weight:700; }
    .note-content em { color:#a5b4fc; }
    .note-content img { max-width:100%;border-radius:10px;margin:12px 0;border:1px solid rgba(255,255,255,0.08); }
    .note-content blockquote { border-left:3px solid #6366f1;padding-left:16px;color:#94a3b8;font-style:italic;margin:12px 0; }
    /* AI sections */
    .section-label { font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:14px;display:flex;align-items:center;gap:8px; }
    .section-label::before { content:'';display:inline-block;width:3px;height:13px;border-radius:2px; }
    .ai-section { background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:22px 24px;margin-bottom:20px; }
    /* Summary */
    .summary-label { color:#6366f1; }
    .summary-label::before { background:linear-gradient(135deg,#6366f1,#8b5cf6); }
    .tutor-summary { font-size:14px;color:#94a3b8;line-height:1.75; }
    .tutor-summary strong { color:#c4b5fd;font-weight:600; }
    /* Review tips */
    .review-label { color:#10b981; }
    .review-label::before { background:linear-gradient(135deg,#10b981,#0ea5e9); }
    /* Reasoning */
    .reasoning-label { color:#8b5cf6; }
    .reasoning-label::before { background:linear-gradient(135deg,#8b5cf6,#6366f1); }
    /* Concepts */
    .concepts-label { color:#f59e0b; }
    .concepts-label::before { background:linear-gradient(135deg,#f59e0b,#ef4444); }
    /* Mind map */
    .mindmap-label { color:#0ea5e9; }
    .mindmap-label::before { background:linear-gradient(135deg,#0ea5e9,#6366f1); }
    /* Footer */
    footer { margin-top:48px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px; }
    .brand { font-size:13px;font-weight:700;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent; }
    .slug { font-family:monospace;font-size:11px;color:#475569; }
    @media (max-width:640px) {
      h1 { font-size:1.6rem; }
      .note-content { padding:20px; }
      .ai-section { padding:16px; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  ${safeSubject ? `<div class="badge">📚 ${safeSubject}</div>` : ''}
  <h1>${safeTitle}</h1>
  <div class="meta">
    <span>📅 ${date}</span>
    <span style="font-family:monospace;font-size:11px;">${safeSlug}</span>
  </div>

  <!-- Encouragement -->
  <div class="encourage">
    <div class="encourage-icon">💡</div>
    <div class="encourage-text">${safeEncouragement}</div>
  </div>

  <!-- Note content -->
  <div class="note-content">${safeContent}</div>

  ${safeSummary ? `
  <!-- AI Summary -->
  <div class="ai-section">
    <div class="section-label summary-label">✨ AI Summary</div>
    <div class="tutor-summary">${safeSummary}</div>
  </div>` : ''}

  ${reviewTipsHtml ? `
  <!-- Review Tips -->
  <div class="ai-section">
    <div class="section-label review-label">🎯 Review Tips</div>
    ${reviewTipsHtml}
  </div>` : ''}

  ${reasoningHtml ? `
  <!-- Reasoning Logic -->
  <div class="ai-section">
    <div class="section-label reasoning-label">🧠 Reasoning Logic</div>
    ${reasoningHtml}
  </div>` : ''}

  ${knowledgePillsHtml ? `
  <!-- Key Concepts -->
  <div class="ai-section">
    <div class="section-label concepts-label">🔑 Key Concepts</div>
    <div>${knowledgePillsHtml}</div>
  </div>` : ''}

  ${mindMapHtml ? `
  <!-- Mind Map -->
  <div class="ai-section">
    <div class="section-label mindmap-label">🗺️ Mind Map</div>
    ${mindMapHtml}
  </div>` : ''}

  <!-- Footer -->
  <footer>
    <span class="brand">CogniBloom — AI Learning Platform</span>
    <span class="slug">${safeSlug}</span>
  </footer>

</div>
</body>
</html>`
}

// POST /api/notes/[noteId]/publish
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { noteId } = await params
    const userId = DANIEL_USER_ID

    const note = await db.note.findFirst({ where: { id: noteId, userId } })
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    // Generate or reuse slug
    const slug = note.publishedSlug ?? await generateSlug(note.subject, note.createdAt)

    // Generate AI enrichment (encouragement + review tips) at publish time
    const enrichment = await generateEnrichment({
      title: note.title,
      subject: note.subject,
      tutorSummary: note.tutorSummary,
      content: note.content,
    })

    // Build the published HTML page with all AI content
    const publishedHtml = buildPublishedPage({
      title: note.title,
      subject: note.subject,
      content: note.content,
      tutorSummary: note.tutorSummary,
      knowledgePoints: note.knowledgePoints,
      mindMap: note.mindMap,
      reasoningHints: note.reasoningHints,
      publishedSlug: slug,
      createdAt: note.createdAt,
      enrichment,
    })

    const updated = await db.note.update({
      where: { id: noteId },
      data: { publishedHtml, publishedSlug: slug, publishedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      data: {
        slug: updated.publishedSlug,
        publishedAt: updated.publishedAt,
        url: `/notes/view/${slug}`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Publish failed' }, { status: 500 })
  }
}

// GET /api/notes/[noteId]/publish — current publish status
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { noteId } = await params
    const userId = DANIEL_USER_ID

    const note = await db.note.findFirst({
      where: { id: noteId, userId },
      select: { publishedSlug: true, publishedAt: true },
    })
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    return NextResponse.json({
      success: true,
      data: {
        slug: note.publishedSlug,
        publishedAt: note.publishedAt,
        url: note.publishedSlug ? `/notes/view/${note.publishedSlug}` : null,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
