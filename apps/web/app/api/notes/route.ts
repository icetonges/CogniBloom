import { NextRequest, NextResponse, after } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { z } from 'zod'
import { embedNote } from '@/lib/notes'
import { awardXP, updateStreak, XP } from '@/lib/gamification'

const createNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  contentFormat: z.enum(['html', 'markdown']).default('html'),
  tags: z.array(z.string()).optional(),
  subject: z.string().max(100).optional(),
  hasMath: z.boolean().optional(),
  hasCode: z.boolean().optional(),
  hasImages: z.boolean().optional(),
})

// GET /api/notes
export async function GET(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID

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
        },
      }),
      db.note.count({ where }),
    ])

    return NextResponse.json({ success: true, data: notes, meta: { total, limit, offset } })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/notes
export async function POST(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID

    const body = await request.json()
    const validated = createNoteSchema.parse(body)

    // Detect content features — prefer client-supplied values (more accurate for HTML)
    const hasMath = validated.hasMath ?? /\$.*?\$|\\[.*?\\]|\\\(.*?\\\)/.test(validated.content)
    const hasCode = validated.hasCode ?? (/<code|<pre|```/.test(validated.content))
    const hasImages = validated.hasImages ?? /<img/.test(validated.content)

    const note = await db.note.create({
      data: {
        userId,
        title: validated.title,
        content: validated.content,
        contentFormat: validated.contentFormat ?? 'html',
        tags: validated.tags || [],
        subject: validated.subject,
        hasMath,
        hasCode,
        hasImages,
      },
    })

    // After the response: embed the note and award XP (non-blocking)
    after(async () => {
      await embedNote(note.id, note.title, note.content)
      const streak = await updateStreak(userId)
      const bonus = Math.max(streak - 1, 0) * XP.STREAK_BONUS
      await awardXP(userId, XP.NOTE_CREATED + bonus)
    })

    return NextResponse.json({ success: true, data: note }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
