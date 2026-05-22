import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { z } from 'zod'

const updateSessionSchema = z.object({
  studentRating: z.number().min(1).max(5).optional(),
  feedback: z.string().optional(),
  topic: z.string().optional(),
})

type RouteParams = { params: Promise<{ sessionId: string }> }

// GET /api/tutor/sessions/[sessionId]
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params
    const userId = DANIEL_USER_ID

    const { searchParams } = new URL(request.url)
    const includeMessages = searchParams.get('messages') === 'true'

    const session = await db.tutorSession.findFirst({
      where: { id: sessionId, userId },
      include: { messages: includeMessages ? { orderBy: { createdAt: 'asc' } } : false },
    })

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: session })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/tutor/sessions/[sessionId]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params
    const userId = DANIEL_USER_ID

    const body = await request.json()
    const validated = updateSessionSchema.parse(body)

    const session = await db.tutorSession.findFirst({ where: { id: sessionId, userId } })
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const updated = await db.tutorSession.update({
      where: { id: sessionId },
      data: {
        ...(validated.studentRating && { studentRating: validated.studentRating }),
        ...(validated.feedback && { feedback: validated.feedback }),
        ...(validated.topic && { topic: validated.topic }),
        endedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/tutor/sessions/[sessionId]
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params
    const userId = DANIEL_USER_ID

    const session = await db.tutorSession.findFirst({ where: { id: sessionId, userId } })
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    await db.tutorSession.delete({ where: { id: sessionId } })
    return NextResponse.json({ success: true, message: 'Session deleted' })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
