import Groq from 'groq-sdk'
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

const GROQ_MODELS: Record<string, ModelInfo> = {
  'compound-beta': {
    id: 'compound-beta',
    name: 'Compound Beta (Agentic)',
    provider: 'groq',
    contextWindow: 131072,
    costPer1kInputTokens: 0,
    costPer1kOutputTokens: 0,
    supportsVision: false,
    supportsToolCalling: true,
    supportsStreaming: true,
  },
  // Full Groq API model ID including namespace prefix
  'meta-llama/llama-4-scout-17b-16e-instruct': {
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout (17B Vision)',
    provider: 'groq',
    contextWindow: 131072,
    costPer1kInputTokens: 0,
    costPer1kOutputTokens: 0,
    supportsVision: true,
    supportsToolCalling: false,
    supportsStreaming: true,
  },
  'llama-3.3-70b-versatile': {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    provider: 'groq',
    contextWindow: 8192,
    costPer1kInputTokens: 0.00027,
    costPer1kOutputTokens: 0.00036,
    supportsVision: false,
    supportsToolCalling: false,
    supportsStreaming: true,
  },
  'llama-3.1-8b-instant': {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    provider: 'groq',
    contextWindow: 8192,
    costPer1kInputTokens: 0.000075,
    costPer1kOutputTokens: 0.0001,
    supportsVision: false,
    supportsToolCalling: false,
    supportsStreaming: true,
  },
}

export class GroqProvider extends AIProvider {
  private client: Groq
  private model: string

  constructor(
    config: ProviderConfig,
    modelId: string = 'llama-3.1-8b-instant'
  ) {
    const modelInfo = GROQ_MODELS[modelId]
    if (!modelInfo) {
      throw new Error(`Unknown Groq model: ${modelId}`)
    }

    super(config, modelInfo)
    this.model = modelId
    this.client = new Groq({
      apiKey: config.apiKey,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    })
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      // Groq is OpenAI-compatible: system messages go IN the messages array
      const messages = request.messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }))

      const response = await (this.client.chat.completions.create as any)({
        model: this.model,
        max_tokens: request.maxTokens ?? 2048,
        messages,
        temperature: request.temperature,
        top_p: request.topP,
      })

      const content =
        response.choices[0].message.content || ''

      return {
        id: response.id,
        content,
        role: 'assistant',
        tokensUsed: {
          input: response.usage?.prompt_tokens || 0,
          output: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0,
        },
        stopReason: response.choices[0].finish_reason as 'end_turn' | 'max_tokens',
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async *stream(request: ChatRequest): AsyncGenerator<StreamChunk> {
    try {
      // Groq is OpenAI-compatible: system messages go IN the messages array
      const messages = request.messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }))

      let contentBlockIndex = 0
      let inputTokens = 0
      let outputTokens = 0

      const stream = await (this.client.chat.completions.create as any)({
        model: this.model,
        max_tokens: request.maxTokens ?? 2048,
        messages,
        temperature: request.temperature,
        top_p: request.topP,
        stream: true,
      })

      for await (const chunk of stream) {
        if (chunk.choices[0].delta.content) {
          yield {
            id: chunk.id || Math.random().toString(36).substring(7),
            content: chunk.choices[0].delta.content,
            contentBlockIndex,
            tokensUsed: {
              input: inputTokens,
              output: outputTokens,
            },
          }
        }

        if ((chunk as any).usage) {
          inputTokens = (chunk as any).usage.prompt_tokens || 0
          outputTokens = (chunk as any).usage.completion_tokens || 0
        }
      }

      yield {
        id: Math.random().toString(36).substring(7),
        content: '',
        contentBlockIndex: contentBlockIndex++,
        tokensUsed: {
          input: inputTokens,
          output: outputTokens,
        },
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async embed(_texts: string[]): Promise<EmbeddingResponse> {
    // Groq doesn't provide embeddings API
    // Users should use Google or a dedicated embedding service
    throw new Error(
      'Groq does not provide embeddings. Use Google Gemini or a dedicated embedding service.'
    )
  }

  async tokenCount(request: TokenCountRequest): Promise<TokenCountResponse> {
    try {
      // Groq doesn't have a dedicated token counting API
      // Use rough estimation: 1 token ≈ 4 characters
      const tokens: number[] = []
      let total = 0

      for (const text of request.texts) {
        const count = Math.ceil(text.length / 4)
        tokens.push(count)
        total += count
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
    if (error instanceof Groq.AuthenticationError) {
      return new AuthenticationError('Invalid Groq API key')
    }

    if (error instanceof Groq.RateLimitError) {
      const headersGet = (error.headers as any)?.get
      const retryAfterHeader = typeof headersGet === 'function' ? headersGet('retry-after') : undefined
      return new RateLimitError(
        'Groq API rate limit exceeded',
        retryAfterHeader ? parseInt(retryAfterHeader) : undefined
      )
    }

    if (error instanceof Groq.BadRequestError) {
      if (error.message.includes('context')) {
        return new ContextLengthError(error.message)
      }
    }

    if (error instanceof Error) {
      return new Error(error.message) as any
    }

    return new Error('Unknown error with Groq API') as any
  }
}
