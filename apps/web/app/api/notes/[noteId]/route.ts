import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateEmbedding, embeddingToSql } from '@/lib/ai/embeddings'

async function reEmbedNote(noteId: string, title: string, content: string) {
  try {
    const embedding = await generateEmbedding(`${title}\n\n${content}`)
    const vectorStr = embeddingToSql(embedding)
    await db.$executeRaw`UPDATE "Note" SET embedding = ${vectorStr}::vector WHERE id = ${noteId}`
  } catch {
    // Non-fatal
  }
}

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
    const userId = DANIEL_USER_ID

    const note = await db.note.findFirst({
      where: { id: noteId, userId },
      include: { reviews: true },
    })

    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: note })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/notes/[noteId]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { noteId } = await params
    const userId = DANIEL_USER_ID

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

    // Re-embed if title or content changed
    if (validated.title || validated.content) {
      reEmbedNote(noteId, updated.title, updated.content)
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/notes/[noteId]
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { noteId } = await params
    const userId = DANIEL_USER_ID

    const note = await db.note.findFirst({ where: { id: noteId, userId } })
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    await db.note.delete({ where: { id: noteId } })
    return NextResponse.json({ success: true, message: 'Note deleted' })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
