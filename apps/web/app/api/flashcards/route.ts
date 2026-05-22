import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { getAIManager } from '@/lib/ai'

// GET /api/flashcards?due=true — list cards (optionally only those due for review)
export async function GET(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const { searchParams } = new URL(request.url)
    const dueOnly = searchParams.get('due') === 'true'
    const noteId = searchParams.get('noteId')

    const where: Record<string, unknown> = { userId }
    if (dueOnly) where['nextReviewAt'] = { lte: new Date() }
    if (noteId) where['noteId'] = noteId

    const cards = await db.flashcard.findMany({
      where,
      orderBy: dueOnly ? { nextReviewAt: 'asc' } : { createdAt: 'desc' },
      select: {
        id: true,
        front: true,
        back: true,
        subject: true,
        tags: true,
        easeFactor: true,
        interval: true,
        repetitions: true,
        nextReviewAt: true,
        totalReviews: true,
        correctReviews: true,
        noteId: true,
        createdAt: true,
      },
    })

    const dueCount = await db.flashcard.count({
      where: { userId, nextReviewAt: { lte: new Date() } },
    })

    return NextResponse.json({ success: true, data: cards, dueCount })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/flashcards — generate cards from a note OR create a single card
export async function POST(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const body = await request.json() as {
      noteId?: string
      front?: string
      back?: string
      subject?: string
      tags?: string[]
      count?: number
    }

    // Manual card creation
    if (body.front && body.back) {
      const card = await db.flashcard.create({
        data: {
          userId,
          noteId: body.noteId ?? null,
          front: body.front,
          back: body.back,
          subject: body.subject ?? null,
          tags: body.tags ?? [],
        },
      })
      return NextResponse.json({ success: true, data: [card] })
    }

    // AI generation from note
    if (!body.noteId) {
      return NextResponse.json({ error: 'noteId or front+back required' }, { status: 400 })
    }

    const note = await db.note.findFirst({ where: { id: body.noteId, userId } })
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    const count = Math.min(body.count ?? 8, 20)
    const aiManager = getAIManager()

    const prompt = `You are a flashcard generator for a K-12 student. Given the following study note, generate exactly ${count} high-quality flashcards.

Note Title: ${note.title}
Subject: ${note.subject ?? 'General'}
Content:
${note.content.slice(0, 3000)}

Return ONLY a JSON array (no markdown, no explanation) with exactly ${count} objects. Each object must have:
- "front": clear, concise question or term (max 150 chars)
- "back": accurate, complete answer or definition (max 300 chars)

Focus on key concepts, definitions, formulas, dates, and important facts. Make the front and back complementary — not copies of each other.`

    const response = await aiManager.chat('gemini-2.5-flash', {
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      maxTokens: 2048,
    })

    let cards: { front: string; back: string }[] = []
    try {
      const raw = response.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      cards = JSON.parse(raw)
      if (!Array.isArray(cards)) throw new Error('Not an array')
      cards = cards.filter((c) => c.front && c.back).slice(0, count)
    } catch {
      return NextResponse.json({ error: 'AI returned invalid flashcard format' }, { status: 422 })
    }

    const created = await db.$transaction(
      cards.map((c) =>
        db.flashcard.create({
          data: {
            userId,
            noteId: body.noteId!,
            front: String(c.front).slice(0, 500),
            back: String(c.back).slice(0, 1000),
            subject: note.subject ?? null,
            tags: note.tags,
          },
        })
      )
    )

    return NextResponse.json({ success: true, data: created, generated: created.length })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/flashcards?id=xxx — delete a card
export async function DELETE(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await db.flashcard.deleteMany({ where: { id, userId } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
