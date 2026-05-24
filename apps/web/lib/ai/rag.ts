import { db } from '@/lib/db'
import { generateEmbedding, embeddingToSql } from './embeddings'
import { GoogleGenerativeAI } from '@google/generative-ai'

export interface RagNote {
  id: string
  title: string
  content: string
  subject: string | null
  similarity: number
}

export interface RagChunk {
  id: string
  content: string
  windowContent?: string
  filename: string
  similarity: number
  hybridScore?: number
}

// ─── HyDE — Hypothetical Document Embeddings ─────────────────────────────────

/**
 * Generate a hypothetical answer document for the query.
 * The embedding of this hypothetical document tends to match real relevant
 * documents better than the raw question embedding alone.
 *
 * Falls back to the original query on error so it never blocks retrieval.
 */
async function generateHypotheticalDocument(query: string): Promise<string> {
  try {
    const apiKey = process.env['GOOGLE_API_KEY'] ?? process.env['GEMINI_API_KEY']
    if (!apiKey) return query

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

    const result = await model.generateContent(
      `Write a concise, factual passage (3-5 sentences) that directly answers the following question as if it were a textbook excerpt or study note. Do not include the question in your answer — write only the answer passage.\n\nQuestion: ${query}`
    )
    const hypothetical = result.response.text().trim()
    return hypothetical.length > 20 ? hypothetical : query
  } catch {
    return query
  }
}

// ─── Keyword scoring (BM25-inspired term frequency) ──────────────────────────

/**
 * Simple keyword relevance score — normalised term frequency in the content.
 * Acts as the "BM25" component in the hybrid score.
 */
function keywordScore(content: string, query: string): number {
  const lowerContent = content.toLowerCase()
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2)
  if (terms.length === 0) return 0

  let hits = 0
  for (const term of terms) {
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    const matches = lowerContent.match(re)
    hits += matches ? matches.length : 0
  }
  // Normalise by content length to avoid bias toward long chunks
  return Math.min(hits / (content.length / 100 + 1), 1)
}

/**
 * Combine vector similarity and keyword score into a hybrid rank.
 * α controls the weight given to vector vs keyword (default 0.7 vector / 0.3 keyword).
 */
function hybridScore(similarity: number, kwScore: number, alpha = 0.7): number {
  return alpha * similarity + (1 - alpha) * kwScore
}

// ─── Note retrieval ───────────────────────────────────────────────────────────

export async function searchSimilarNotes(
  userId: string,
  query: string,
  limit = 4,
  minSimilarity = 0.55,
  useHyde = true,
): Promise<RagNote[]> {
  // Run HyDE + raw query embedding in parallel for maximum coverage
  const [queryEmbedding, hydeEmbedding] = await Promise.all([
    generateEmbedding(query, 'RETRIEVAL_QUERY'),
    useHyde
      ? generateHypotheticalDocument(query).then((doc) =>
          generateEmbedding(doc, 'RETRIEVAL_QUERY')
        )
      : Promise.resolve(null),
  ])

  // Average the two embedding vectors for a blended retrieval signal
  const finalEmbedding =
    hydeEmbedding
      ? queryEmbedding.map((v, i) => (v + hydeEmbedding[i]!) / 2)
      : queryEmbedding
  const vectorStr = embeddingToSql(finalEmbedding)

  const results = await db.$queryRaw<RagNote[]>`
    SELECT
      id,
      title,
      content,
      subject,
      1 - (embedding <=> ${vectorStr}::vector(768)) AS similarity
    FROM "Note"
    WHERE "userId" = ${userId}
      AND embedding IS NOT NULL
      AND 1 - (embedding <=> ${vectorStr}::vector(768)) > ${minSimilarity}
    ORDER BY embedding <=> ${vectorStr}::vector(768)
    LIMIT ${limit * 2}
  `

  // Re-rank with hybrid score then take top `limit`
  const reranked = results
    .map((note) => ({
      ...note,
      hybridScore: hybridScore(Number(note.similarity), keywordScore(note.content, query)),
    }))
    .sort((a, b) => (b.hybridScore ?? 0) - (a.hybridScore ?? 0))
    .slice(0, limit)

  return reranked
}

export function buildRagContext(notes: RagNote[]): string {
  if (notes.length === 0) return ''

  const sections = notes.map((note, i) => {
    const preview = note.content.slice(0, 600)
    const ellipsis = note.content.length > 600 ? '…' : ''
    return `[Note ${i + 1}${note.subject ? ` — ${note.subject}` : ''}]: ${note.title}\n${preview}${ellipsis}`
  })

  return [
    "--- Relevant notes from the student's knowledge base ---",
    ...sections,
    '--- End of notes ---',
  ].join('\n\n')
}

// ─── Chunk retrieval ──────────────────────────────────────────────────────────

export async function searchSimilarChunks(
  userId: string,
  query: string,
  limit = 3,
  minSimilarity = 0.55,
  useHyde = true,
): Promise<RagChunk[]> {
  const [queryEmbedding, hydeEmbedding] = await Promise.all([
    generateEmbedding(query, 'RETRIEVAL_QUERY'),
    useHyde
      ? generateHypotheticalDocument(query).then((doc) =>
          generateEmbedding(doc, 'RETRIEVAL_QUERY')
        )
      : Promise.resolve(null),
  ])

  const finalEmbedding =
    hydeEmbedding
      ? queryEmbedding.map((v, i) => (v + hydeEmbedding[i]!) / 2)
      : queryEmbedding
  const vectorStr = embeddingToSql(finalEmbedding)

  const results = await db.$queryRaw<
    Array<{
      id: string
      content: string
      windowContent: string | null
      filename: string
      similarity: number
    }>
  >`
    SELECT c.id, c.content,
           COALESCE(c."windowContent", c.content) AS "windowContent",
           u.filename,
           1 - (c.embedding <=> ${vectorStr}::vector(768)) AS similarity
    FROM "Chunk" c
    JOIN "Upload" u ON u.id = c."uploadId"
    WHERE u."userId" = ${userId}
      AND c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> ${vectorStr}::vector(768)) > ${minSimilarity}
    ORDER BY c.embedding <=> ${vectorStr}::vector(768)
    LIMIT ${limit * 2}
  `

  const reranked = results
    .map((chunk) => ({
      ...chunk,
      windowContent: chunk.windowContent ?? chunk.content,
      hybridScore: hybridScore(Number(chunk.similarity), keywordScore(chunk.content, query)),
    }))
    .sort((a, b) => (b.hybridScore ?? 0) - (a.hybridScore ?? 0))
    .slice(0, limit)

  return reranked
}

// ─── Unified context builder ──────────────────────────────────────────────────

export interface RagResult {
  context: string
  notesUsed: RagNote[]
  chunksUsed: RagChunk[]
  hydeUsed: boolean
}

export async function getRagContext(userId: string, query: string): Promise<string> {
  const { context } = await getRagResult(userId, query)
  return context
}

export async function getRagResult(userId: string, query: string): Promise<RagResult> {
  try {
    const [notes, chunks] = await Promise.all([
      searchSimilarNotes(userId, query, 4, 0.55, true),
      searchSimilarChunks(userId, query, 3, 0.55, true),
    ])

    const parts: string[] = []

    if (notes.length > 0) parts.push(buildRagContext(notes))

    if (chunks.length > 0) {
      // Use the wider window content for LLM context, not just the small retrieval chunk
      const chunkSection = chunks.map(
        (c, i) =>
          `[Document ${i + 1} — ${c.filename}]: ${(c.windowContent ?? c.content).slice(0, 700)}`
      )
      parts.push(
        [
          '--- Relevant passages from uploaded documents ---',
          ...chunkSection,
          '--- End of documents ---',
        ].join('\n\n')
      )
    }

    return {
      context: parts.join('\n\n'),
      notesUsed: notes,
      chunksUsed: chunks,
      hydeUsed: true,
    }
  } catch {
    return { context: '', notesUsed: [], chunksUsed: [], hydeUsed: false }
  }
}
