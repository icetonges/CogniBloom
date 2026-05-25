/**
 * GET /api/feed/sources
 *
 * Returns all FeedSource rows grouped by category, with last pull status,
 * item counts, and error details. Used by the source status dashboard.
 *
 * Response:
 *   { success: true, data: { [category]: SourceRow[] }, summary: { ... } }
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ALL_CATEGORIES } from '@/lib/feed/sources'

export async function GET() {
  const sources = await db.feedSource.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { items: true } },
    },
  })

  // Group by category
  const grouped: Record<string, typeof sources> = {}
  for (const cat of ALL_CATEGORIES) {
    grouped[cat] = []
  }
  for (const src of sources) {
    if (!grouped[src.category]) grouped[src.category] = []
    grouped[src.category]!.push(src)
  }

  // Overall summary
  const totalSources = sources.length
  const activeSources = sources.filter((s) => s.isActive).length
  const errorSources = sources.filter((s) => s.lastStatus === 'error').length
  const totalItemsToday = sources.reduce((sum, s) => sum + s.itemsToday, 0)
  const totalItemsEver = sources.reduce((sum, s) => sum + s.itemsTotal, 0)
  const lastPulledAt = sources
    .map((s) => s.lastPulledAt)
    .filter(Boolean)
    .sort((a, b) => b!.getTime() - a!.getTime())[0]

  return NextResponse.json({
    success: true,
    summary: {
      totalSources,
      activeSources,
      errorSources,
      totalItemsToday,
      totalItemsEver,
      lastPulledAt: lastPulledAt?.toISOString() ?? null,
    },
    data: Object.fromEntries(
      Object.entries(grouped).map(([cat, srcs]) => [
        cat,
        srcs.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          url: s.url,
          type: s.type,
          isActive: s.isActive,
          lastPulledAt: s.lastPulledAt?.toISOString() ?? null,
          lastStatus: s.lastStatus,
          lastError: s.lastError,
          itemsToday: s.itemsToday,
          itemsTotal: s.itemsTotal,
          totalItemsInDb: s._count.items,
        })),
      ])
    ),
  })
}
