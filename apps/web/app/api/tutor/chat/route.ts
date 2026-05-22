import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { getAIManager } from '@/lib/ai'
import type { ChatMessage } from '@/lib/ai/providers/types'

// Request body schema
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
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request
    const body: ChatRequestBody = await request.json()

    if (!body.messages || body.messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages are required' },
        { status: 400 }
      )
    }

    const model = body.model || 'claude-sonnet-4.6'
    const temperature = body.temperature ?? 0.7
    const maxTokens = body.maxTokens ?? 2048

    // Get or create session
    let sessionId = body.sessionId
    if (!sessionId) {
      const session = await prisma.tutorSession.create({
        data: {
          userId,
          mode: (body.mode as any) || 'GENERAL',
          aiProvider: extractProviderFromModel(model),
          aiModel: model,
        },
      })
      sessionId = session.id
    }

    // Validate session ownership
    const session = await prisma.tutorSession.findFirst({
      where: { id: sessionId, userId },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Get AI manager
    const aiManager = getAIManager()

    // Prepare system message if not present
    const messages = body.messages
    if (!messages[0] || messages[0].role !== 'system') {
      const systemPrompt = getSystemPrompt(body.mode || 'general')
      messages.unshift({
        role: 'system',
        content: systemPrompt,
      })
    }

    // Stream response using encoder
    const encoder = new TextEncoder()
    let totalInputTokens = 0
    let totalOutputTokens = 0

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream from AI provider
          for await (const chunk of aiManager.stream(model, {
            messages,
            temperature,
            maxTokens,
          })) {
            // Track tokens
            if (chunk.tokensUsed) {
              totalInputTokens = chunk.tokensUsed.input
              totalOutputTokens = chunk.tokensUsed.output
            }

            // Send chunk as SSE
            if (chunk.content) {
              const data = {
                type: 'content',
                content: chunk.content,
                tokensUsed: chunk.tokensUsed,
              }
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
              )
            }
          }

          // Save messages to database
          const lastUserMessage = messages
            .slice()
            .reverse()
            .find((m) => m.role === 'user')

          if (lastUserMessage) {
            await prisma.tutorMessage.create({
              data: {
                sessionId,
                role: 'user',
                content: lastUserMessage.content,
                tokensUsed: 0,
              },
            })
          }

          // Extract assistant message from stream
          const assistantContent: string[] = []
          for await (const chunk of aiManager.stream(model, {
            messages,
            temperature,
            maxTokens,
          })) {
            if (chunk.content) {
              assistantContent.push(chunk.content)
            }
          }

          const fullContent = assistantContent.join('')

          if (fullContent) {
            await prisma.tutorMessage.create({
              data: {
                sessionId,
                role: 'assistant',
                content: fullContent,
                tokensUsed: totalOutputTokens,
              },
            })
          }

          // Update session stats
          await prisma.tutorSession.update({
            where: { id: sessionId },
            data: {
              messageCount: { increment: 2 },
              totalTokensUsed: { increment: totalInputTokens + totalOutputTokens },
            },
          })

          // Send completion
          const done = {
            type: 'done',
            sessionId,
            tokensUsed: {
              input: totalInputTokens,
              output: totalOutputTokens,
              total: totalInputTokens + totalOutputTokens,
            },
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(done)}\n\n`))

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
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[tutor/chat] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function extractProviderFromModel(model: string): string {
  if (model.startsWith('gemini')) return 'google'
  if (model.startsWith('claude')) return 'anthropic'
  return 'groq'
}

function getSystemPrompt(mode: string): string {
  const prompts: Record<string, string> = {
    general: `You are a helpful AI tutor. Answer questions clearly and provide examples when helpful.
Adapt your responses to the student's learning level.`,
    math: `You are an expert math tutor. Help students understand mathematical concepts step-by-step.
Break down problems into manageable parts. Encourage problem-solving rather than just providing answers.`,
    coding: `You are an expert programming tutor. Help students learn to code effectively.
Provide clean code examples and explain concepts clearly. Encourage best practices and clean code principles.`,
    language: `You are a language learning tutor. Help students improve their language skills.
Correct mistakes gently and provide context for grammar and vocabulary.`,
    science: `You are a science tutor. Help students understand scientific concepts and principles.
Use examples from real-world applications to illustrate concepts.`,
    homework_helper: `You are a homework helper. Guide students through assignments without simply providing answers.
Help them understand the concepts and develop problem-solving skills.`,
    socratic_coach: `You are a Socratic method coach. Guide students to answers through thoughtful questioning.
Help them develop critical thinking skills.`,
    quiz: `You are a quiz master. Ask clear questions and provide feedback on student answers.
Explain correct answers and help students understand why.`,
  }

  return prompts[mode] || prompts.general
}
