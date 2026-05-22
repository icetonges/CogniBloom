import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

// Validation schemas
const createNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
  subject: z.string().optional(),
})

const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  subject: z.string().optional(),
  isBookmarked: z.boolean().optional(),
})

interface CreateNoteRequest {
  title: string
  content: string
  tags?: string[]
  subject?: string
}

interface UpdateNoteRequest {
  title?: string
  content?: string
  tags?: string[]
  subject?: string
  isBookmarked?: boolean
}

// GET /api/notes - List user's notes
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const subject = searchParams.get('subject')
    const tag = searchParams.get('tag')
    const bookmarkedOnly = searchParams.get('bookmarked') === 'true'

    // Build where clause
    const where: any = { userId }
    if (subject) where.subject = subject
    if (tag) where.tags = { has: tag }
    if (bookmarkedOnly) where.isBookmarked = true

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
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
      prisma.note.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: notes,
      meta: {
        total,
        limit,
        offset,
      },
    })
  } catch (error) {
    console.error('[notes GET] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/notes - Create new note
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreateNoteRequest = await request.json()

    // Validate request
    const validated = createNoteSchema.parse(body)

    // Detect content features
    const hasMath = /\$.*\$|\\[.*\\]|\\\(.*\\\)/.test(validated.content)
    const hasCode = /```|`/.test(validated.content)
    const hasImages = /!\[.*\]\(.*\)|<img/.test(validated.content)

    // Create note
    const note = await prisma.note.create({
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

    return NextResponse.json(
      {
        success: true,
        data: note,
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

    console.error('[notes POST] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
