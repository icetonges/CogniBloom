/**
 * Embeddings via HuggingFace Inference API — BAAI/bge-base-en-v1.5
 *
 * This mirrors the LlamaIndex notebooks exactly:
 *   embed_model="local:BAAI/bge-small-en-v1.5"  (notebooks run it locally in Python)
 *   → here we call it via HF Inference API        (serverless-compatible for Next.js)
 *
 * WHY BGE instead of Google embeddings:
 *   Google embedding-001 and text-embedding-004 both return 404 for this
 *   project's API key — the embedding models are not enabled in this GCP project.
 *   BAAI/bge-base-en-v1.5 is free, reliable, and produces 768-dim vectors
 *   (same as the current pgvector schema — no DB migration needed).
 *
 * Setup: add HF_TOKEN to Vercel environment variables.
 *   Get a free token at https://huggingface.co/settings/tokens
 */

const HF_MODEL = 'BAAI/bge-base-en-v1.5'
export const EMBEDDING_DIMS = 768

// BGE models perform better with this prefix on the query side (not documents)
const BGE_QUERY_PREFIX = 'Represent this sentence for searching relevant passages: '

export type EmbeddingTaskType =
  | 'RETRIEVAL_DOCUMENT'
  | 'RETRIEVAL_QUERY'
  | 'SEMANTIC_SIMILARITY'
  | 'CLASSIFICATION'
  | 'CLUSTERING'

function getApiKey(): string {
  const token = process.env['HF_TOKEN'] ?? process.env['HUGGINGFACE_API_KEY']
  if (!token) {
    throw new Error(
      'HF_TOKEN is not set. Add a free HuggingFace token at https://huggingface.co/settings/tokens'
    )
  }
  return token
}

/**
 * Generate a single 768-dim embedding using BAAI/bge-base-en-v1.5.
 * Automatically applies the BGE query prefix for retrieval queries.
 */
export async function generateEmbedding(
  text: string,
  taskType: EmbeddingTaskType = 'RETRIEVAL_QUERY',
): Promise<number[]> {
  const token = getApiKey()

  // BGE convention: prepend prefix for query-side embeddings only
  const input = taskType === 'RETRIEVAL_QUERY'
    ? BGE_QUERY_PREFIX + text.slice(0, 7900)
    : text.slice(0, 8000)

  // router.huggingface.co resolves from Vercel; api-inference.huggingface.co does not (ENOTFOUND)
  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: input,
        options: { wait_for_model: true },
      }),
    }
  )

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(
      `HuggingFace Embedding API [${response.status} ${response.statusText}]: ${errText}`
    )
  }

  const data = await response.json() as number[] | number[][]

  // HF feature-extraction returns [[...]] (2D array) for single string input
  const values: number[] = Array.isArray(data[0])
    ? (data as number[][])[0]
    : (data as number[])

  if (!values || values.length !== EMBEDDING_DIMS) {
    throw new Error(
      `Unexpected embedding dimensions: got ${values?.length ?? 0}, expected ${EMBEDDING_DIMS}`
    )
  }

  return values
}

/**
 * Batch-embed multiple texts in a single HuggingFace API call.
 * Much faster than N sequential calls — the HF feature-extraction endpoint
 * accepts an array of strings and returns an array of vectors.
 *
 * Input batches larger than BATCH_SIZE are split into multiple requests
 * to stay well within HF's request-size limits.
 */
export async function generateEmbeddings(
  texts: string[],
  taskType: EmbeddingTaskType = 'RETRIEVAL_QUERY',
): Promise<number[][]> {
  if (texts.length === 0) return []

  const token = getApiKey()
  const BATCH_SIZE = 32   // safe upper limit for HF Inference API
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map((t) =>
      taskType === 'RETRIEVAL_QUERY'
        ? BGE_QUERY_PREFIX + t.slice(0, 7900)
        : t.slice(0, 8000)
    )

    const response = await fetch(
      `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: batch, options: { wait_for_model: true } }),
      }
    )

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`HF Batch Embedding [${response.status}]: ${errText}`)
    }

    // HF returns number[][] for a batch of strings (one row = one vector).
    // Occasionally a row is wrapped one level deeper: number[][][] → unwrap.
    const data = await response.json() as (number[] | number[][])[]
    for (const row of data) {
      const vec: number[] = Array.isArray(row[0])
        ? (row as number[][])[0]!
        : (row as number[])
      results.push(vec)
    }
  }

  return results
}

export function embeddingToSql(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}
