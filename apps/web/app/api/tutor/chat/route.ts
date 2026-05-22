import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { getAIManager } from '@/lib/ai'
import { getRagContext } from '@/lib/ai/rag'
import type { ChatMessage } from '@/lib/ai/providers/types'

interface ChatRequestBody {
  sessionId?: string
  messages: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  mode?: string
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: ChatRequestBody = await request.json()
    if (!body.messages || body.messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 })
    }

    const model = body.model || 'gemini-2.0-flash'
    const temperature = body.temperature ?? 0.7
    const maxTokens = body.maxTokens ?? 2048

    // Get or create session
    let sessionId = body.sessionId
    if (!sessionId) {
      const session = await db.tutorSession.create({
        data: {
          userId,
          mode: (body.mode as never) || 'GENERAL',
          aiProvider: extractProvider(model),
          aiModel: model,
        },
      })
      sessionId = session.id
    }

    const session = await db.tutorSession.findFirst({ where: { id: sessionId, userId } })
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    // Get RAG context from the student's notes
    const lastUserMsg = [...body.messages].reverse().find((m) => m.role === 'user')
    const ragContext = lastUserMsg ? await getRagContext(userId, lastUserMsg.content) : ''

    // Build system prompt with RAG context
    const baseSystemPrompt = getSystemPrompt(body.mode || 'general')
    const systemPrompt = ragContext
      ? `${baseSystemPrompt}\n\n${ragContext}\n\nUse the student's notes above as context when relevant. Reference them naturally in your response.`
      : baseSystemPrompt

    // Prepend system message
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...body.messages.filter((m) => m.role !== 'system'),
    ]

    const aiManager = getAIManager()
    const encoder = new TextEncoder()
    let totalInputTokens = 0
    let totalOutputTokens = 0
    const assistantChunks: string[] = []

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of aiManager.stream(model, { messages, temperature, maxTokens })) {
            if (chunk.tokensUsed) {
              totalInputTokens = chunk.tokensUsed.input
              totalOutputTokens = chunk.tokensUsed.output
            }
            if (chunk.content) {
              assistantChunks.push(chunk.content)
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'content', content: chunk.content })}\n\n`)
              )
            }
          }

          const assistantContent = assistantChunks.join('')

          // Persist messages
          if (lastUserMsg) {
            await db.tutorMessage.create({
              data: { sessionId: sessionId!, role: 'user', content: lastUserMsg.content, tokensUsed: 0 },
            })
          }
          if (assistantContent) {
            await db.tutorMessage.create({
              data: { sessionId: sessionId!, role: 'assistant', content: assistantContent, tokensUsed: totalOutputTokens },
            })
          }

          // Update session stats
          await db.tutorSession.update({
            where: { id: sessionId! },
            data: {
              messageCount: { increment: 2 },
              totalTokensUsed: { increment: totalInputTokens + totalOutputTokens },
            },
          })

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                sessionId,
                ragUsed: ragContext.length > 0,
                tokensUsed: { input: totalInputTokens, output: totalOutputTokens, total: totalInputTokens + totalOutputTokens },
              })}\n\n`
            )
          )
          controller.close()
        } catch (error) {
          controller.error(error)
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
  } catch (error) {
    console.error('[tutor/chat]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function extractProvider(model: string): string {
  if (model.startsWith('gemini')) return 'google'
  if (model.startsWith('claude')) return 'anthropic'
  return 'groq'
}

function getSystemPrompt(mode: string): string {
  const prompts: Record<string, string> = {
    general: `You are CogniBloom, a friendly and encouraging AI tutor for K-12 students. Answer questions clearly with examples. Adapt to the student's level.`,
    math: `You are an expert math tutor. Break problems into clear steps. Encourage the student to try before showing the answer. Use LaTeX notation where helpful (wrap in $...$).`,
    coding: `You are an expert programming tutor. Provide clean, well-explained code examples. Teach best practices and help students debug effectively.`,
    language: `You are a language tutor. Correct mistakes gently with clear explanations. Provide context for grammar rules and vocabulary.`,
    science: `You are a science tutor. Connect concepts to real-world examples. Encourage curiosity and scientific thinking.`,
    homework_helper: `You are a homework guide. Never just give the answer — ask leading questions to help the student work it out themselves. Celebrate their progress.`,
    socratic_coach: `You are a Socratic coach. Guide students to insight through thoughtful questions. Help them discover answers rather than telling them.`,
    quiz: `You are a quiz master. Ask one clear question at a time, give feedback on answers, and explain the reasoning behind correct answers.`,
  }
  return prompts[mode] ?? prompts['general']
}
