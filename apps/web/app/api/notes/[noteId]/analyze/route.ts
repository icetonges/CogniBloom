import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { getAIManager } from '@/lib/ai'

type RouteParams = { params: Promise<{ noteId: string }> }

// Strip HTML tags to get plain text for the AI prompt
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

// POST /api/notes/[noteId]/analyze
// Runs AI expert-tutor analysis and saves results back to the note.
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

    const prompt = `You are an expert K-12 tutor. Analyze the following student note and respond with ONLY valid JSON — no markdown, no explanation outside the JSON.

STUDENT NOTE TITLE: ${note.title}
SUBJECT: ${note.subject ?? 'General'}

CONTENT:
${plainText.slice(0, 4000)}

Return this exact JSON shape:
{
  "mindMap": {
    "label": "<root topic>",
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
    { "step": 1, "hint": "<actionable reasoning step>" },
    { "step": 2, "hint": "<next step>" }
  ],
  "knowledgePoints": [
    { "term": "<key term>", "definition": "<clear definition>", "importance": "core" },
    { "term": "<supporting term>", "definition": "<definition>", "importance": "supporting" }
  ],
  "tutorSummary": "<HTML string: 2-3 paragraphs of expert teacher notes. Use <strong> for emphasis. No block-level elements like h1/h2.>"
}

Rules:
- mindMap: 1 root, 3-6 main branches, each with 1-3 sub-nodes
- reasoningHints: 3-6 steps that scaffold the student's logical thinking
- knowledgePoints: 4-8 terms; importance is exactly one of: core, supporting, context
- tutorSummary: insightful teacher observations, common mistakes to watch for, connections to broader concepts
- ONLY return the JSON object. Nothing else.`

    const aiManager = getAIManager()
    const response = await aiManager.chat('gemini-2.5-flash', {
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 2000,
    })

    // Strip markdown fences if present
    const raw = response.content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const parsed = JSON.parse(raw) as {
      mindMap: object
      reasoningHints: object[]
      knowledgePoints: object[]
      tutorSummary: string
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
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'AI returned invalid response — please retry' }, { status: 502 })
    }
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
