/**
 * AI Fallback Utility
 *
 * Provides chatWithFallback() and streamWithFallback() that automatically
 * retry failed AI calls down a priority chain:
 *   1. User-selected model (if provided)
 *   2. gemini-2.5-flash      (primary — fast, free, 1M context)
 *   3. gemini-2.5-flash-lite (Google fallback — lighter, no thinking)
 *   4. llama-3.3-70b-versatile (Groq fallback — ultra-fast, free)
 *   5. claude-haiku-4-5-20251001 (Anthropic fallback — reliable)
 *
 * Each route/component passes its preferred model; the fallback chain
 * automatically drops models whose API key is not configured.
 */

import { getAIManager } from '@/lib/ai'
import type { ChatRequest, ChatResponse, StreamChunk } from '@/lib/ai/providers/types'

// ── Default priority chain ────────────────────────────────────────────────────

export const FALLBACK_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'llama-3.3-70b-versatile',
  'claude-haiku-4-5-20251001',
] as const

export type FallbackModel = (typeof FALLBACK_CHAIN)[number]

/**
 * Build the ordered list of models to try.
 * If `preferred` is supplied and is in the chain, it moves to the front.
 * Models whose provider key is not configured are skipped silently.
 */
export function buildFallbackChain(preferred?: string): string[] {
  const base = [...FALLBACK_CHAIN] as string[]
  if (preferred && !base.includes(preferred)) {
    // user selected a model outside the chain (e.g. gemini-2.5-pro) — prepend it
    base.unshift(preferred)
  } else if (preferred && base.includes(preferred)) {
    // move the preferred model to the front
    const rest = base.filter((m) => m !== preferred)
    return [preferred, ...rest]
  }
  return base
}

/** True for errors we should skip to the next model for (service issues, quota, auth). */
function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return true
  const msg = err.message.toLowerCase()
  return (
    msg.includes('503') ||
    msg.includes('service unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('401') ||
    msg.includes('unauthorized') ||
    msg.includes('api key') ||
    msg.includes('not configured') ||
    msg.includes('502') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('socket hang up')
  )
}

// ── Non-streaming fallback ────────────────────────────────────────────────────

export interface FallbackResult extends ChatResponse {
  /** Which model actually responded */
  usedModel: string
  /** Models that were tried before this one */
  failedModels: string[]
}

/**
 * Chat (non-streaming) with automatic fallback.
 * Throws only if every model in the chain fails.
 */
export async function chatWithFallback(
  request: ChatRequest,
  preferred?: string
): Promise<FallbackResult> {
  const chain = buildFallbackChain(preferred)
  const manager = getAIManager()
  const failedModels: string[] = []
  let lastError: unknown

  for (const modelId of chain) {
    // Skip models whose provider key is absent
    try {
      manager.validateProvider(modelId)
    } catch {
      failedModels.push(modelId)
      continue
    }

    try {
      const response = await manager.chat(modelId, request)
      return { ...response, usedModel: modelId, failedModels }
    } catch (err) {
      lastError = err
      if (isRetryableError(err)) {
        console.warn(`[fallback] ${modelId} failed (${(err as Error).message.slice(0, 80)}), trying next…`)
        failedModels.push(modelId)
        continue
      }
      // Non-retryable error (e.g. bad request) — propagate immediately
      throw err
    }
  }

  throw lastError ?? new Error('All AI models in the fallback chain failed')
}

// ── Streaming fallback ────────────────────────────────────────────────────────

/**
 * Stream with automatic fallback.
 * Tries each model; if it fails BEFORE yielding any content, moves on.
 * Once content starts flowing, stays on that model.
 *
 * Yields an extra meta chunk `{ type: 'model', model: string }` as the
 * first event so the client knows which model is actually responding.
 */
export async function* streamWithFallback(
  request: ChatRequest,
  preferred?: string
): AsyncGenerator<StreamChunk & { usedModel?: string }> {
  const chain = buildFallbackChain(preferred)
  const manager = getAIManager()
  let lastError: unknown

  for (const modelId of chain) {
    // Skip models whose provider key is absent
    try {
      manager.validateProvider(modelId)
    } catch {
      continue
    }

    try {
      let started = false
      for await (const chunk of manager.stream(modelId, request)) {
        if (!started) {
          // Emit model-info meta chunk first (clients can ignore unknown types)
          yield { id: 'meta', content: '', contentBlockIndex: -1, usedModel: modelId }
          started = true
        }
        yield chunk
      }
      // Stream completed successfully
      return
    } catch (err) {
      lastError = err
      if (isRetryableError(err)) {
        console.warn(`[fallback/stream] ${modelId} failed (${(err as Error).message.slice(0, 80)}), trying next…`)
        continue
      }
      throw err
    }
  }

  throw lastError ?? new Error('All AI models in the fallback chain failed')
}
