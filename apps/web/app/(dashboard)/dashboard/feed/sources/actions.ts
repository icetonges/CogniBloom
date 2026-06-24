'use server'

import { ingestAll, ingestCategory, cleanupExpired } from '@/lib/feed/ingest'
import { ALL_CATEGORIES, type Category } from '@/lib/feed/sources'

export interface TriggerResult {
  success: boolean
  summary?: {
    categoriesProcessed: number
    totalNewItems: number
    cleanedUpExpired: number
    durationMs: number
  }
  error?: string
}

/**
 * Server action — triggers feed ingestion directly on the server.
 * No CRON_SECRET needed: this runs as a server function, never in the browser.
 */
export async function triggerIngest(category?: string): Promise<TriggerResult> {
  try {
    const t0 = Date.now()

    let results
    if (category) {
      if (!(ALL_CATEGORIES as readonly string[]).includes(category)) {
        return { success: false, error: `Unknown category: ${category}` }
      }
      const result = await ingestCategory(category as Category)
      results = [result]
    } else {
      results = await ingestAll()
    }

    const cleanedUp = await cleanupExpired()
    const totalNew = results.reduce((sum, r) => sum + r.totalNew, 0)

    return {
      success: true,
      summary: {
        categoriesProcessed: results.length,
        totalNewItems: totalNew,
        cleanedUpExpired: cleanedUp,
        durationMs: Date.now() - t0,
      },
    }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
