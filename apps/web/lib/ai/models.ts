// Central AI model registry — single source of truth for all model metadata.
// Used by the UI (ChatWindow), API routes, and the AI manager.

export interface ModelRegistryEntry {
  id: string
  name: string
  provider: 'google' | 'groq' | 'anthropic'
  providerLabel: string
  providerColor: string
  inputPricePer1M: number
  outputPricePer1M: number
  description: string
  contextWindow: string
  isFree: boolean
  supportsVision: boolean
  isDefault?: boolean
  badge?: string
}

export type ModelId = string

export const MODELS: ModelRegistryEntry[] = [
  // ── Google Gemini (free via Google AI Studio) ─────────────────────────────
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    providerLabel: 'Google',
    providerColor: '#4285f4',
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    description: 'Best free model · 1M context · thinking mode',
    contextWindow: '1M',
    isFree: true,
    supportsVision: true,
    isDefault: true,
    badge: 'Recommended',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    provider: 'google',
    providerLabel: 'Google',
    providerColor: '#4285f4',
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    description: 'Fastest and most budget-friendly · 1M context',
    contextWindow: '1M',
    isFree: true,
    supportsVision: true,
    badge: 'Fastest',
  },

  // ── Groq (free, ultra-fast inference) ────────────────────────────────────
  {
    id: 'groq/compound-beta',
    name: 'Compound Beta',
    provider: 'groq',
    providerLabel: 'Groq',
    providerColor: '#f55036',
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    description: 'Agentic · built-in web search · auto tool use',
    contextWindow: '128K',
    isFree: true,
    supportsVision: false,
    badge: 'New',
  },
  {
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout',
    provider: 'groq',
    providerLabel: 'Groq',
    providerColor: '#f55036',
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    description: 'Llama 4 · MoE architecture · vision · 128K',
    contextWindow: '128K',
    isFree: true,
    supportsVision: true,
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    provider: 'groq',
    providerLabel: 'Groq',
    providerColor: '#f55036',
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    description: 'Best Llama 3 · ultra-fast inference · 128K',
    contextWindow: '128K',
    isFree: true,
    supportsVision: false,
    badge: 'Fast',
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    provider: 'groq',
    providerLabel: 'Groq',
    providerColor: '#f55036',
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    description: 'Tiny and blazing fast · 128K',
    contextWindow: '128K',
    isFree: true,
    supportsVision: false,
  },
  {
    id: 'gemma2-9b-it',
    name: 'Gemma 2 9B',
    provider: 'groq',
    providerLabel: 'Groq',
    providerColor: '#f55036',
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    description: 'Google Gemma 2 · open weights · 8K',
    contextWindow: '8K',
    isFree: true,
    supportsVision: false,
  },

  // ── Anthropic Claude (paid) ───────────────────────────────────────────────
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    providerLabel: 'Anthropic',
    providerColor: '#c85a3a',
    inputPricePer1M: 3,
    outputPricePer1M: 15,
    description: 'Balanced performance · 200K context',
    contextWindow: '200K',
    isFree: false,
    supportsVision: true,
    badge: 'Balanced',
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    providerLabel: 'Anthropic',
    providerColor: '#c85a3a',
    inputPricePer1M: 15,
    outputPricePer1M: 75,
    description: 'Highest intelligence · 200K context',
    contextWindow: '200K',
    isFree: false,
    supportsVision: true,
    badge: 'Powerful',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    providerLabel: 'Anthropic',
    providerColor: '#c85a3a',
    inputPricePer1M: 0.8,
    outputPricePer1M: 4,
    description: 'Fast and affordable · 200K context',
    contextWindow: '200K',
    isFree: false,
    supportsVision: true,
    badge: 'Budget',
  },
]

export const DEFAULT_MODEL_ID: ModelId =
  MODELS.find((m) => m.isDefault)?.id ?? 'gemini-2.5-flash'
