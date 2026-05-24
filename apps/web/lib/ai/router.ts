import type { ProviderConfig } from './providers/types'
import { GoogleProvider } from './providers/google'
import { GroqProvider } from './providers/groq'
import { AnthropicProvider } from './providers/anthropic'
import { AIProvider } from './providers/base'

type ProviderFactory = (config: ProviderConfig, modelId: string) => AIProvider

const PROVIDER_ROUTES: Array<{
  pattern: RegExp
  factory: ProviderFactory
}> = [
  {
    // Google Gemini
    pattern: /^gemini/i,
    factory: (config, modelId) => new GoogleProvider(config, modelId),
  },
  {
    // groq/compound-beta — strip "groq/" prefix before passing to provider
    pattern: /^groq\//i,
    factory: (config, modelId) => new GroqProvider(config, modelId.replace(/^groq\//, '')),
  },
  {
    // meta-llama/... and plain llama/compound-beta IDs
    pattern: /^(meta-llama\/|llama|compound-beta)/i,
    factory: (config, modelId) => new GroqProvider(config, modelId),
  },
  {
    // Anthropic Claude
    pattern: /^claude/i,
    factory: (config, modelId) => new AnthropicProvider(config, modelId),
  },
]

export function getProvider(
  modelId: string,
  config: ProviderConfig
): AIProvider {
  const route = PROVIDER_ROUTES.find((r) => r.pattern.test(modelId))

  if (!route) {
    throw new Error(
      `Unknown model provider for "${modelId}". Supported prefixes: gemini-*, groq/*, meta-llama/*, llama-*, compound-beta, claude-*. All gemini-2.x and gemini-3.x IDs are valid.`
    )
  }

  return route.factory(config, modelId)
}

// Detect provider from model ID string — used by the manager to pick the right API key
export function detectProvider(modelId: string): 'google' | 'groq' | 'anthropic' {
  if (/^gemini/i.test(modelId)) return 'google'
  if (/^(groq\/|meta-llama\/|llama|compound-beta)/i.test(modelId)) return 'groq'
  if (/^claude/i.test(modelId)) return 'anthropic'

  throw new Error(`Unknown provider for model: ${modelId}`)
}

// Canonical list grouped by provider (matches models.ts registry)
export const AVAILABLE_MODELS = {
  google: [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
  ],
  groq: [
    'groq/compound-beta',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
  ],
  anthropic: [
    'claude-sonnet-4-20250514',
    'claude-opus-4-1-20250805',
    'claude-3-5-haiku-20241022',
  ],
}
