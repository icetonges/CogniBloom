import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { chatWithFallback } from '@/lib/ai/fallback'
import { z } from 'zod'

type RouteParams = { params: Promise<{ noteId: string }> }
export const maxDuration = 60

// ── Zod schema ─────────────────────────────────────────────────────────────────
const mindMapNodeSchema: z.ZodType<{ label: string; children?: unknown[] }> = z.object({
  label: z.string().min(1),
  children: z.array(z.any()).default([]),
})

const analysisSchema = z.object({
  mindMap: mindMapNodeSchema,
  reasoningHints: z.array(z.object({
    step: z.number(),
    hint: z.string().min(1),
  })).default([]),
  knowledgePoints: z.array(z.object({
    term: z.string().min(1),
    definition: z.string().min(1),
    importance: z.enum(['core', 'supporting', 'context']).catch('supporting'),
  })).default([]),
  tutorSummary: z.string().default(''),
})

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Strip HTML tags to plain text for the AI prompt */
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
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Robustly extract the first complete JSON object from an AI response that may
 * contain markdown fences, preamble, thinking tokens, or trailing text.
 * Uses brace-depth tracking so it handles nested objects correctly.
 */
function extractJSON(text: string): string {
  if (!text || !text.trim()) return ''

  // Strip <thinking>...</thinking> blocks (some models emit these)
  const noThinking = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim()
  const s = noThinking || text

  // Walk the string tracking brace depth to find the first complete {...} object
  let depth = 0
  let start = -1
  let inString = false
  let escape = false

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        return s.slice(start, i + 1)
      }
    }
  }

  // Fallback: strip any markdown fences and return what's left
  return s
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/```\s*$/im, '')
    .trim()
}

// ── Route handler ──────────────────────────────────────────────────────────────

// POST /api/notes/[noteId]/analyze
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { noteId } = await params
    const userId = DANIEL_USER_ID

    const note = await db.note.findFirst({ where: { id: noteId, userId } })
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    const plainText = htmlToText(note.content)
    if (plainText.length < 20) {
      return NextResponse.json({ error: 'Note content too short to analyze' }, { status: 400 })
    }

    // Accept an optional model override from the request body
    let preferredModel: string | undefined
    try {
      const body = await _request.json() as { model?: string }
      if (body?.model) preferredModel = body.model
    } catch { /* no body is fine */ }

    const prompt = `You are an expert K-12 tutor. Analyze the student note below and return ONLY a single JSON object — no markdown, no explanation, nothing outside the JSON.

STUDENT NOTE TITLE: ${note.title}
SUBJECT: ${note.subject ?? 'General'}

CONTENT:
${plainText.slice(0, 4000)}

Return exactly this JSON shape (fill in real values, keep the exact field names):
{
  "mindMap": {
    "label": "<root topic name>",
    "children": [
      {
        "label": "<subtopic>",
        "children": [
          { "label": "<detail>", "children": [] }
        ]
      }
    ]
  },
  "reasoningHints": [
    { "step": 1, "hint": "<actionable reasoning step for the student>" },
    { "step": 2, "hint": "<next step>" }
  ],
  "knowledgePoints": [
    { "term": "<key term>", "definition": "<clear one-sentence definition>", "importance": "core" },
    { "term": "<supporting term>", "definition": "<definition>", "importance": "supporting" }
  ],
  "tutorSummary": "<2-3 sentences of expert teacher observations as plain text. Mention common mistakes and connections to broader concepts.>"
}

Rules:
- mindMap: 1 root node, 3-6 main branches, each branch 1-3 child nodes
- reasoningHints: 3-6 steps that scaffold the student's logical thinking
- knowledgePoints: 4-8 terms; importance must be exactly one of: core, supporting, context
- tutorSummary: helpful teacher-voice paragraph (plain text, no HTML tags needed)
- Return ONLY the JSON object. No other text.`

    const response = await chatWithFallback(
      { messages: [{ role: 'user', content: prompt }], temperature: 0.2, maxTokens: 2000 },
      preferredModel
    )
    console.info(`[analyze] responded via ${response.usedModel}${response.failedModels.length ? ` (skipped: ${response.failedModels.join(', ')})` : ''}`)

    const raw = extractJSON(response.content)

    if (!raw) {
      console.error('[analyze] Empty response from AI. Raw:', JSON.stringify(response.content).slice(0, 200))
      return NextResponse.json(
        { error: 'AI returned an empty response — please retry' },
        { status: 502 }
      )
    }

    let parsed: z.infer<typeof analysisSchema>
    try {
      const jsonObj = JSON.parse(raw)
      const result = analysisSchema.safeParse(jsonObj)
      if (result.success) {
        parsed = result.data
      } else {
        // Schema mismatch — try to coerce what we can by using partial parse
        console.warn('[analyze] Zod schema mismatch, using partial data:', result.error.flatten())
        parsed = analysisSchema.parse({
          mindMap: jsonObj.mindMap ?? jsonObj.mind_map ?? { label: note.title, children: [] },
          reasoningHints: jsonObj.reasoningHints ?? jsonObj.reasoning_hints ?? jsonObj.hints ?? [],
          knowledgePoints: jsonObj.knowledgePoints ?? jsonObj.knowledge_points ?? jsonObj.concepts ?? [],
          tutorSummary: jsonObj.tutorSummary ?? jsonObj.tutor_summary ?? jsonObj.summary ?? '',
        })
      }
    } catch (parseErr) {
      console.error('[analyze] JSON/Zod parse failed. Raw excerpt:', raw.slice(0, 300), parseErr)
      return NextResponse.json(
        { error: 'AI returned invalid response — please retry' },
        { status: 502 }
      )
    }

    const updated = await db.note.update({
      where: { id: noteId },
      data: {
        mindMap: JSON.stringify(parsed.mindMap),
        reasoningHints: JSON.stringify(parsed.reasoningHints),
        knowledgePoints: JSON.stringify(parsed.knowledgePoints),
        tutorSummary: parsed.tutorSummary,
        aiAnalyzedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        mindMap: updated.mindMap,
        reasoningHints: updated.reasoningHints,
        knowledgePoints: updated.knowledgePoints,
        tutorSummary: updated.tutorSummary,
        aiAnalyzedAt: updated.aiAnalyzedAt,
      },
    })
  } catch (error) {
    console.error('[analyze] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}
