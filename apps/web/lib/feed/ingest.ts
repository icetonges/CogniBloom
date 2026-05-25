/**
 * Category feed ingestion engine.
 *
 * Pulls content from every source registered for a category, normalises it,
 * deduplicates against today's existing items, and persists to the DB.
 * AI generation is used as a fallback when real sources return nothing.
 *
 * Designed to be called from:
 *   - POST /api/feed/ingest  (GitHub Actions cron or manual admin trigger)
 */

import { db } from '@/lib/db'
import {
  type Category,
  type SourceDef,
  type RawItem,
  FEED_SOURCES,
  ALL_CATEGORIES,
  getSourcesForCategory,
} from './sources'

const ITEMS_PER_CATEGORY = 8   // target items to have for each category per day
const ITEM_TTL_DAYS = 30       // keep items for 30 days

// ─── Result types ─────────────────────────────────────────────────────────────

export interface SourceResult {
  sourceId: string
  sourceName: string
  category: Category
  status: 'success' | 'error' | 'skipped'
  count: number
  error?: string
}

export interface IngestResult {
  category: Category
  sources: SourceResult[]
  totalNew: number
  durationMs: number
}

// ─── Core ingest for one source ───────────────────────────────────────────────

async function ingestSource(
  source: SourceDef,
  _dbSourceId: string,
  existingTitles: Set<string>,
): Promise<{ items: RawItem[]; error?: string }> {
  try {
    const raw = await source.pull()
    // Deduplicate against what's already in DB today
    const fresh = raw.filter((r) => !existingTitles.has(r.title.toLowerCase()))
    return { items: fresh }
  } catch (err) {
    return { items: [], error: String(err) }
  }
}

// ─── Ensure FeedSource rows exist in DB ──────────────────────────────────────

async function ensureSourceRows(): Promise<Map<string, string>> {
  const sourceIdMap = new Map<string, string>() // sourceDefId → db row id

  for (const src of FEED_SOURCES) {
    const existing = await db.feedSource.findFirst({
      where: { id: { not: '' }, name: src.name, category: src.category },
      select: { id: true },
    })
    if (existing) {
      sourceIdMap.set(src.id, existing.id)
    } else {
      const created = await db.feedSource.create({
        data: {
          name: src.name,
          category: src.category,
          url: src.url,
          type: src.type,
          isActive: true,
        },
      })
      sourceIdMap.set(src.id, created.id)
    }
  }

  return sourceIdMap
}

// ─── Ingest one category ─────────────────────────────────────────────────────

export async function ingestCategory(category: Category): Promise<IngestResult> {
  const t0 = Date.now()
  const sourceResults: SourceResult[] = []
  let totalNew = 0

  // Expiry date for new items
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + ITEM_TTL_DAYS)

  // Ensure FeedSource rows
  const sourceIdMap = await ensureSourceRows()

  // Get titles already stored for today to avoid duplicates
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const existing = await db.categoryFeedItem.findMany({
    where: { category, createdAt: { gte: todayStart } },
    select: { title: true },
  })
  const existingTitles = new Set(existing.map((e) => e.title.toLowerCase()))
  const alreadyHave = existing.length

  // Skip if we already have enough for today
  if (alreadyHave >= ITEMS_PER_CATEGORY) {
    const sources = getSourcesForCategory(category)
    for (const src of sources) {
      sourceResults.push({
        sourceId: src.id,
        sourceName: src.name,
        category,
        status: 'skipped',
        count: 0,
      })
    }
    return { category, sources: sourceResults, totalNew: 0, durationMs: Date.now() - t0 }
  }

  const needed = ITEMS_PER_CATEGORY - alreadyHave
  const sources = getSourcesForCategory(category)

  // Pull from real sources first (non-AI), then AI if still short
  const realSources = sources.filter((s) => s.type !== 'ai')
  const aiSources = sources.filter((s) => s.type === 'ai')

  const allCollected: { item: RawItem; source: SourceDef; dbSourceId: string }[] = []

  for (const src of realSources) {
    const dbSourceId = sourceIdMap.get(src.id) ?? ''
    const { items, error } = await ingestSource(src, dbSourceId, existingTitles)

    if (error) {
      await db.feedSource.updateMany({
        where: { name: src.name, category: src.category },
        data: { lastStatus: 'error', lastError: error.slice(0, 1000), lastPulledAt: new Date() },
      })
      sourceResults.push({ sourceId: src.id, sourceName: src.name, category, status: 'error', count: 0, error })
    } else {
      sourceResults.push({ sourceId: src.id, sourceName: src.name, category, status: 'success', count: items.length })
      for (const item of items) {
        existingTitles.add(item.title.toLowerCase())
        allCollected.push({ item, source: src, dbSourceId })
      }
    }
  }

  // Use AI sources if we still need more items
  if (allCollected.length < needed) {
    for (const src of aiSources) {
      if (allCollected.length >= needed) break
      const dbSourceId = sourceIdMap.get(src.id) ?? ''
      const { items, error } = await ingestSource(src, dbSourceId, existingTitles)

      if (error) {
        sourceResults.push({ sourceId: src.id, sourceName: src.name, category, status: 'error', count: 0, error })
      } else {
        sourceResults.push({ sourceId: src.id, sourceName: src.name, category, status: 'success', count: items.length })
        for (const item of items) {
          existingTitles.add(item.title.toLowerCase())
          allCollected.push({ item, source: src, dbSourceId })
        }
      }
    }
  }

  // Persist to DB (up to `needed` items)
  const toSave = allCollected.slice(0, needed)
  for (const { item, source, dbSourceId } of toSave) {
    try {
      await db.categoryFeedItem.create({
        data: {
          category,
          sourceId: dbSourceId || null,
          sourceName: source.name,
          title: item.title,
          summary: item.summary,
          body: item.body ?? null,
          url: item.url ?? null,
          imageUrl: item.imageUrl ?? null,
          emoji: item.emoji ?? '📚',
          tags: item.tags ?? [category],
          difficulty: item.difficulty ?? 'medium',
          estimatedMinutes: item.estimatedMinutes ?? 3,
          contentType: item.contentType ?? 'article',
          author: item.author ?? null,
          publishedAt: item.publishedAt ?? null,
          isAiGenerated: item.isAiGenerated ?? false,
          expiresAt,
        },
      })
      totalNew++
    } catch {
      // Skip duplicate titles (race condition)
    }
  }

  // Update FeedSource counters and status
  for (const sr of sourceResults) {
    if (sr.status === 'success' || sr.status === 'skipped') {
      await db.feedSource.updateMany({
        where: { name: sr.sourceName, category: sr.category },
        data: {
          lastStatus: sr.status,
          lastPulledAt: new Date(),
          lastError: null,
          itemsToday: sr.count,
          itemsTotal: { increment: sr.count },
        },
      })
    }
  }

  return { category, sources: sourceResults, totalNew, durationMs: Date.now() - t0 }
}

// ─── Ingest all categories ────────────────────────────────────────────────────

export async function ingestAll(
  categories: Category[] = ALL_CATEGORIES as Category[],
): Promise<IngestResult[]> {
  // Run categories in parallel batches of 4 to avoid rate limits
  const BATCH = 4
  const results: IngestResult[] = []

  for (let i = 0; i < categories.length; i += BATCH) {
    const batch = categories.slice(i, i + BATCH)
    const batchResults = await Promise.allSettled(
      batch.map((cat) => ingestCategory(cat))
    )
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(r.value)
      else console.warn('[feed/ingest] batch error:', r.reason)
    }
  }

  return results
}

// ─── Cleanup expired items ────────────────────────────────────────────────────

export async function cleanupExpired(): Promise<number> {
  const result = await db.categoryFeedItem.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  return result.count
}
