import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { z } from 'zod'

// Validation schemas
const createSessionSchema = z.object({
  mode: z.enum(['GENERAL', 'MATH', 'CODING', 'LANGUAGE', 'SCIENCE', 'HOMEWORK_HELPER', 'SOCRATIC_COACH', 'QUIZ']),
  topic: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'adaptive']).optional(),
})

interface CreateSessionRequest {
  mode: string
  topic?: string
  difficulty?: string
}

// GET /api/tutor/sessions - List user's sessions
export async function GET(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const includeMessages = searchParams.get('messages') === 'true'

    const sessions = await db.tutorSession.findMany({
      where: { userId },
      include: {
        messages: includeMessages
          ? { orderBy: { createdAt: 'asc' } }
          : false,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    const total = await db.tutorSession.count({
      where: { userId },
    })

    return NextResponse.json({
      success: true,
      data: sessions,
      meta: {
        total,
        limit,
        offset,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/tutor/sessions - Create new session
export async function POST(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID

    const body: CreateSessionRequest = await request.json()

    // Validate request
    const validated = createSessionSchema.parse(body)

    // Create session
    const session = await db.tutorSession.create({
      data: {
        userId,
        mode: validated.mode as any,
        topic: validated.topic,
        difficulty: validated.difficulty || 'adaptive',
        aiProvider: 'anthropic',
        aiModel: 'claude-sonnet-4-20250514',
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: session,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
