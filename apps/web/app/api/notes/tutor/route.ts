import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { streamWithFallback } from '@/lib/ai/fallback'
import { DEFAULT_MODEL_ID } from '@/lib/ai/models'
import type { ChatMessage } from '@/lib/ai/providers/types'
import { buildTutorSystemPrompt, resolveGrade } from '@/lib/tutor/reflection-tutor'

export const maxDuration = 60

// Most recent turns sent to the model; older ones are dropped.
const MAX_TURNS = 16

const bodySchema = z.object({
  question: z.string().trim().min(3).max(600),
  section: z.enum(['concept', 'later']),
  sessionId: z.string().max(64).optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(4000),
  })).max(60),
  noteTitle: z.string().max(200).nullable().optional(),
  noteSubject: z.string().max(100).nullable().optional(),
  noteExcerpt: z.string().max(6000).nullable().optional(),
})

function provider(model: string): string {
  if (model.startsWith('gemini')) return 'google'
  if (model.startsWith('claude')) return 'anthropic'
  return 'groq'
}

/**
 * POST /api/notes/tutor — the reflection tutor (Socratic, grade-aware).
 * Streams server-sent events: meta (grade + session), content chunks, done.
 * Each conversation is saved as a SOCRATIC_COACH tutor session, so it shows
 * up in the normal tutor history.
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const body = parsed.data

  const [prefs, user] = await Promise.all([
    db.userPreferences.findUnique({ where: { userId }, select: { grade: true, preferredModel: true } }),
    db.user.findUnique({ where: { id: userId }, select: { grade: true, age: true } }),
  ])
  const grade = resolveGrade({ settingsGrade: prefs?.grade, profileGrade: user?.grade, profileAge: user?.age })
  const model = prefs?.preferredModel || DEFAULT_MODEL_ID

  let sessionId = body.sessionId
  if (sessionId) {
    const existing = await db.tutorSession.findFirst({ where: { id: sessionId, userId }, select: { id: true } })
    if (!existing) sessionId = undefined
  }
  if (!sessionId) {
    const created = await db.tutorSession.create({
      data: {
        userId,
        mode: 'SOCRATIC_COACH',
        topic: body.question.slice(0, 190),
        aiProvider: provider(model),
        aiModel: model,
      },
      select: { id: true },
    })
    sessionId = created.id
  }

  // An empty history means "start": the tutor opens with its first question.
  const history: ChatMessage[] = body.messages.length
    ? body.messages.slice(-MAX_TURNS)
    : [{ role: 'user', content: body.question }]
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: buildTutorSystemPrompt({
        question: body.question,
        section: body.section,
        grade,
        noteTitle: body.noteTitle,
        noteSubject: body.noteSubject,
        noteExcerpt: body.noteExcerpt,
      }),
    },
    ...history,
  ]
  const lastUser = [...history].reverse().find((m) => m.role === 'user')

  const encoder = new TextEncoder()
  const send = (controller: ReadableStreamDefaultController, data: unknown) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

  const stream = new ReadableStream({
    async start(controller) {
      send(controller, { type: 'meta', sessionId, grade: { label: grade.label, source: grade.source } })
      const parts: string[] = []
      let outputTokens = 0
      try {
        for await (const chunk of streamWithFallback({ messages, temperature: 0.5, maxTokens: 700 }, model)) {
          if (chunk.tokensUsed) outputTokens = chunk.tokensUsed.output
          if (chunk.content) {
            parts.push(chunk.content)
            send(controller, { type: 'content', content: chunk.content })
          }
        }
        const reply = parts.join('')
        try {
          if (lastUser) {
            await db.tutorMessage.create({ data: { sessionId: sessionId!, role: 'user', content: lastUser.content, tokensUsed: 0 } })
          }
          if (reply) {
            await db.tutorMessage.create({ data: { sessionId: sessionId!, role: 'assistant', content: reply, tokensUsed: outputTokens } })
          }
          await db.tutorSession.update({
            where: { id: sessionId! },
            data: { messageCount: { increment: lastUser && reply ? 2 : 1 }, totalTokensUsed: { increment: outputTokens } },
          })
        } catch (e) {
          // History is nice to have; never fail the answer over it.
          console.warn('[reflection-tutor] could not save history', e)
        }
        send(controller, { type: 'done', sessionId })
      } catch (error) {
        send(controller, { type: 'error', error: error instanceof Error ? error.message : 'The tutor could not answer right now.' })
      }
      controller.close()
    },
  })

  return new NextResponse(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
