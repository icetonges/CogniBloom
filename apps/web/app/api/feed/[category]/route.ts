/**
 * GET /api/feed/[category]
 *
 * Returns paginated CategoryFeedItems for a given category.
 *
 * Query params:
 *   ?page=N        — 1-indexed page (default 1)
 *   ?pageSize=N    — items per page (default 10, max 50)
 *   ?date=YYYY-MM-DD — fetch a specific date's items (default: today)
 *
 * Response:
 *   { success: true, data: CategoryFeedItem[], meta: { page, pageSize, total, hasMore, date } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { easternMidnight } from '@/lib/timezone'
import { ALL_CATEGORIES, type Category } from '@/lib/feed/sources'

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  const { category } = await params

  // Validate category
  if (!(ALL_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json(
      { error: `Unknown category: ${category}` },
      { status: 404 }
    )
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10))
  )
  const dateParam = searchParams.get('date')

  // Determine date range
  let startOfDay: Date
  if (dateParam) {
    // Parse "YYYY-MM-DD" as Eastern midnight
    const [y, m, d] = dateParam.split('-').map(Number)
    if (!y || !m || !d) {
      return NextResponse.json({ error: 'Invalid date format, use YYYY-MM-DD' }, { status: 400 })
    }
    // Use a Date constructed in UTC from the parts; easternMidnight will handle timezone
    startOfDay = easternMidnight(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)))
  } else {
    startOfDay = easternMidnight()
  }
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

  const skip = (page - 1) * pageSize

  const [items, total] = await Promise.all([
    db.categoryFeedItem.findMany({
      where: {
        category: category as Category,
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: pageSize,
    }),
    db.categoryFeedItem.count({
      where: {
        category: category as Category,
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
    }),
  ])

  // If no items for today, fall back to most recent available items
  let data = items
  let isFallback = false
  if (items.length === 0 && page === 1) {
    const recent = await db.categoryFeedItem.findMany({
      where: { category: category as Category },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
    })
    data = recent
    isFallback = true
  }

  return NextResponse.json({
    success: true,
    data: data.map(mapItem),
    meta: {
      page,
      pageSize,
      total: isFallback ? data.length : total,
      hasMore: isFallback ? false : skip + items.length < total,
      date: startOfDay.toISOString(),
      isFallback,
    },
  })
}

function mapItem(item: {
  id: string
  category: string
  sourceName: string | null
  title: string
  summary: string
  body: string | null
  url: string | null
  imageUrl: string | null
  emoji: string
  tags: string[]
  difficulty: string
  estimatedMinutes: number
  contentType: string
  author: string | null
  publishedAt: Date | null
  isAiGenerated: boolean
  createdAt: Date
}) {
  return {
    id: item.id,
    category: item.category,
    sourceName: item.sourceName,
    title: item.title,
    summary: item.summary,
    body: item.body,
    url: item.url,
    imageUrl: item.imageUrl,
    emoji: item.emoji,
    tags: item.tags,
    difficulty: item.difficulty,
    estimatedMinutes: item.estimatedMinutes,
    contentType: item.contentType,
    author: item.author,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    isAiGenerated: item.isAiGenerated,
    createdAt: item.createdAt.toISOString(),
  }
}
