import { GoogleGenerativeAI } from '@google/generative-ai'

const EMBEDDING_MODEL = 'text-embedding-004'
const EMBEDDING_DIMS = 768

let genAI: GoogleGenerativeAI | null = null

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) throw new Error('GOOGLE_API_KEY is not set')
    genAI = new GoogleGenerativeAI(apiKey)
  }
  return genAI
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getClient()
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL })

  // Truncate to ~8000 chars to stay within token limits
  const truncated = text.slice(0, 8000)
  const result = await model.embedContent(truncated)
  return result.embedding.values
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(generateEmbedding))
}

export function embeddingToSql(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

export { EMBEDDING_DIMS }
