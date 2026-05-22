import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { generateEmbedding, embeddingToSql } from '@/lib/ai/embeddings'

interface NoteResult {
  id: string
  title: string
  content: string
  subject: string | null
  tags: string[]
  isBookmarked: boolean
  hasMath: boolean
  hasCode: boolean
  hasImages: boolean
  createdAt: Date
  updatedAt: Date
  similarity?: number
}

// GET /api/notes/search?q=...&semantic=true
export async function GET(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') ?? ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const offset = parseInt(searchParams.get('offset') || '0')
    const semantic = searchParams.get('semantic') !== 'false' // default true

    if (query.length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
    }

    let notes: NoteResult[] = []
    let searchType = 'keyword'

    // Try vector search first if semantic mode is on
    if (semantic) {
      try {
        const embedding = await generateEmbedding(query)
        const vectorStr = embeddingToSql(embedding)

        const vectorResults = await db.$queryRaw<NoteResult[]>`
          SELECT
            id, title, content, subject, tags,
            "isBookmarked", "hasMath", "hasCode", "hasImages",
            "createdAt", "updatedAt",
            1 - (embedding <=> ${vectorStr}::vector) AS similarity
          FROM "Note"
          WHERE "userId" = ${userId}
            AND embedding IS NOT NULL
            AND 1 - (embedding <=> ${vectorStr}::vector) > 0.55
          ORDER BY embedding <=> ${vectorStr}::vector
          LIMIT ${limit}
          OFFSET ${offset}
        `

        if (vectorResults.length > 0) {
          notes = vectorResults
          searchType = 'semantic'
        }
      } catch {
        // Fall through to keyword search
      }
    }

    // Keyword fallback (or supplement when semantic has no results)
    if (notes.length === 0) {
      const keywordResults = await db.note.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
            { tags: { hasSome: [query] } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true, title: true, content: true, tags: true, subject: true,
          isBookmarked: true, hasMath: true, hasCode: true, hasImages: true,
          createdAt: true, updatedAt: true,
        },
      })
      notes = keywordResults
    }

    const total = notes.length

    return NextResponse.json({
      success: true,
      data: notes,
      meta: { query, total, limit, offset, searchType },
    })
  } catch (error) {
    console.error('[notes/search GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
