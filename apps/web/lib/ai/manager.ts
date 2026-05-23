import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  EmbeddingResponse,
  TokenCountRequest,
  TokenCountResponse,
  ProviderConfig,
} from './providers/types'
import { getProvider, detectProvider } from './router'
import { AIProvider } from './providers/base'

export interface AIUsageMetrics {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCost: number
}

class AIManager {
  private config: ProviderConfig
  private providers: Map<string, AIProvider> = new Map()
  private usageMetrics: AIUsageMetrics[] = []

  constructor(config: ProviderConfig) {
    this.config = config
  }

  /**
   * Resolve the correct API key for a given provider at call time.
   * This allows a single AIManager instance to serve all three providers.
   */
  private resolveApiKey(provider: 'google' | 'groq' | 'anthropic'): string {
    const keys: Record<string, string | undefined> = {
      google: process.env['GOOGLE_API_KEY'] ?? process.env['GEMINI_API_KEY'],
      groq: process.env['GROQ_API_KEY'],
      anthropic: process.env['ANTHROPIC_API_KEY'],
    }
    const key = keys[provider]
    if (!key) {
      throw new Error(
        provider === 'google'
          ? 'No API key configured for provider "google". Set GOOGLE_API_KEY or GEMINI_API_KEY in Vercel.'
          : `No API key configured for provider "${provider}". Set the ${provider.toUpperCase()}_API_KEY environment variable.`
      )
    }
    return key
  }

  /**
   * Get or create a provider instance with the correct per-provider API key.
   */
  private getOrCreateProvider(modelId: string): AIProvider {
    if (!this.providers.has(modelId)) {
      const provider = detectProvider(modelId)
      const apiKey = this.resolveApiKey(provider)
      const config: ProviderConfig = { ...this.config, apiKey }
      this.providers.set(modelId, getProvider(modelId, config))
    }
    return this.providers.get(modelId)!
  }

  /**
   * Validate that the API key for the model's provider is configured.
   * Throws with a clear message if not — call this before opening a stream
   * so the route can return a clean error response.
   */
  validateProvider(modelId: string): void {
    const provider = detectProvider(modelId)
    this.resolveApiKey(provider) // throws if key is absent
  }

  /**
   * Send a chat message and get response
   */
  async chat(modelId: string, request: ChatRequest): Promise<ChatResponse> {
    const provider = this.getOrCreateProvider(modelId)
    const response = await provider.chat(request)

    this.trackUsage(modelId, response.tokensUsed)

    return response
  }

  /**
   * Stream a chat response
   */
  async *stream(
    modelId: string,
    request: ChatRequest
  ): AsyncGenerator<StreamChunk> {
    const provider = this.getOrCreateProvider(modelId)

    let totalInputTokens = 0
    let totalOutputTokens = 0

    for await (const chunk of provider.stream(request)) {
      totalInputTokens = chunk.tokensUsed?.input || totalInputTokens
      totalOutputTokens = chunk.tokensUsed?.output || totalOutputTokens

      yield chunk
    }

    // Track usage after streaming completes
    if (totalInputTokens > 0 || totalOutputTokens > 0) {
      this.trackUsage(modelId, {
        input: totalInputTokens,
        output: totalOutputTokens,
        total: totalInputTokens + totalOutputTokens,
      })
    }
  }

  /**
   * Generate embeddings for texts
   */
  async embed(modelId: string, texts: string[]): Promise<EmbeddingResponse> {
    const provider = this.getOrCreateProvider(modelId)
    return provider.embed(texts)
  }

  /**
   * Count tokens for texts
   */
  async tokenCount(
    modelId: string,
    request: TokenCountRequest
  ): Promise<TokenCountResponse> {
    const provider = this.getOrCreateProvider(modelId)
    return provider.tokenCount(request)
  }

  /**
   * Get model information
   */
  getModelInfo(modelId: string) {
    const provider = this.getOrCreateProvider(modelId)
    return provider.getModelInfo()
  }

  /**
   * Track usage metrics for billing/analytics
   */
  private trackUsage(
    modelId: string,
    tokens: { input: number; output: number; total: number }
  ) {
    const provider = this.getOrCreateProvider(modelId)
    const modelInfo = provider.getModelInfo()
    const cost =
      (tokens.input / 1000) * modelInfo.costPer1kInputTokens +
      (tokens.output / 1000) * modelInfo.costPer1kOutputTokens

    this.usageMetrics.push({
      provider: modelInfo.provider,
      model: modelId,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      totalTokens: tokens.total,
      estimatedCost: cost,
    })
  }

  /**
   * Get all tracked usage metrics
   */
  getUsageMetrics(): AIUsageMetrics[] {
    return [...this.usageMetrics]
  }

  /**
   * Get total cost across all usage
   */
  getTotalCost(): number {
    return this.usageMetrics.reduce((sum, m) => sum + m.estimatedCost, 0)
  }

  /**
   * Reset usage metrics
   */
  resetMetrics() {
    this.usageMetrics = []
  }

  /**
   * Get usage summary for a specific model
   */
  getModelUsage(modelId: string) {
    const metrics = this.usageMetrics.filter((m) => m.model === modelId)
    return {
      totalRequests: metrics.length,
      totalInputTokens: metrics.reduce((sum, m) => sum + m.inputTokens, 0),
      totalOutputTokens: metrics.reduce((sum, m) => sum + m.outputTokens, 0),
      totalTokens: metrics.reduce((sum, m) => sum + m.totalTokens, 0),
      totalCost: metrics.reduce((sum, m) => sum + m.estimatedCost, 0),
      averageCostPerRequest:
        metrics.length > 0
          ? metrics.reduce((sum, m) => sum + m.estimatedCost, 0) /
            metrics.length
          : 0,
    }
  }

  /**
   * Get usage summary across all providers
   */
  getAllUsageSummary() {
    const providers = new Set(this.usageMetrics.map((m) => m.provider))
    const summary: Record<string, any> = {}

    for (const provider of providers) {
      const metrics = this.usageMetrics.filter((m) => m.provider === provider)
      summary[provider] = {
        requests: metrics.length,
        inputTokens: metrics.reduce((sum, m) => sum + m.inputTokens, 0),
        outputTokens: metrics.reduce((sum, m) => sum + m.outputTokens, 0),
        totalTokens: metrics.reduce((sum, m) => sum + m.totalTokens, 0),
        cost: metrics.reduce((sum, m) => sum + m.estimatedCost, 0),
      }
    }

    return {
      ...summary,
      total: {
        requests: this.usageMetrics.length,
        inputTokens: this.usageMetrics.reduce((sum, m) => sum + m.inputTokens, 0),
        outputTokens: this.usageMetrics.reduce((sum, m) => sum + m.outputTokens, 0),
        totalTokens: this.usageMetrics.reduce((sum, m) => sum + m.totalTokens, 0),
        cost: this.usageMetrics.reduce((sum, m) => sum + m.estimatedCost, 0),
      },
    }
  }
}

// Singleton instance
let aiManager: AIManager | null = null

/**
 * Initialize the AI manager (should be called once on app startup)
 */
export function initializeAIManager(config: ProviderConfig): AIManager {
  if (aiManager) {
    return aiManager
  }

  aiManager = new AIManager(config)
  return aiManager
}

/**
 * Get the AI manager instance.
 * Per-provider API keys (GOOGLE_API_KEY, GROQ_API_KEY, ANTHROPIC_API_KEY)
 * are resolved lazily when a model from that provider is first used.
 */
export function getAIManager(): AIManager {
  if (!aiManager) {
    aiManager = new AIManager({
      apiKey: '', // placeholder — each provider resolves its own key on demand
      timeout: 30000,
      maxRetries: 3,
    })
  }

  return aiManager
}
