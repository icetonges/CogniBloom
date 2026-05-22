// Provider-agnostic types for AI abstraction layer

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  imageUrl?: string
  fileUrl?: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stopSequences?: string[]
}

export interface ChatResponse {
  id: string
  content: string
  role: 'assistant'
  tokensUsed: {
    input: number
    output: number
    total: number
  }
  stopReason?: 'end_turn' | 'max_tokens' | 'stop_sequence'
}

export interface StreamChunk {
  id: string
  content: string
  contentBlockIndex: number
  tokensUsed?: {
    input: number
    output: number
  }
  stopReason?: 'end_turn' | 'max_tokens' | 'stop_sequence'
}

export interface EmbeddingResponse {
  embeddings: number[][]
  model: string
  tokensUsed: number
}

export interface TokenCountRequest {
  texts: string[]
}

export interface TokenCountResponse {
  tokens: number[]
  total: number
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ProviderConfig {
  apiKey: string
  baseUrl?: string
  timeout?: number
  maxRetries?: number
  retryDelay?: number
}

export interface ProviderOptions {
  temperature?: number
  maxTokens?: number
  topP?: number
  streaming?: boolean
}

export interface ModelInfo {
  id: string
  name: string
  provider: 'google' | 'groq' | 'anthropic'
  contextWindow: number
  costPer1kInputTokens: number
  costPer1kOutputTokens: number
  supportsVision: boolean
  supportsToolCalling: boolean
  supportsStreaming: boolean
}

export interface AIUsage {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCost: number
}

export class ProviderError extends Error {
  constructor(
    public code: string,
    public override message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

export class RateLimitError extends ProviderError {
  constructor(message: string, public retryAfter?: number) {
    super('RATE_LIMIT', message, 429)
    this.name = 'RateLimitError'
  }
}

export class ContextLengthError extends ProviderError {
  constructor(message: string) {
    super('CONTEXT_LENGTH', message, 400)
    this.name = 'ContextLengthError'
  }
}

export class AuthenticationError extends ProviderError {
  constructor(message: string) {
    super('AUTHENTICATION', message, 401)
    this.name = 'AuthenticationError'
  }
}
