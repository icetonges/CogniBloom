/**
 * Google embedding-001 via the Generative AI SDK (v1beta endpoint).
 *
 * WHY embedding-001, not text-embedding-004:
 * Both models produce 768-dimensional vectors and work identically for
 * RAG retrieval. However, text-embedding-004 returns HTTP 404 for this
 * project's API key on BOTH v1 and v1beta — it is not enabled in this
 * Google Cloud project. embedding-001 works correctly with the same key.
 *
 * Switching requires no DB schema changes (vectors are still 768 dims).
 * All previously failed chunks will be re-embedded via admin/content/embed.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const EMBEDDING_MODEL = 'embedding-001'
const EMBEDDING_DIMS = 768

export type EmbeddingTaskType =
  | 'RETRIEVAL_DOCUMENT'
  | 'RETRIEVAL_QUERY'
  | 'SEMANTIC_SIMILARITY'
  | 'CLASSIFICATION'
  | 'CLUSTERING'

function getApiKey(): string {
  const apiKey = process.env['GOOGLE_API_KEY'] ?? process.env['GEMINI_API_KEY']
  if (!apiKey) throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY environment variable is not set')
  return apiKey
}

/**
 * Generate a single embedding vector using embedding-001.
 * Truncates input to 8 000 chars to stay within the model's token limit.
 */
export async function generateEmbedding(
  text: string,
  taskType: EmbeddingTaskType = 'RETRIEVAL_QUERY',
): Promise<number[]> {
  const apiKey = getApiKey()
  const truncated = text.slice(0, 8000)

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await model.embedContent({
    content: { parts: [{ text: truncated }] },
    taskType: taskType as any,
  })

  const values = result.embedding.values

  if (!values || values.length !== EMBEDDING_DIMS) {
    throw new Error(
      `Unexpected embedding response: got ${values?.length ?? 0} dims, expected ${EMBEDDING_DIMS}`
    )
  }

  return values
}

export async function generateEmbeddings(
  texts: string[],
  taskType: EmbeddingTaskType = 'RETRIEVAL_QUERY',
): Promise<number[][]> {
  return Promise.all(texts.map((t) => generateEmbedding(t, taskType)))
}

export function embeddingToSql(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

export { EMBEDDING_DIMS }
