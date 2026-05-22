import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const updateSessionSchema = z.object({
  studentRating: z.number().min(1).max(5).optional(),
  feedback: z.string().optional(),
  topic: z.string().optional(),
})

interface UpdateSessionRequest {
  studentRating?: number
  feedback?: string
  topic?: string
}

// GET /api/tutor/sessions/[sessionId] - Get session details
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeMessages = searchParams.get('messages') === 'true'

    const session = await db.tutorSession.findFirst({
      where: {
        id: params.sessionId,
        userId,
      },
      include: {
        messages: includeMessages
          ? { orderBy: { createdAt: 'asc' } }
          : false,
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: session,
    })
  } catch (error) {
    console.error('[tutor/sessions/[sessionId] GET] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/tutor/sessions/[sessionId] - Update session
export async function PUT(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: UpdateSessionRequest = await request.json()

    // Validate request
    const validated = updateSessionSchema.parse(body)

    // Verify ownership
    const session = await db.tutorSession.findFirst({
      where: {
        id: params.sessionId,
        userId,
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Update session
    const updated = await db.tutorSession.update({
      where: { id: params.sessionId },
      data: {
        ...(validated.studentRating && { studentRating: validated.studentRating }),
        ...(validated.feedback && { feedback: validated.feedback }),
        ...(validated.topic && { topic: validated.topic }),
        endedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      data: updated,
    })
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

    console.error('[tutor/sessions/[sessionId] PUT] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/tutor/sessions/[sessionId] - Delete session
export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const session = await db.tutorSession.findFirst({
      where: {
        id: params.sessionId,
        userId,
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Delete session (cascade deletes messages)
    await db.tutorSession.delete({
      where: { id: params.sessionId },
    })

    return NextResponse.json({
      success: true,
      message: 'Session deleted',
    })
  } catch (error) {
    console.error('[tutor/sessions/[sessionId] DELETE] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
