/**
 * Visual embeddings via CLIP (openai/clip-vit-base-patch32) on HuggingFace Inference API.
 *
 * CLIP encodes BOTH images and text into the SAME 512-dimensional vector space.
 * This means:
 *   - A page image of a rectangle diagram → 512-dim vector
 *   - A student query "fraction of field Peter can reach" → 512-dim vector
 *   - Cosine similarity finds the right figure without any text match needed
 *
 * Why CLIP alongside BGE:
 *   - BGE (768-dim) finds relevant text chunks
 *   - CLIP (512-dim) finds relevant figures even when the text description is vague
 *   - Both results merged → Gemini Vision sees text + actual page image → correct answer
 *
 * Endpoint: router.huggingface.co (confirmed reachable from Vercel)
 */

const CLIP_MODEL = 'openai/clip-vit-base-patch32'
export const CLIP_DIMS = 512

const HF_BASE = 'https://router.huggingface.co/hf-inference/models'

function getHfToken(): string {
  const token = process.env['HF_TOKEN'] ?? process.env['HUGGINGFACE_API_KEY']
  if (!token) throw new Error('HF_TOKEN is not set')
  return token
}

/**
 * Embed a page image (PNG buffer) using CLIP.
 * Send raw PNG bytes — HF feature-extraction endpoint accepts image/png.
 */
export async function embedImage(pngBuffer: Buffer): Promise<number[]> {
  const token = getHfToken()

  const response = await fetch(`${HF_BASE}/${CLIP_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/png',
    },
    body: pngBuffer,
  })

  if (!response.ok) {
    const err = await response.text().catch(() => '')
    throw new Error(`CLIP image embedding failed [${response.status}]: ${err}`)
  }

  return parseEmbeddingResponse(await response.json())
}

/**
 * Embed a text query using CLIP (same vector space as image embeddings).
 * Use this at query time to find figures matching the student's question.
 */
export async function embedTextForImageSearch(text: string): Promise<number[]> {
  const token = getHfToken()

  const response = await fetch(`${HF_BASE}/${CLIP_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: text.slice(0, 77), // CLIP max token length is 77 tokens
      options: { wait_for_model: true },
    }),
  })

  if (!response.ok) {
    const err = await response.text().catch(() => '')
    throw new Error(`CLIP text embedding failed [${response.status}]: ${err}`)
  }

  return parseEmbeddingResponse(await response.json())
}

function parseEmbeddingResponse(data: unknown): number[] {
  // HF can return: number[], number[][], or nested structure
  if (Array.isArray(data)) {
    const first = data[0]
    if (typeof first === 'number') return data as number[]
    if (Array.isArray(first)) {
      const inner = first[0]
      if (typeof inner === 'number') return first as number[]
      if (Array.isArray(inner)) return inner as number[] // triple-nested
    }
  }
  throw new Error(`Unexpected CLIP response shape: ${JSON.stringify(data).slice(0, 100)}`)
}

export function clipEmbeddingToSql(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}
