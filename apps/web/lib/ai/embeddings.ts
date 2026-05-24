import { GoogleGenerativeAI } from '@google/generative-ai'

const EMBEDDING_MODEL = 'text-embedding-004'
const EMBEDDING_DIMS = 768

/**
 * Task types for text-embedding-004.
 * Using the correct task type gives a 10-30% relevance boost:
 *  - RETRIEVAL_DOCUMENT  -> at index time (storing notes/chunks)
 *  - RETRIEVAL_QUERY     -> at search time (user questions)
 *  - SEMANTIC_SIMILARITY -> general similarity comparisons
 */
export type EmbeddingTaskType =
  | 'RETRIEVAL_DOCUMENT'
  | 'RETRIEVAL_QUERY'
  | 'SEMANTIC_SIMILARITY'
  | 'CLASSIFICATION'
  | 'CLUSTERING'

let genAI: GoogleGenerativeAI | null = null

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env['GOOGLE_API_KEY'] ?? process.env['GEMINI_API_KEY']
    if (!apiKey) throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY is not set')
    genAI = new GoogleGenerativeAI(apiKey)
  }
  return genAI
}

export async function generateEmbedding(
  text: string,
  taskType: EmbeddingTaskType = 'RETRIEVAL_QUERY'
): Promise<number[]> {
  const client = getClient()
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL })

  // Truncate to ~8000 chars to stay within token limits
  const truncated = text.slice(0, 8000)
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text: truncated }] },
    taskType: taskType as never,
  })
  return result.embedding.values
}

export async function generateEmbeddings(
  texts: string[],
  taskType: EmbeddingTaskType = 'RETRIEVAL_QUERY'
): Promise<number[][]> {
  return Promise.all(texts.map((t) => generateEmbedding(t, taskType)))
}

export function embeddingToSql(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

export { EMBEDDING_DIMS }
