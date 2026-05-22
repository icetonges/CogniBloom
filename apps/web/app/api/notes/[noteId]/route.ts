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

type RouteParams = { params: Promise<{ noteId: string }> }

// GET /api/notes/[noteId]
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { noteId } = await params
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const note = await db.note.findFirst({
      where: { id: noteId, userId },
      include: { reviews: true },
    })

    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: note })
  } catch (error) {
    console.error('[notes/[noteId] GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/notes/[noteId]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { noteId } = await params
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const validated = updateNoteSchema.parse(body)

    const note = await db.note.findFirst({ where: { id: noteId, userId } })
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    const updateData: Record<string, unknown> = { ...validated }
    if (validated.content) {
      updateData['hasMath'] = /\$.*\$|\\[.*\\]|\\\(.*\\\)/.test(validated.content)
      updateData['hasCode'] = /```|`/.test(validated.content)
      updateData['hasImages'] = /!\[.*\]\(.*\)|<img/.test(validated.content)
    }

    const updated = await db.note.update({ where: { id: noteId }, data: updateData })
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('[notes/[noteId] PUT]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/notes/[noteId]
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { noteId } = await params
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const note = await db.note.findFirst({ where: { id: noteId, userId } })
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    await db.note.delete({ where: { id: noteId } })
    return NextResponse.json({ success: true, message: 'Note deleted' })
  } catch (error) {
    console.error('[notes/[noteId] DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
