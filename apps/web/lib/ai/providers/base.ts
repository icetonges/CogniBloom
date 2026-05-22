import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  EmbeddingResponse,
  TokenCountRequest,
  TokenCountResponse,
  ModelInfo,
  ProviderConfig,
} from './types'

export abstract class AIProvider {
  protected config: ProviderConfig
  protected modelInfo: ModelInfo

  constructor(config: ProviderConfig, modelInfo: ModelInfo) {
    if (!config.apiKey) {
      throw new Error(`API key is required for ${modelInfo.provider}`)
    }
    this.config = config
    this.modelInfo = modelInfo
  }

  abstract chat(request: ChatRequest): Promise<ChatResponse>

  abstract stream(request: ChatRequest): AsyncGenerator<StreamChunk>

  abstract embed(texts: string[]): Promise<EmbeddingResponse>

  abstract tokenCount(request: TokenCountRequest): Promise<TokenCountResponse>

  getModelInfo(): ModelInfo {
    return this.modelInfo
  }

  protected async* retryStream<T>(
    generator: AsyncGenerator<T>,
    maxRetries = 3
  ): AsyncGenerator<T> {
    let retries = 0

    while (retries < maxRetries) {
      try {
        for await (const chunk of generator) {
          yield chunk
        }
        return
      } catch (error) {
        retries++
        if (retries >= maxRetries) {
          throw error
        }

        // Exponential backoff
        const delay = Math.pow(2, retries) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  protected validateContextLength(text: string): void {
    // Rough estimate: 1 token ≈ 4 characters
    const estimatedTokens = text.length / 4
    if (estimatedTokens > this.modelInfo.contextWindow) {
      throw new Error(
        `Text exceeds context window of ${this.modelInfo.contextWindow} tokens`
      )
    }
  }

  protected calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1000) * this.modelInfo.costPer1kInputTokens
    const outputCost =
      (outputTokens / 1000) * this.modelInfo.costPer1kOutputTokens
    return inputCost + outputCost
  }
}
