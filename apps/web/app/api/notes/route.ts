import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generateEmbedding, embeddingToSql } from '@/lib/ai/embeddings'

const createNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
  subject: z.string().optional(),
})

// Fire-and-forget: generate and store embedding after note is created
async function embedNote(noteId: string, title: string, content: string) {
  try {
    const text = `${title}\n\n${content}`
    const embedding = await generateEmbedding(text)
    const vectorStr = embeddingToSql(embedding)
    await db.$executeRaw`
      UPDATE "Note" SET embedding = ${vectorStr}::vector WHERE id = ${noteId}
    `
  } catch {
    // Non-fatal — note is still usable without embedding
  }
}

// GET /api/notes
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const subject = searchParams.get('subject')
    const tag = searchParams.get('tag')
    const bookmarkedOnly = searchParams.get('bookmarked') === 'true'

    const where: Record<string, unknown> = { userId }
    if (subject) where['subject'] = subject
    if (tag) where['tags'] = { has: tag }
    if (bookmarkedOnly) where['isBookmarked'] = true

    const [notes, total] = await Promise.all([
      db.note.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          content: true,
          tags: true,
          subject: true,
          isBookmarked: true,
          hasMath: true,
          hasCode: true,
          hasImages: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.note.count({ where }),
    ])

    return NextResponse.json({ success: true, data: notes, meta: { total, limit, offset } })
  } catch (error) {
    console.error('[notes GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/notes
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const validated = createNoteSchema.parse(body)

    const hasMath = /\$.*\$|\\[.*\\]|\\\(.*\\\)/.test(validated.content)
    const hasCode = /```|`/.test(validated.content)
    const hasImages = /!\[.*\]\(.*\)|<img/.test(validated.content)

    const note = await db.note.create({
      data: {
        userId,
        title: validated.title,
        content: validated.content,
        tags: validated.tags || [],
        subject: validated.subject,
        hasMath,
        hasCode,
        hasImages,
      },
    })

    // Generate embedding asynchronously — don't block the response
    embedNote(note.id, note.title, note.content)

    return NextResponse.json({ success: true, data: note }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('[notes POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
