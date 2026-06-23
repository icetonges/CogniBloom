/**
 * Note-level spaced repetition — the "Daily Review" engine.
 *
 * Grounded in three well-established findings about human memory:
 *   1. The Ebbinghaus forgetting curve — memory decays exponentially unless
 *      a trace is re-activated. Reviewing just before you would forget resets
 *      the curve and flattens it over time.
 *   2. The spacing effect — recall improves when reviews are spread out with
 *      expanding intervals rather than crammed (SM-2 schedules exactly this).
 *   3. Active recall (retrieval practice) — trying to remember the answer
 *      *before* seeing it strengthens the memory far more than re-reading.
 *
 * We reuse the same SM-2 algorithm proven in the flashcard engine, but applied
 * at the granularity of a whole note so the whole knowledge base stays fresh.
 */
import { sm2 } from '@/lib/flashcards'

/** A self-grade on the 0–5 SM-2 scale used by the Daily Review UI. */
export const REVIEW_RATINGS = [
  { rating: 1, short: 'Forgot', label: 'Could not recall', emoji: '😰', color: 'bg-red-500 hover:bg-red-600' },
  { rating: 3, short: 'Hard', label: 'Recalled with effort', emoji: '😅', color: 'bg-amber-500 hover:bg-amber-600' },
  { rating: 4, short: 'Good', label: 'Recalled correctly', emoji: '😊', color: 'bg-blue-500 hover:bg-blue-600' },
  { rating: 5, short: 'Easy', label: 'Instant recall', emoji: '🎯', color: 'bg-green-500 hover:bg-green-600' },
] as const

/** Human-readable label for an SM-2 interval (days). */
export function intervalLabel(interval: number): string {
  if (interval <= 0) return 'New'
  if (interval === 1) return 'Tomorrow'
  if (interval < 7) return `${interval}d`
  if (interval < 30) return `${Math.round(interval / 7)}w`
  if (interval < 365) return `${Math.round(interval / 30)}mo`
  return `${(interval / 365).toFixed(1)}y`
}

/**
 * Approximate current retention probability for a scheduled item using the
 * forgetting-curve model R = e^(-t / S), where t is days since last review and
 * S (memory stability) is proportional to the SM-2 interval. Used only for the
 * "memory strength" visual on the review page — not for scheduling.
 */
export function retentionEstimate(daysSinceReview: number, interval: number): number {
  const stability = Math.max(interval, 1)
  return Math.exp(-daysSinceReview / (stability * 1.5))
}

export { sm2 }
