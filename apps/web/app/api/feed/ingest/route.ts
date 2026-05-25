/**
 * POST /api/feed/ingest
 *
 * Triggers the daily feed ingestion pipeline.
 * Protected by CRON_SECRET (passed as Authorization: Bearer <secret>).
 *
 * Query params:
 *   ?category=coding   — ingest a single category only
 *   ?cleanup=true      — also delete expired items
 *
 * Designed to be called from:
 *   - GitHub Actions cron (daily)
 *   - Admin dashboard manual trigger
 */

import { NextRequest, NextResponse } from 'next/server'
import { ingestAll, ingestCategory, cleanupExpired } from '@/lib/feed/ingest'
import { ALL_CATEGORIES, type Category } from '@/lib/feed/sources'

export const maxDuration = 300 // 5 min — parallel ingestion across 14 categories

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env['CRON_SECRET']
  if (!secret) return true // dev: no secret required

  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${secret}`) return true

  // Also allow ?secret=... for GitHub Actions webhook
  const urlSecret = new URL(request.url).searchParams.get('secret')
  if (urlSecret === secret) return true

  return false
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const categoryParam = searchParams.get('category')
  const doCleanup = searchParams.get('cleanup') === 'true'

  try {
    const t0 = Date.now()

    // Ingest one category or all
    let results
    if (categoryParam) {
      if (!(ALL_CATEGORIES as readonly string[]).includes(categoryParam)) {
        return NextResponse.json(
          { error: `Unknown category: ${categoryParam}` },
          { status: 400 }
        )
      }
      const result = await ingestCategory(categoryParam as Category)
      results = [result]
    } else {
      results = await ingestAll()
    }

    // Optional expired-item cleanup
    let cleanedUp = 0
    if (doCleanup) {
      cleanedUp = await cleanupExpired()
    }

    const totalNew = results.reduce((sum, r) => sum + r.totalNew, 0)
    const totalDuration = Date.now() - t0

    return NextResponse.json({
      success: true,
      summary: {
        categoriesProcessed: results.length,
        totalNewItems: totalNew,
        cleanedUpExpired: cleanedUp,
        durationMs: totalDuration,
      },
      results: results.map((r) => ({
        category: r.category,
        totalNew: r.totalNew,
        durationMs: r.durationMs,
        sources: r.sources.map((s) => ({
          sourceId: s.sourceId,
          sourceName: s.sourceName,
          status: s.status,
          count: s.count,
          ...(s.error ? { error: s.error.slice(0, 200) } : {}),
        })),
      })),
    })
  } catch (err) {
    console.error('[feed/ingest] Fatal error:', err)
    return NextResponse.json(
      { error: 'Ingest failed', detail: String(err) },
      { status: 500 }
    )
  }
}

// Allow GET for easy browser testing in dev
export async function GET(request: NextRequest) {
  if (process.env['NODE_ENV'] !== 'development') {
    return NextResponse.json({ error: 'Use POST' }, { status: 405 })
  }
  return POST(request)
}
