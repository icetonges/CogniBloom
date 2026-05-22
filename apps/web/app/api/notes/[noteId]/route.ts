import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  subject: z.string().optional(),
  isBookmarked: z.boolean().optional(),
})

interface UpdateNoteRequest {
  title?: string
  content?: string
  tags?: string[]
  subject?: string
  isBookmarked?: boolean
}

// GET /api/notes/[noteId] - Get note details
export async function GET(
  request: NextRequest,
  { params }: { params: { noteId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const note = await db.note.findFirst({
      where: {
        id: params.noteId,
        userId,
      },
      include: {
        reviews: true,
      },
    })

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: note,
    })
  } catch (error) {
    console.error('[notes/[noteId] GET] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/notes/[noteId] - Update note
export async function PUT(
  request: NextRequest,
  { params }: { params: { noteId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: UpdateNoteRequest = await request.json()

    // Validate request
    const validated = updateNoteSchema.parse(body)

    // Verify ownership
    const note = await db.note.findFirst({
      where: {
        id: params.noteId,
        userId,
      },
    })

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Detect content features if content is being updated
    const updateData: any = validated
    if (validated.content) {
      updateData.hasMath = /\$.*\$|\\[.*\\]|\\\(.*\\\)/.test(validated.content)
      updateData.hasCode = /```|`/.test(validated.content)
      updateData.hasImages = /!\[.*\]\(.*\)|<img/.test(validated.content)
    }

    // Update note
    const updated = await db.note.update({
      where: { id: params.noteId },
      data: updateData,
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

    console.error('[notes/[noteId] PUT] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/notes/[noteId] - Delete note
export async function DELETE(
  request: NextRequest,
  { params }: { params: { noteId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const note = await db.note.findFirst({
      where: {
        id: params.noteId,
        userId,
      },
    })

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Delete note (cascade deletes reviews)
    await db.note.delete({
      where: { id: params.noteId },
    })

    return NextResponse.json({
      success: true,
      message: 'Note deleted',
    })
  } catch (error) {
    console.error('[notes/[noteId] DELETE] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
