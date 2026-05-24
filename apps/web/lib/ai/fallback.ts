/**
 * AI Fallback Utility
 *
 * Provides chatWithFallback() and streamWithFallback() that automatically
 * retry failed AI calls down a priority chain across all three providers:
 *
 *   Google Gemini (free) → Groq (free) → Anthropic Claude (paid)
 *
 * All 10 available models are in the chain. Models whose API key is not
 * configured are skipped automatically.
 */

import { getAIManager } from '@/lib/ai'
import { MODELS } from '@/lib/ai/models'
import type { ChatRequest, ChatResponse, StreamChunk } from '@/lib/ai/providers/types'

// ── Full fallback chain — all 10 models ──────────────────────────────────────
// Order: free/fast Google first, then free Groq, then paid Anthropic

export const FALLBACK_CHAIN: string[] = [
  // Google Gemini (free tier)
  'gemini-2.5-flash',               // primary: fast, 1M ctx, free
  'gemini-2.5-flash-lite',          // lighter, no thinking, free
  'gemini-2.5-pro',                 // most capable Google, free

  // Groq (free, ultra-fast inference)
  'llama-3.3-70b-versatile',        // best Llama 3, 128K, free
  'meta-llama/llama-4-scout-17b-16e-instruct', // Llama 4, vision, free
  'llama-3.1-8b-instant',           // fastest, simple tasks, free
  'groq/compound-beta',             // agentic Groq system

  // Anthropic Claude (paid — last resort)
  'claude-3-5-haiku-20241022',      // cheapest, 200K ctx
  'claude-sonnet-4-20250514',       // balanced
  'claude-opus-4-1-20250805',       // most powerful
]

/** All models shown in UI dropdowns (same order, includes labels) */
export const ALL_MODELS_FOR_UI = FALLBACK_CHAIN
const KNOWN_MODEL_IDS = new Set(MODELS.map((model) => model.id))

/**
 * Build the ordered list of models to try.
 * If `preferred` is supplied it moves to the front.
 * Models whose provider key is absent are skipped silently.
 */
export function buildFallbackChain(preferred?: string): string[] {
  if (!preferred || !KNOWN_MODEL_IDS.has(preferred)) {
    return [...FALLBACK_CHAIN]
  }
  if (!FALLBACK_CHAIN.includes(preferred)) {
    return [preferred, ...FALLBACK_CHAIN]
  }
  return [preferred, ...FALLBACK_CHAIN.filter((m) => m !== preferred)]
}

/** True for errors we should skip to the next model for. */
function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return true
  const msg = err.message.toLowerCase()
  return (
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('500') ||
    msg.includes('service unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('401') ||
    msg.includes('unauthorized') ||
    msg.includes('not configured') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('socket hang up') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('unavailable') ||
    msg.includes('capacity')
  )
}

// ── Non-streaming fallback ────────────────────────────────────────────────────

export interface FallbackResult extends ChatResponse {
  usedModel: string
  failedModels: string[]
}

/**
 * Chat (non-streaming) with automatic fallback across all providers.
 * Throws only if every configured model fails.
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
    // Skip models whose provider API key is absent
    try {
      manager.validateProvider(modelId)
    } catch {
      // Key not configured — silently skip
      continue
    }

    try {
      const response = await manager.chat(modelId, request)
      if (failedModels.length > 0) {
        console.info(`[fallback] ${modelId} succeeded after skipping: ${failedModels.join(', ')}`)
      }
      return { ...response, usedModel: modelId, failedModels }
    } catch (err) {
      lastError = err
      const errMsg = err instanceof Error ? err.message : String(err)
      if (isRetryableError(err)) {
        console.warn(`[fallback] ${modelId} failed (${errMsg.slice(0, 100)}), trying next…`)
        failedModels.push(modelId)
        continue
      }
      // Non-retryable (bad request, schema error) — stop immediately
      throw err
    }
  }

  const allTried = failedModels.join(', ') || 'none'
  const baseMsg = lastError instanceof Error ? lastError.message : 'All AI models failed'
  throw new Error(`${baseMsg} [tried: ${allTried}]`)
}

// ── Streaming fallback ────────────────────────────────────────────────────────

/**
 * Stream with automatic fallback.
 * If a model throws before yielding any content, moves to the next.
 * Once content starts flowing, stays on that model until done.
 */
export async function* streamWithFallback(
  request: ChatRequest,
  preferred?: string
): AsyncGenerator<StreamChunk & { usedModel?: string }> {
  const chain = buildFallbackChain(preferred)
  const manager = getAIManager()
  let lastError: unknown

  for (const modelId of chain) {
    try {
      manager.validateProvider(modelId)
    } catch {
      continue
    }

    try {
      let started = false
      for await (const chunk of manager.stream(modelId, request)) {
        if (!started) {
          yield { id: 'meta', content: '', contentBlockIndex: -1, usedModel: modelId }
          started = true
        }
        yield chunk
      }
      return // stream completed successfully
    } catch (err) {
      lastError = err
      if (isRetryableError(err)) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.warn(`[fallback/stream] ${modelId} failed (${errMsg.slice(0, 100)}), trying next…`)
        continue
      }
      throw err
    }
  }

  throw lastError ?? new Error('All AI models in the fallback chain failed')
}
