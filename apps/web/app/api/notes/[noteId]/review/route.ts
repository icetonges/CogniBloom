import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { chatWithFallback } from '@/lib/ai/fallback'

export const maxDuration = 60

// POST /api/notes/[noteId]/review — generate AI review of a note
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const userId = DANIEL_USER_ID
    const { noteId } = await params

    const note = await db.note.findFirst({ where: { id: noteId, userId } })
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const prompt = `You are an expert educational reviewer. Analyse this student's note and return a concise JSON review.

Note title: ${note.title}
${note.subject ? `Subject: ${note.subject}` : ''}
Note content:
${note.content.slice(0, 3000)}

Return ONLY valid JSON in this exact format:
{
  "summary": "1-2 sentence summary of what this note covers",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "weakAreas": ["gap or misconception to address (or empty array if none)"],
  "masteryEstimate": 0.75,
  "recommendations": ["specific suggestion to deepen understanding"]
}

Rules:
- masteryEstimate is 0.0–1.0 (how well the student seems to understand this topic based on the note)
- keyPoints: 3–5 bullet points
- weakAreas: honest gaps (empty array if the note is thorough)
- recommendations: 1–3 actionable suggestions
- Return ONLY JSON, no markdown fences`

    const res = await chatWithFallback(
      { messages: [{ role: 'user', content: prompt }], temperature: 0.3, maxTokens: 600 }
    )

    const raw = res.content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(raw) as {
      summary: string
      keyPoints: string[]
      weakAreas: string[]
      masteryEstimate: number
      recommendations: string[]
    }

    // Persist review to DB
    const review = await db.noteReview.create({
      data: {
        noteId,
        summary: parsed.summary,
        keyPoints: parsed.keyPoints,
        weakAreas: parsed.weakAreas,
        masteryEstimate: Math.min(1, Math.max(0, parsed.masteryEstimate)),
        recommendations: parsed.recommendations,
      },
    })

    return NextResponse.json({ success: true, data: review })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'AI returned invalid JSON — retry' }, { status: 502 })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/notes/[noteId]/review — fetch latest review
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const userId = DANIEL_USER_ID
  const { noteId } = await params

  const note = await db.note.findFirst({ where: { id: noteId, userId } })
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const review = await db.noteReview.findFirst({
    where: { noteId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: review ?? null })
}
