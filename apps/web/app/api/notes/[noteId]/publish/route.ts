import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'

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

async function generateSlug(subject: string | null, date: Date): Promise<string> {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const subjectPart = sanitizeSlugPart(subject ?? 'Note') || 'Note'

  // Count existing notes with same date+subject prefix to get index
  const prefix = `${dateStr}_${subjectPart}_`
  const existing = await db.note.findMany({
    where: { publishedSlug: { startsWith: prefix } },
    select: { publishedSlug: true },
  })
  const index = (existing.length + 1).toString().padStart(3, '0')
  return `${prefix}${index}`
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
}): string {
  const date = new Date(note.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  // Render knowledge points as pills
  let knowledgePillsHtml = ''
  try {
    const kps = JSON.parse(note.knowledgePoints ?? '[]') as { term: string; definition: string; importance: string }[]
    knowledgePillsHtml = kps.map((kp) => {
      const color = kp.importance === 'core' ? '#6366f1' : kp.importance === 'supporting' ? '#10b981' : '#f59e0b'
      return `<span title="${escapeAttribute(kp.definition)}" style="display:inline-flex;align-items:center;gap:6px;background:${color}18;border:1px solid ${color}40;color:${color};border-radius:999px;padding:3px 12px;font-size:12px;font-weight:600;cursor:help;margin:3px;">${escapeHtml(kp.term)}</span>`
    }).join('')
  } catch { /* empty */ }

  // Render mind map as simple nested list
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

  // Render reasoning hints as steps
  let reasoningHtml = ''
  try {
    const hints = JSON.parse(note.reasoningHints ?? '[]') as { step: number; hint: string }[]
    reasoningHtml = hints.map((h) => `
      <div style="display:flex;gap:12px;margin-bottom:10px;align-items:flex-start;">
        <span style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;">${h.step}</span>
        <span style="font-size:14px;line-height:1.5;padding-top:3px;">${escapeHtml(h.hint)}</span>
      </div>`).join('')
  } catch { /* empty */ }

  const safeTitle = escapeHtml(note.title)
  const safeSubject = note.subject ? escapeHtml(note.subject) : null
  const safeContent = sanitizeRichHtml(note.content)
  const safeSummary = note.tutorSummary ? sanitizeRichHtml(note.tutorSummary) : null
  const safeSlug = escapeHtml(note.publishedSlug)
  const hasAI = knowledgePillsHtml || mindMapHtml || reasoningHtml || safeSummary

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle} - CogniBloom</title>
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
    .header { margin-bottom: 40px; }
    .badge { display:inline-flex;align-items:center;gap:6px;background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);border-radius:999px;padding:4px 14px;font-size:12px;font-weight:600;margin-bottom:16px; }
    h1 { font-size: 2.2rem; font-weight: 900; background: linear-gradient(135deg,#a5b4fc,#c4b5fd); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 10px; line-height: 1.2; }
    .meta { font-size: 13px; color: #64748b; display:flex;gap:16px;flex-wrap:wrap; }
    /* Note content */
    .note-content { background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:28px 32px;margin-bottom:32px; }
    .note-content h2 { font-size:1.3rem;font-weight:700;color:#c4b5fd;margin:20px 0 8px; }
    .note-content h3 { font-size:1.1rem;font-weight:700;color:#a5b4fc;margin:16px 0 6px; }
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
    .ai-section { background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:24px;margin-bottom:20px; }
    .ai-section-title { font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#6366f1;margin-bottom:16px;display:flex;align-items:center;gap:8px; }
    .ai-section-title::before { content:'';display:inline-block;width:3px;height:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:2px; }
    .tutor-summary { font-size:14px;color:#94a3b8;line-height:1.7; }
    .tutor-summary strong { color:#c4b5fd;font-weight:600; }
    /* Footer */
    footer { margin-top:48px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px; }
    .brand { font-size:13px;font-weight:700;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent; }
    .slug { font-family:monospace;font-size:11px;color:#475569; }
  </style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    ${safeSubject ? `<div class="badge">Subject: ${safeSubject}</div>` : ''}
    <h1>${safeTitle}</h1>
    <div class="meta">
      <span>📅 ${date}</span>
      <span>${safeSlug}</span>
    </div>
  </div>

  <!-- Note content -->
  <div class="note-content">
    ${safeContent}
  </div>

  ${hasAI ? `
  <!-- AI Analysis -->
  ${knowledgePillsHtml ? `
  <div class="ai-section">
    <div class="ai-section-title">Key Concepts</div>
    <div>${knowledgePillsHtml}</div>
  </div>` : ''}

  ${mindMapHtml ? `
  <div class="ai-section">
    <div class="ai-section-title">Mind Map</div>
    ${mindMapHtml}
  </div>` : ''}

  ${reasoningHtml ? `
  <div class="ai-section">
    <div class="ai-section-title">Reasoning Steps</div>
    ${reasoningHtml}
  </div>` : ''}

  ${safeSummary ? `
  <div class="ai-section">
    <div class="ai-section-title">Tutor Notes</div>
    <div class="tutor-summary">${safeSummary}</div>
  </div>` : ''}
  ` : ''}

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

    // Build the published HTML page
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
    })

    const updated = await db.note.update({
      where: { id: noteId },
      data: {
        publishedHtml,
        publishedSlug: slug,
        publishedAt: new Date(),
      },
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

// GET /api/notes/[noteId]/publish — get current publish status
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
