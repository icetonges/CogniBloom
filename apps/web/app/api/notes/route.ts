import { NextRequest, NextResponse, after } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { z } from 'zod'
import { embedNote, generateUniqueNoteSlug } from '@/lib/notes'
import { awardXP, updateStreak, XP } from '@/lib/gamification'

const createNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  contentFormat: z.enum(['html', 'markdown']).default('html'),
  tags: z.array(z.string()).optional(),
  subject: z.string().max(100).nullable().optional(),
  hasMath: z.boolean().optional(),
  hasCode: z.boolean().optional(),
  hasImages: z.boolean().optional(),
})

const NOTE_SELECT = {
  id: true,
  slug: true,
  subjectIndex: true,
  title: true,
  content: true,
  contentFormat: true,
  tags: true,
  subject: true,
  isBookmarked: true,
  hasMath: true,
  hasCode: true,
  hasImages: true,
  mindMap: true,
  reasoningHints: true,
  knowledgePoints: true,
  tutorSummary: true,
  aiAnalyzedAt: true,
  publishedSlug: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const

// GET /api/notes
export async function GET(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const { searchParams } = new URL(request.url)

    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1)
    const offset = (page - 1) * limit

    const subject = searchParams.get('subject')
    const month = searchParams.get('month')   // YYYY-MM
    const date = searchParams.get('date')     // YYYY-MM-DD
    const tag = searchParams.get('tag')
    const bookmarkedOnly = searchParams.get('bookmarked') === 'true'
    const q = searchParams.get('q')           // keyword search

    // Build Prisma where clause
    const where: Record<string, unknown> = { userId }

    if (subject) {
      where['subject'] = { equals: subject, mode: 'insensitive' }
    }
    if (month) {
      const [y, m] = month.split('-').map(Number)
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m, 1)
      where['createdAt'] = { gte: start, lt: end }
    }
    if (date) {
      const d = new Date(date)
      const next = new Date(date)
      next.setDate(next.getDate() + 1)
      where['createdAt'] = { gte: d, lt: next }
    }
    if (tag) {
      where['tags'] = { has: tag }
    }
    if (bookmarkedOnly) {
      where['isBookmarked'] = true
    }
    if (q) {
      where['OR'] = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [notes, total] = await Promise.all([
      db.note.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: NOTE_SELECT,
      }),
      db.note.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: notes,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    })
  } catch (err) {
    console.error('[GET /api/notes]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/notes
export async function POST(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const body = await request.json()
    const validated = createNoteSchema.parse(body)

    const now = new Date()
    const hasMath = validated.hasMath ?? /\$.*?\$|\\[.*?\\]|\\\(.*?\\\)/.test(validated.content)
    const hasCode = validated.hasCode ?? (/<code|<pre|```/.test(validated.content))
    const hasImages = validated.hasImages ?? /<img/.test(validated.content)

    const { slug, subjectIndex } = await generateUniqueNoteSlug(
      userId,
      validated.subject ?? null,
      now,
    )

    const note = await db.note.create({
      data: {
        userId,
        title: validated.title,
        content: validated.content,
        contentFormat: validated.contentFormat ?? 'html',
        tags: validated.tags || [],
        subject: validated.subject?.trim() || null,
        hasMath,
        hasCode,
        hasImages,
        slug,
        subjectIndex,
      },
      select: NOTE_SELECT,
    })

    after(async () => {
      await embedNote(note.id, note.title, note.content)
      const streak = await updateStreak(userId)
      const bonus = Math.max(streak - 1, 0) * XP.STREAK_BONUS
      await awardXP(userId, XP.NOTE_CREATED + bonus)
    })

    return NextResponse.json({ success: true, data: note }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 },
      )
    }
    console.error('[POST /api/notes]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
