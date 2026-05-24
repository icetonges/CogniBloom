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
  // ── Google Gemini ─────────────────────────────────────────────────────────
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    providerLabel: 'Google',
    providerColor: '#4285f4',
    inputPricePer1M: 0.30,
    outputPricePer1M: 2.50,
    description: 'Best balance · 1M context · thinking mode · free tier',
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
    inputPricePer1M: 0.10,
    outputPricePer1M: 0.40,
    description: 'Cheapest Google model · 1M context · free tier',
    contextWindow: '1M',
    isFree: true,
    supportsVision: true,
    badge: 'Cheapest',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    providerLabel: 'Google',
    providerColor: '#4285f4',
    inputPricePer1M: 1.25,
    outputPricePer1M: 10.00,
    description: 'Most capable Google model · 1M context · free tier',
    contextWindow: '1M',
    isFree: true,
    supportsVision: true,
    badge: 'Most Capable',
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
    description: 'Lightning-fast · great for simple tasks · 128K',
    contextWindow: '128K',
    isFree: true,
    supportsVision: false,
  },

  // ── Anthropic Claude (paid) ───────────────────────────────────────────────
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
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
    id: 'claude-opus-4-1-20250805',
    name: 'Claude Opus 4.1',
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
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude Haiku 3.5',
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
