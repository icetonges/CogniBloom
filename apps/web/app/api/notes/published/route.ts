import { NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/notes/published — list all published notes for the archive page
export async function GET() {
  try {
    const userId = DANIEL_USER_ID

    const notes = await db.note.findMany({
      where: { userId, publishedSlug: { not: null } },
      select: {
        id: true,
        title: true,
        subject: true,
        publishedSlug: true,
        publishedAt: true,
        createdAt: true,
        tutorSummary: true,
        tags: true,
      },
      orderBy: { publishedAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: notes })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
