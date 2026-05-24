import Anthropic from '@anthropic-ai/sdk'
import { AIProvider } from './base'
import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  EmbeddingResponse,
  TokenCountRequest,
  TokenCountResponse,
  ModelInfo,
  ProviderConfig,
  ProviderError,
} from './types'
import { AuthenticationError, RateLimitError, ContextLengthError } from './types'

const ANTHROPIC_MODELS: Record<string, ModelInfo> = {
  'claude-sonnet-4-20250514': {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    contextWindow: 200000,
    costPer1kInputTokens: 0.003,
    costPer1kOutputTokens: 0.015,
    supportsVision: true,
    supportsToolCalling: true,
    supportsStreaming: true,
  },
  'claude-opus-4-1-20250805': {
    id: 'claude-opus-4-1-20250805',
    name: 'Claude Opus 4.1',
    provider: 'anthropic',
    contextWindow: 200000,
    costPer1kInputTokens: 0.015,
    costPer1kOutputTokens: 0.075,
    supportsVision: true,
    supportsToolCalling: true,
    supportsStreaming: true,
  },
  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude Haiku 3.5',
    provider: 'anthropic',
    contextWindow: 200000,
    costPer1kInputTokens: 0.0008,
    costPer1kOutputTokens: 0.004,
    supportsVision: true,
    supportsToolCalling: true,
    supportsStreaming: true,
  },
}

export class AnthropicProvider extends AIProvider {
  private client: Anthropic
  private model: string

  constructor(
    config: ProviderConfig,
    modelId: string = 'claude-sonnet-4-20250514'
  ) {
    const modelInfo = ANTHROPIC_MODELS[modelId]
    if (!modelInfo) {
      throw new Error(`Unknown Anthropic model: ${modelId}`)
    }

    super(config, modelInfo)
    this.model = modelId
    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    })
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      // Filter out system messages and convert them to user messages with context
      const messages = request.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))

      const systemMessage = request.messages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n')

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens ?? 2048,
        system: systemMessage,
        messages,
        temperature: request.temperature,
        top_p: request.topP,
      })

      const content =
        response.content[0].type === 'text' ? response.content[0].text : ''

      return {
        id: response.id,
        content,
        role: 'assistant',
        tokensUsed: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens,
        },
        stopReason: response.stop_reason as 'end_turn' | 'max_tokens',
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async *stream(request: ChatRequest): AsyncGenerator<StreamChunk> {
    try {
      const messages = request.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))

      const systemMessage = request.messages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n')

      let contentBlockIndex = 0

      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: request.maxTokens ?? 2048,
        system: systemMessage,
        messages,
        temperature: request.temperature,
        top_p: request.topP,
      })

      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          yield {
            id: chunk.index?.toString() || '0',
            content: chunk.delta.text,
            contentBlockIndex,
            tokensUsed: {
              input: 0,
              output: 0,
            },
          }
        } else if (chunk.type === 'message_delta' && chunk.usage) {
          yield {
            id: Math.random().toString(36).substring(7),
            content: '',
            contentBlockIndex: contentBlockIndex++,
            tokensUsed: {
              input: (chunk.usage as any).input_tokens || 0,
              output: (chunk.usage as any).output_tokens || 0,
            },
          }
        }
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async embed(_texts: string[]): Promise<EmbeddingResponse> {
    // Claude doesn't have a native embedding API
    // For now, throw an error - users should use Google or a dedicated embedding service
    throw new Error(
      'Anthropic does not provide embeddings. Use Google Gemini or a dedicated embedding service.'
    )
  }

  async tokenCount(request: TokenCountRequest): Promise<TokenCountResponse> {
    try {
      const tokens: number[] = []
      let total = 0

      for (const text of request.texts) {
        const count = await (this.client.messages as any).countTokens({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: text,
            },
          ],
        })

        tokens.push((count as any).input_tokens)
        total += (count as any).input_tokens
      }

      return {
        tokens,
        total,
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  private handleError(error: unknown): ProviderError {
    if (error instanceof Anthropic.AuthenticationError) {
      return new AuthenticationError('Invalid Anthropic API key')
    }

    if (error instanceof Anthropic.RateLimitError) {
      const retryAfterHeader = (error.headers as any)?.['get']?.('retry-after')
      return new RateLimitError(
        'Anthropic API rate limit exceeded',
        retryAfterHeader ? parseInt(retryAfterHeader) : undefined
      )
    }

    if (error instanceof Anthropic.BadRequestError) {
      if (error.message.includes('context')) {
        return new ContextLengthError(error.message)
      }
    }

    if (error instanceof Error) {
      return new Error(error.message) as any
    }

    return new Error('Unknown error with Anthropic API') as any
  }
}
