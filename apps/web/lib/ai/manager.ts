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
    if (!config.apiKey) {
      throw new Error('API key is required for AI manager')
    }
    this.config = config
  }

  /**
   * Get or create a provider instance
   */
  private getOrCreateProvider(modelId: string): AIProvider {
    if (!this.providers.has(modelId)) {
      this.providers.set(modelId, getProvider(modelId, this.config))
    }
    return this.providers.get(modelId)!
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
 * Get the AI manager instance
 */
export function getAIManager(): AIManager {
  if (!aiManager) {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.GOOGLE_API_KEY || process.env.GROQ_API_KEY

    if (!apiKey) {
      throw new Error(
        'AI manager not initialized. Call initializeAIManager() first or set API key env vars'
      )
    }

    aiManager = new AIManager({
      apiKey,
      timeout: 30000,
      maxRetries: 3,
    })
  }

  return aiManager
}

export type { AIUsageMetrics }
