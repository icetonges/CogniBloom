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
  const noThink = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim()
  const s = noThink || text
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

// ── AI Writer ─────────────────────────────────────────────────────────────────

interface WriterOutput {
  publishTitle: string
  publishArticle: string
  encouragement: string
  reviewTips: string[]
  socialPost: string
}

async function generateWriterContent(note: {
  title: string
  subject: string | null
  tutorSummary: string | null
  content: string
  knowledgePoints: string | null
}): Promise<WriterOutput> {
  const plainText = htmlToText(note.content).slice(0, 3000)
  const summaryLine = note.tutorSummary ? `\nAI Summary: ${htmlToText(note.tutorSummary).slice(0, 400)}` : ''
  let keyTerms = ''
  try {
    const kps = JSON.parse(note.knowledgePoints ?? '[]') as { term: string; definition: string }[]
    keyTerms = kps.map(k => `${k.term}: ${k.definition}`).slice(0, 5).join('\n')
  } catch { /* ignore */ }

  const prompt = `You are a professional content writer and learning coach for a student named Daniel. He has just finished a study session and written notes. Your job is to:

1. Craft a compelling TITLE that captures the exact insight or skill learned — concise, specific, interesting (max 75 characters). NOT generic like "Notes on X". Something like "Why Recursion Clicked for Me" or "3 Mental Models That Unlock Async JavaScript".

2. Write a HIGH-QUALITY ARTICLE that transforms the raw notes into polished, flowing content covering every concept. Use <p>, <strong>, <em>, <ul>, <li>, <h3> tags only. Make it educational yet personal — as if Daniel is sharing what he learned with the world. 3-5 paragraphs minimum.

3. Write an ENCOURAGEMENT message (2 sentences, warm and specific to what Daniel studied — address him by name).

4. Write 3 REVIEW TIPS — specific, actionable, tied to the exact subject matter (not generic advice).

5. Write a SOCIAL POST for Instagram/TikTok/X — conversational, hook-first, max 240 chars, include 3-4 trending relevant hashtags. Make it the kind of post that makes other students feel excited to learn this topic. Gen Z tone okay.

Study note details:
Title: ${note.title}
Subject: ${note.subject ?? 'General'}${summaryLine}
${keyTerms ? `\nKey terms:\n${keyTerms}` : ''}

Raw note content:
${plainText.slice(0, 2500)}

Return ONLY a JSON object — no markdown, no preamble:
{
  "publishTitle": "...",
  "publishArticle": "<p>...</p>...",
  "encouragement": "...",
  "reviewTips": ["...", "...", "..."],
  "socialPost": "..."
}`

  const defaults: WriterOutput = {
    publishTitle: note.title,
    publishArticle: sanitizeRichHtml(note.content),
    encouragement: `Great work publishing this note, Daniel — every session builds your foundation. Keep showing up!`,
    reviewTips: [
      'Cover the note and try to recall the main ideas from memory.',
      'Create a practice problem based on the core concepts.',
      'Explain the topic out loud as if teaching it to someone new.',
    ],
    socialPost: `Just leveled up my understanding of ${note.subject ?? 'this topic'}! 🧠 Consistent studying + AI tools = growth. #LearnInPublic #StudyWithMe #CogniBloom`,
  }

  try {
    const response = await chatWithFallback({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.55,
      maxTokens: 1400,
    })
    const raw = extractJSON(response.content)
    const parsed = JSON.parse(raw) as Partial<WriterOutput>
    return {
      publishTitle: parsed.publishTitle?.trim() || defaults.publishTitle,
      publishArticle: parsed.publishArticle
        ? sanitizeRichHtml(parsed.publishArticle)
        : defaults.publishArticle,
      encouragement: parsed.encouragement || defaults.encouragement,
      reviewTips: Array.isArray(parsed.reviewTips) && parsed.reviewTips.length > 0
        ? parsed.reviewTips
        : defaults.reviewTips,
      socialPost: parsed.socialPost || defaults.socialPost,
    }
  } catch {
    return defaults
  }
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
      const ch = node.children?.length
        ? `<ul style="margin:4px 0 4px 20px;padding:0;list-style:none;">${node.children.map((c) => renderNode(c, depth + 1)).join('')}</ul>`
        : ''
      const bg = depth === 0 ? '#6366f1' : depth === 1 ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)'
      const color = depth === 0 ? '#fff' : 'inherit'
      return `<li style="margin:4px 0;"><span style="display:inline-block;background:${bg};color:${color};padding:${depth === 0 ? '6px 16px' : '4px 12px'};border-radius:8px;font-size:${depth === 0 ? '14px' : '13px'};font-weight:${depth === 0 ? 700 : 500};">${escapeHtml(node.label)}</span>${ch}</li>`
    }
    const root = JSON.parse(note.mindMap ?? 'null') as MindNode | null
    if (root) mindMapHtml = `<ul style="list-style:none;margin:0;padding:0;">${renderNode(root)}</ul>`
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
  const reviewTipsHtml = note.writer.reviewTips.map((tip, i) => `
    <div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start;">
      <span style="flex-shrink:0;width:22px;height:22px;border-radius:6px;background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.4);color:#10b981;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">${i + 1}</span>
      <span style="font-size:14px;line-height:1.6;padding-top:2px;color:#cbd5e1;">${escapeHtml(tip)}</span>
    </div>`).join('')

  const safePublishTitle = escapeHtml(note.writer.publishTitle)
  const safeOriginalTitle = escapeHtml(note.originalTitle)
  const safeSubject = note.subject ? escapeHtml(note.subject) : null
  const safeSlug = escapeHtml(note.publishedSlug)
  const safeEncouragement = escapeHtml(note.writer.encouragement)
  const safeSocialPost = escapeHtml(note.writer.socialPost)
  const safeArticle = note.writer.publishArticle
  const safeOriginalContent = sanitizeRichHtml(note.originalContent)
  const safeSummary = note.tutorSummary ? sanitizeRichHtml(note.tutorSummary) : null

  // ── Social share SVG icons ──
  const xIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.631L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>`
  const fbIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.411c0-3.025 1.791-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.971h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>`
  const igIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>`
  const ttIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.2 8.2 0 004.79 1.53V6.75a4.85 4.85 0 01-1.02-.06z"/></svg>`
  const threadIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.5 12.069V12c.024-3.506.906-6.346 2.621-8.44C5.854 1.338 8.496.024 11.988 0h.013c2.7.016 4.987.758 6.787 2.205 1.72 1.385 2.768 3.24 3.116 5.515l-2.898.53c-.287-1.67-.971-3.027-2.033-4.033-1.11-1.05-2.65-1.603-4.574-1.632H12.1c-2.59.034-4.567.941-5.881 2.695C5.127 6.718 4.5 8.9 4.48 11.996v.07c.02 3.1.647 5.285 1.74 6.729 1.315 1.752 3.294 2.66 5.882 2.694h.08c2.19-.027 3.77-.517 4.879-1.496.985-.864 1.597-2.15 1.82-3.821l2.898.53c-.292 2.36-1.2 4.2-2.69 5.47-1.637 1.39-3.848 2.11-6.594 2.118h-.31z"/></svg>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safePublishTitle} — CogniBloom</title>
  <meta property="og:title" content="${safePublishTitle}">
  <meta property="og:description" content="${safeEncouragement}">
  <meta property="og:type" content="article">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #060c18;
      color: #e2e8f0;
      min-height: 100vh;
      line-height: 1.6;
    }
    .page { max-width: 860px; margin: 0 auto; padding: 52px 24px 80px; }

    /* ── Header ── */
    .badge { display:inline-flex;align-items:center;gap:6px;background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);border-radius:999px;padding:4px 14px;font-size:12px;font-weight:600;margin-bottom:14px; }
    .eyebrow { font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#475569;margin-bottom:10px; }
    h1.publish-title { font-size:2.2rem;font-weight:900;background:linear-gradient(135deg,#a5b4fc,#c4b5fd 60%,#f0abfc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:10px;line-height:1.18; }
    .meta { font-size:12px;color:#64748b;display:flex;gap:14px;flex-wrap:wrap;margin-bottom:32px;align-items:center; }
    .divider { height:1px;background:rgba(255,255,255,0.06);margin:28px 0; }

    /* ── Encouragement ── */
    .encourage { background:linear-gradient(135deg,rgba(99,102,241,0.10),rgba(139,92,246,0.07));border:1px solid rgba(99,102,241,0.22);border-radius:16px;padding:18px 22px;margin-bottom:28px;display:flex;gap:14px;align-items:flex-start; }
    .encourage-icon { font-size:22px;flex-shrink:0; }
    .encourage-text { font-size:14px;line-height:1.75;color:#c4b5fd; }

    /* ── AI Article ── */
    .article-wrap { background:rgba(255,255,255,0.02);border:1px solid rgba(99,102,241,0.18);border-radius:18px;padding:30px 34px;margin-bottom:22px; }
    .article-wrap h3 { font-size:1.05rem;font-weight:700;color:#a5b4fc;margin:18px 0 7px; }
    .article-wrap p { margin-bottom:14px;color:#cbd5e1;font-size:15px;line-height:1.8; }
    .article-wrap ul,.article-wrap ol { padding-left:22px;margin-bottom:14px;color:#cbd5e1;font-size:15px; }
    .article-wrap li { margin-bottom:5px;line-height:1.7; }
    .article-wrap strong { color:#e2e8f0;font-weight:700; }
    .article-wrap em { color:#a5b4fc; }

    /* ── Original notes (collapsible) ── */
    details.raw-notes { background:rgba(255,255,255,0.015);border:1px solid rgba(255,255,255,0.07);border-radius:14px;margin-bottom:22px;overflow:hidden; }
    details.raw-notes summary { cursor:pointer;padding:14px 20px;font-size:13px;font-weight:600;color:#64748b;display:flex;align-items:center;gap:8px;list-style:none;user-select:none; }
    details.raw-notes summary::before { content:'▶';font-size:10px;transition:transform .2s;display:inline-block; }
    details.raw-notes[open] summary::before { transform:rotate(90deg); }
    details.raw-notes summary:hover { color:#94a3b8; }
    .raw-content { padding:20px 24px;border-top:1px solid rgba(255,255,255,0.06); }
    .raw-content h1,.raw-content h2 { font-size:1.1rem;font-weight:700;color:#c4b5fd;margin:12px 0 6px; }
    .raw-content h3 { font-size:1rem;font-weight:700;color:#a5b4fc;margin:10px 0 5px; }
    .raw-content p { margin-bottom:10px;color:#94a3b8;font-size:13px;line-height:1.7; }
    .raw-content ul,.raw-content ol { padding-left:18px;margin-bottom:10px;color:#94a3b8;font-size:13px; }
    .raw-content li { margin-bottom:3px; }
    .raw-content code { background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:.82em;color:#93c5fd; }
    .raw-content pre { background:#0d1117;border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:14px;overflow-x:auto;margin:10px 0; }
    .raw-content pre code { background:none;padding:0;color:#e2e8f0; }
    .raw-content strong { color:#cbd5e1;font-weight:700; }
    .raw-content blockquote { border-left:3px solid #6366f1;padding-left:14px;color:#64748b;font-style:italic;margin:10px 0;font-size:13px; }

    /* ── AI sections ── */
    .section-label { font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px;display:flex;align-items:center;gap:8px; }
    .section-label::before { content:'';display:inline-block;width:3px;height:13px;border-radius:2px; }
    .ai-section { background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:20px 22px;margin-bottom:18px; }
    .summary-label { color:#6366f1; } .summary-label::before { background:linear-gradient(135deg,#6366f1,#8b5cf6); }
    .review-label  { color:#10b981; } .review-label::before  { background:linear-gradient(135deg,#10b981,#0ea5e9); }
    .reasoning-label { color:#8b5cf6; } .reasoning-label::before { background:linear-gradient(135deg,#8b5cf6,#6366f1); }
    .concepts-label  { color:#f59e0b; } .concepts-label::before  { background:linear-gradient(135deg,#f59e0b,#ef4444); }
    .mindmap-label   { color:#0ea5e9; } .mindmap-label::before   { background:linear-gradient(135deg,#0ea5e9,#6366f1); }
    .tutor-summary { font-size:14px;color:#94a3b8;line-height:1.8; }
    .tutor-summary strong { color:#c4b5fd;font-weight:600; }

    /* ── Social Share ── */
    .social-section { background:linear-gradient(135deg,rgba(15,23,42,0.9),rgba(30,27,75,0.7));border:1px solid rgba(99,102,241,0.25);border-radius:20px;padding:28px 28px 24px;margin-top:32px; }
    .social-header { display:flex;align-items:center;gap:10px;margin-bottom:18px; }
    .social-header-icon { width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0; }
    .social-header-text h3 { font-size:15px;font-weight:800;color:#e2e8f0; }
    .social-header-text p { font-size:12px;color:#64748b;margin-top:1px; }
    .social-post-card { background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.09);border-radius:14px;padding:16px 18px;margin-bottom:20px;position:relative; }
    .social-post-text { font-size:14px;line-height:1.7;color:#cbd5e1;white-space:pre-wrap; }
    .copy-btn { position:absolute;top:12px;right:12px;background:rgba(99,102,241,0.18);border:1px solid rgba(99,102,241,0.35);color:#a5b4fc;border-radius:8px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;transition:all .15s; }
    .copy-btn:hover { background:rgba(99,102,241,0.3); }
    .copy-btn.copied { color:#10b981;border-color:rgba(16,185,129,0.4);background:rgba(16,185,129,0.1); }
    .platforms-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px; }
    .platform-btn { display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 12px;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;border:none;transition:all .18s;text-decoration:none;color:#fff; }
    .platform-btn:hover { transform:translateY(-2px);filter:brightness(1.12); }
    .platform-btn:active { transform:translateY(0); }
    .btn-x        { background:#000;border:1px solid #333; }
    .btn-facebook { background:#1877f2; }
    .btn-instagram { background:linear-gradient(135deg,#f58529,#dd2a7b,#8134af,#515bd4); }
    .btn-tiktok   { background:#010101;border:1px solid #333; }
    .btn-threads  { background:#101010;border:1px solid #333; }
    .share-note { font-size:11px;color:#475569;margin-top:14px;text-align:center; }

    /* ── Footer ── */
    footer { margin-top:48px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px; }
    .brand { font-size:13px;font-weight:800;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent; }
    .slug { font-family:monospace;font-size:11px;color:#475569; }

    @media (max-width:640px) {
      h1.publish-title { font-size:1.65rem; }
      .article-wrap { padding:20px; }
      .platforms-grid { grid-template-columns:1fr 1fr; }
      .social-section { padding:20px 18px; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- ── Header ── -->
  <div class="eyebrow">CogniBloom · Published Study Note</div>
  ${safeSubject ? `<div class="badge">📚 ${safeSubject}</div>` : ''}
  <h1 class="publish-title">${safePublishTitle}</h1>
  <div class="meta">
    <span>📅 ${date}</span>
    ${safeOriginalTitle !== safePublishTitle ? `<span style="color:#374151;">Original: "${safeOriginalTitle}"</span>` : ''}
  </div>

  <!-- ── Encouragement ── -->
  <div class="encourage">
    <div class="encourage-icon">💡</div>
    <div class="encourage-text">${safeEncouragement}</div>
  </div>

  <!-- ── AI-Written Article ── -->
  <div class="article-wrap">
    ${safeArticle}
  </div>

  <!-- ── Original Notes (collapsible) ── -->
  <details class="raw-notes">
    <summary>📓 View Original Study Notes</summary>
    <div class="raw-content">${safeOriginalContent}</div>
  </details>

  <!-- ── AI Summary ── -->
  ${safeSummary ? `
  <div class="ai-section">
    <div class="section-label summary-label">✨ AI Tutor Summary</div>
    <div class="tutor-summary">${safeSummary}</div>
  </div>` : ''}

  <!-- ── Review Tips ── -->
  ${reviewTipsHtml ? `
  <div class="ai-section">
    <div class="section-label review-label">🎯 Review Tips</div>
    ${reviewTipsHtml}
  </div>` : ''}

  <!-- ── Reasoning Logic ── -->
  ${reasoningHtml ? `
  <div class="ai-section">
    <div class="section-label reasoning-label">🧠 Reasoning Logic</div>
    ${reasoningHtml}
  </div>` : ''}

  <!-- ── Key Concepts ── -->
  ${knowledgePillsHtml ? `
  <div class="ai-section">
    <div class="section-label concepts-label">🔑 Key Concepts</div>
    <div>${knowledgePillsHtml}</div>
  </div>` : ''}

  <!-- ── Mind Map ── -->
  ${mindMapHtml ? `
  <div class="ai-section">
    <div class="section-label mindmap-label">🗺️ Mind Map</div>
    ${mindMapHtml}
  </div>` : ''}

  <!-- ── Social Share ── -->
  <div class="social-section">
    <div class="social-header">
      <div class="social-header-icon">📱</div>
      <div class="social-header-text">
        <h3>Share What You Learned</h3>
        <p>Post this to your feed and inspire others to keep learning</p>
      </div>
    </div>

    <div class="social-post-card">
      <div class="social-post-text" id="social-post-text">${safeSocialPost}</div>
      <button class="copy-btn" id="copy-btn" onclick="copyPost()">Copy</button>
    </div>

    <div class="platforms-grid">
      <button class="platform-btn btn-x" onclick="shareX()">${xIcon} X</button>
      <button class="platform-btn btn-facebook" onclick="shareFacebook()">${fbIcon} Facebook</button>
      <button class="platform-btn btn-instagram" onclick="copyForPlatform('Instagram')">${igIcon} Instagram</button>
      <button class="platform-btn btn-tiktok" onclick="copyForPlatform('TikTok')">${ttIcon} TikTok</button>
      <button class="platform-btn btn-threads" onclick="shareThreads()">${threadIcon} Threads</button>
    </div>
    <p class="share-note">Instagram and TikTok will copy the text to your clipboard — then paste it in your caption.</p>
  </div>

  <!-- ── Footer ── -->
  <footer>
    <span class="brand">CogniBloom — AI Learning Platform</span>
    <span class="slug">${safeSlug}</span>
  </footer>

</div>

<script>
(function() {
  var socialText = document.getElementById('social-post-text').textContent.trim()

  function showCopied(btn, label) {
    var orig = btn.textContent
    btn.textContent = label || '✓ Copied!'
    btn.classList.add('copied')
    setTimeout(function() { btn.textContent = orig; btn.classList.remove('copied') }, 2000)
  }

  window.copyPost = function() {
    navigator.clipboard.writeText(socialText + '\\n\\n' + window.location.href)
      .then(function() { showCopied(document.getElementById('copy-btn')) })
      .catch(function() {
        var ta = document.createElement('textarea')
        ta.value = socialText + '\\n\\n' + window.location.href
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
        showCopied(document.getElementById('copy-btn'))
      })
  }

  window.copyForPlatform = function(platform) {
    var text = socialText + '\\n\\n' + window.location.href
    var btns = document.querySelectorAll('.platform-btn')
    var targetBtn = null
    btns.forEach(function(b) { if (b.textContent.trim().includes(platform)) targetBtn = b })
    navigator.clipboard.writeText(text)
      .then(function() { if (targetBtn) showCopied(targetBtn, '✓ Copied!') })
      .catch(function() {
        var ta = document.createElement('textarea')
        ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
        if (targetBtn) showCopied(targetBtn, '✓ Copied!')
      })
  }

  window.shareX = function() {
    var url = encodeURIComponent(window.location.href)
    var text = encodeURIComponent(socialText + '\\n\\n')
    window.open('https://twitter.com/intent/tweet?text=' + text + '&url=' + url, '_blank', 'width=600,height=500')
  }

  window.shareFacebook = function() {
    var url = encodeURIComponent(window.location.href)
    window.open('https://www.facebook.com/sharer/sharer.php?u=' + url, '_blank', 'width=600,height=500')
  }

  window.shareThreads = function() {
    var text = encodeURIComponent(socialText + '\\n\\n' + window.location.href)
    window.open('https://www.threads.net/intent/post?text=' + text, '_blank', 'width=600,height=600')
  }
})()
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

    // Run the AI writer — produces title, article, encouragement, review tips, social post
    const writer = await generateWriterContent({
      title: note.title,
      subject: note.subject,
      tutorSummary: note.tutorSummary,
      content: note.content,
      knowledgePoints: note.knowledgePoints,
    })

    const publishedHtml = buildPublishedPage({
      originalTitle: note.title,
      subject: note.subject,
      originalContent: note.content,
      tutorSummary: note.tutorSummary,
      knowledgePoints: note.knowledgePoints,
      mindMap: note.mindMap,
      reasoningHints: note.reasoningHints,
      publishedSlug: slug,
      createdAt: note.createdAt,
      writer,
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
        publishTitle: writer.publishTitle,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Publish failed' }, { status: 500 })
  }
}

// ── GET /api/notes/[noteId]/publish ──────────────────────────────────────────

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
