// Providers
export { GoogleProvider } from './providers/google'
export { GroqProvider } from './providers/groq'
export { AnthropicProvider } from './providers/anthropic'
export { AIProvider } from './providers/base'

// Types
export type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  EmbeddingResponse,
  TokenCountRequest,
  TokenCountResponse,
  ModelInfo,
  ProviderConfig,
  AIUsage,
  ToolCall,
} from './providers/types'

export {
  ProviderError,
  RateLimitError,
  ContextLengthError,
  AuthenticationError,
} from './providers/types'

// Router
export { getProvider, detectProvider, AVAILABLE_MODELS } from './router'

// Manager
export { initializeAIManager, getAIManager } from './manager'
export type { AIUsageMetrics } from './manager'

// Embeddings & RAG
export { generateEmbedding, generateEmbeddings, embeddingToSql, EMBEDDING_DIMS } from './embeddings'
export type { EmbeddingTaskType } from './embeddings'
export { searchSimilarNotes, searchSimilarChunks, buildRagContext, getRagContext, getRagResult } from './rag'
export type { RagNote, RagChunk, RagResult } from './rag'

// RAG Evaluation
export { evaluateRagResponse } from './rag-eval'
