import { GoogleGenerativeAI, DynamicRetrievalMode } from '@google/generative-ai'
import type { ResponseSchema } from '@google/generative-ai'
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
  GroundingSource,
} from './types'
import { AuthenticationError, RateLimitError, ContextLengthError } from './types'

const GOOGLE_MODELS: Record<string, ModelInfo> = {
  'gemini-3.5-flash': {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    provider: 'google',
    contextWindow: 1000000,
    costPer1kInputTokens: 0.0015,
    costPer1kOutputTokens: 0.009,
    supportsVision: true,
    supportsToolCalling: true,
    supportsStreaming: true,
  },
  'gemini-3.1-flash-lite': {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    provider: 'google',
    contextWindow: 1000000,
    costPer1kInputTokens: 0.00025,
    costPer1kOutputTokens: 0.0015,
    supportsVision: true,
    supportsToolCalling: true,
    supportsStreaming: true,
  },
  // ── Gemini 2.5 series ────────────────────────────────────────────────────
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    contextWindow: 1000000,
    costPer1kInputTokens: 0.0003,    // $0.30/1M
    costPer1kOutputTokens: 0.0025,   // $2.50/1M
    supportsVision: true,
    supportsToolCalling: true,
    supportsStreaming: true,
  },
  'gemini-2.5-flash-lite': {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    provider: 'google',
    contextWindow: 1000000,
    costPer1kInputTokens: 0.0001,    // $0.10/1M — cheapest
    costPer1kOutputTokens: 0.0004,   // $0.40/1M
    supportsVision: true,
    supportsToolCalling: false,
    supportsStreaming: true,
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    contextWindow: 1000000,
    costPer1kInputTokens: 0.00125,   // $1.25/1M
    costPer1kOutputTokens: 0.01,     // $10.00/1M
    supportsVision: true,
    supportsToolCalling: true,
    supportsStreaming: true,
  },
}

export class GoogleProvider extends AIProvider {
  private client: GoogleGenerativeAI
  private model: string

  constructor(config: ProviderConfig, modelId: string = 'gemini-2.5-flash') {
    const modelInfo = GOOGLE_MODELS[modelId]
    if (!modelInfo) {
      throw new Error(`Unknown Google model: ${modelId}`)
    }

    super(config, modelInfo)
    this.model = modelId
    this.client = new GoogleGenerativeAI(config.apiKey)
  }

  private toGeminiContents(messages: ChatRequest['messages']) {
    const systemPrompt = messages
      .filter((msg) => msg.role === 'system')
      .map((msg) => msg.content)
      .join('\n\n')
      .trim()
    const conversation = messages.filter((msg) => msg.role !== 'system')

    return conversation.map((msg, index) => {
      const content = systemPrompt && index === 0 && msg.role === 'user'
        ? `System instructions:\n${systemPrompt}\n\nStudent message:\n${msg.content}`
        : msg.content

      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: content }],
      }
    })
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const genModel = this.client.getGenerativeModel({ model: this.model })

      const contents = this.toGeminiContents(request.messages)

      const response = await genModel.generateContent(
        {
          contents,
          generationConfig: {
            temperature: request.temperature ?? 0.7,
            maxOutputTokens: request.maxTokens ?? 2048,
            topP: request.topP ?? 1,
            responseMimeType: request.responseMimeType,
            responseSchema: request.responseSchema as ResponseSchema | undefined,
          },
        },
        {
          timeout: this.config.timeout ?? 30000,
        }
      )

      const text =
        response.response.text() || response.response.candidates?.[0]?.content?.parts?.[0]?.text || ''

      const usageMetadata = response.response.usageMetadata || {
        promptTokens: 0,
        candidatesTokens: 0,
        totalTokens: 0,
      }

      return {
        id: Math.random().toString(36).substring(7),
        content: text,
        role: 'assistant',
        tokensUsed: {
          input: (usageMetadata as any).promptTokens || 0,
          output: (usageMetadata as any).candidatesTokens || 0,
          total: (usageMetadata as any).totalTokens || 0,
        },
        stopReason: 'end_turn',
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async *stream(request: ChatRequest): AsyncGenerator<StreamChunk> {
    try {
      const tools = request.useGrounding
        ? [{ googleSearchRetrieval: { dynamicRetrievalConfig: { mode: DynamicRetrievalMode.MODE_DYNAMIC, dynamicThreshold: 0.3 } } }]
        : undefined

      const genModel = this.client.getGenerativeModel({ model: this.model, tools })

      const contents = this.toGeminiContents(request.messages)

      const stream = await genModel.generateContentStream(
        {
          contents,
          generationConfig: {
            temperature: request.temperature ?? 0.7,
            maxOutputTokens: request.maxTokens ?? 2048,
            topP: request.topP ?? 1,
            responseMimeType: request.responseMimeType,
            responseSchema: request.responseSchema as ResponseSchema | undefined,
          },
        },
        {
          timeout: this.config.timeout ?? 30000,
        }
      )

      let totalInputTokens = 0
      let totalOutputTokens = 0
      let contentBlockIndex = 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let lastChunk: any = null

      for await (const chunk of stream.stream) {
        const text = chunk.text() || chunk.candidates?.[0]?.content?.parts?.[0]?.text || ''
        lastChunk = chunk

        if (text) {
          const metadata = chunk.usageMetadata || { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 }
          totalInputTokens = (metadata as any).promptTokens || totalInputTokens
          totalOutputTokens = (metadata as any).candidatesTokens || totalOutputTokens

          yield {
            id: Math.random().toString(36).substring(7),
            content: text,
            contentBlockIndex,
            tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
          }
          contentBlockIndex++
        }
      }

      // After streaming completes, emit grounding sources if available
      if (request.useGrounding && lastChunk) {
        const gm = (lastChunk as any)?.candidates?.[0]?.groundingMetadata
        if (gm) {
          const sources: GroundingSource[] = (gm.groundingChunks ?? [])
            .filter((c: any) => c?.web?.uri)
            .map((c: any) => ({ uri: c.web.uri as string, title: (c.web.title as string) || c.web.uri }))
          if (sources.length > 0) {
            yield {
              id: Math.random().toString(36).substring(7),
              content: '',
              contentBlockIndex: contentBlockIndex,
              groundingSources: sources,
            }
          }
        }
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async embed(texts: string[]): Promise<EmbeddingResponse> {
    try {
      const model = this.client.getGenerativeModel({
        model: 'embedding-001',
      })

      const embeddings: number[][] = []
      let totalTokens = 0

      for (const text of texts) {
        const result = await model.embedContent(text)
        embeddings.push(result.embedding.values)
        // Rough estimate: 1 token ≈ 4 characters
        totalTokens += Math.ceil(text.length / 4)
      }

      return {
        embeddings,
        model: 'embedding-001',
        tokensUsed: totalTokens,
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async tokenCount(request: TokenCountRequest): Promise<TokenCountResponse> {
    try {
      const genModel = this.client.getGenerativeModel({ model: this.model })

      const tokens: number[] = []
      let total = 0

      for (const text of request.texts) {
        const result = await genModel.countTokens(text)
        const count = result.totalTokens
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
    if (error instanceof Error) {
      const message = error.message

      if (message.includes('401') || message.includes('Unauthorized')) {
        return new AuthenticationError('Invalid Google API key')
      }

      if (message.includes('429') || message.includes('rate limit')) {
        return new RateLimitError('Google API rate limit exceeded')
      }

      if (message.includes('context') || message.includes('too long')) {
        return new ContextLengthError('Context length exceeded')
      }

      return new Error(message) as any
    }

    return new Error('Unknown error with Google API') as any
  }
}
