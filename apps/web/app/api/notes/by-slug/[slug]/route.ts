import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'

type RouteParams = { params: Promise<{ slug: string }> }

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

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const userId = DANIEL_USER_ID

    const note = await db.note.findFirst({
      where: { slug, userId },
      select: NOTE_SELECT,
    })

    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: note })
  } catch (err) {
    console.error('[GET /api/notes/by-slug]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
