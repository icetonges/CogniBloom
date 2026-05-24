/**
 * Google text-embedding-004 via the v1 (stable) REST API.
 *
 * ROOT CAUSE OF PRIOR FAILURES:
 * The @google/generative-ai SDK calls embedContent via v1beta by default.
 * But text-embedding-004 is a stable model — it only exists on v1 (not v1beta).
 * Every embedding call was returning 404 "model not found for API version v1beta".
 *
 * Fix: call the v1 REST endpoint directly with fetch(), bypassing the SDK.
 * The SDK is still used elsewhere (rag.ts, uploads/route.ts) for generative calls.
 */

const EMBEDDING_MODEL = 'text-embedding-004'
const EMBEDDING_DIMS = 768
const GEMINI_V1_BASE = 'https://generativelanguage.googleapis.com/v1'

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
 * Generate a single embedding vector using text-embedding-004 on the v1 API.
 * Truncates input to 8 000 chars to stay within the model's token limit.
 */
export async function generateEmbedding(
  text: string,
  taskType: EmbeddingTaskType = 'RETRIEVAL_QUERY',
): Promise<number[]> {
  const apiKey = getApiKey()
  const truncated = text.slice(0, 8000)

  const url = `${GEMINI_V1_BASE}/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: {
        role: 'user',
        parts: [{ text: truncated }],
      },
      taskType,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Embedding API [${response.status} ${response.statusText}]: ${errText}`)
  }

  const data = await response.json() as { embedding?: { values?: number[] } }
  const values = data?.embedding?.values

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
