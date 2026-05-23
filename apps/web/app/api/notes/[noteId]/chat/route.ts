import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { streamWithFallback } from '@/lib/ai/fallback'

export const maxDuration = 60

type RouteParams = { params: Promise<{ noteId: string }> }

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

// POST /api/notes/[noteId]/chat
// Streams an AI response grounded in the specific note content.
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { noteId } = await params
    const userId = DANIEL_USER_ID

    const note = await db.note.findFirst({
      where: { id: noteId, userId },
      select: { id: true, title: true, subject: true, content: true },
    })
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const body = await request.json() as { message: string; history?: Array<{ role: string; content: string }>; model?: string }
    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    const noteText = htmlToText(note.content).slice(0, 6000)

    const systemPrompt = `You are an expert AI tutor for a K-12 student named Daniel. You are specifically helping him understand and study the following note.

NOTE TITLE: ${note.title}
SUBJECT: ${note.subject ?? 'General'}

NOTE CONTENT:
${noteText}

Your role:
- Answer questions directly about the content of this note
- Help Daniel understand concepts he doesn't fully grasp
- Create quiz questions to test his knowledge of the note
- Identify gaps in his understanding
- Suggest what he should study next based on this note
- Generate study plans, memory aids, or practice problems
- Use encouraging, friendly language appropriate for a 12-year-old

When discussing math, use LaTeX notation wrapped in $ for inline and $$ for block formulas.
Keep answers focused on the note content. If asked something outside the note's scope, briefly answer then redirect to the note.`

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...(body.history ?? []).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: body.message },
    ]

    const encoder = new TextEncoder()
    const chunks: string[] = []

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamWithFallback(
            { messages, temperature: 0.6, maxTokens: 1500 },
            body.model
          )) {
            if (chunk.content) {
              chunks.push(chunk.content)
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'content', content: chunk.content })}\n\n`)
              )
            }
          }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
          )
          controller.close()
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'AI response failed'
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
