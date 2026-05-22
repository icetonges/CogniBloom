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
    pattern: /^gemini/i,
    factory: (config, modelId) => new GoogleProvider(config, modelId),
  },
  {
    pattern: /^(llama|compound-beta|gemma)/i,
    factory: (config, modelId) => new GroqProvider(config, modelId),
  },
  {
    pattern: /^groq\//i,
    factory: (config, modelId) => new GroqProvider(config, modelId),
  },
  {
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
      `Unknown model provider for "${modelId}". Supported models: gemini-*, llama-*, claude-*, groq/*, compound-beta, gemma*`
    )
  }

  return route.factory(config, modelId)
}

// Detect provider from model ID string
export function detectProvider(modelId: string): 'google' | 'groq' | 'anthropic' {
  if (/^gemini/i.test(modelId)) return 'google'
  if (/^(llama|compound-beta|gemma|groq)/i.test(modelId)) return 'groq'
  if (/^claude/i.test(modelId)) return 'anthropic'

  throw new Error(`Unknown provider for model: ${modelId}`)
}

// List all available models grouped by provider
export const AVAILABLE_MODELS = {
  google: [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ],
  groq: [
    'compound-beta',
    'llama-4-scout-17b-16e-instruct',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'gemma2-9b-it',
  ],
  anthropic: [
    'claude-sonnet-4.6',
    'claude-opus-4.6',
    'claude-haiku-4.5',
  ],
}
