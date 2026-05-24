import { db } from '@/lib/db'
import { generateEmbedding, embeddingToSql } from './embeddings'
import { embedTextForImageSearch, clipEmbeddingToSql } from './visual-embeddings'
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
 * Generate a hypothetical answer passage for the query (HyDE technique from
 * L1 notebook). Embedding a plausible answer often retrieves more relevant
 * passages than embedding the question alone.
 * Falls back silently to the original query on any error.
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
  return Math.min(hits / (content.length / 100 + 1), 1)
}

function hybridScore(similarity: number, kwScore: number, alpha = 0.7): number {
  return alpha * similarity + (1 - alpha) * kwScore
}

// ─── Gemini cross-encoder reranking ──────────────────────────────────────────
/**
 * Re-rank a list of candidate passages using Gemini as a cross-encoder
 * (analogous to the BAAI/bge-reranker-base used in the L3 notebook).
 *
 * Gemini scores each passage's relevance to the query on a 0–10 scale, then
 * we normalise and blend with the existing hybrid score. Falls back gracefully
 * if the API call fails so retrieval always returns something.
 */
async function rerankChunksWithGemini(
  query: string,
  chunks: RagChunk[],
  topN: number,
): Promise<RagChunk[]> {
  if (chunks.length <= topN) return chunks   // nothing to re-rank

  try {
    const apiKey = process.env['GOOGLE_API_KEY'] ?? process.env['GEMINI_API_KEY']
    if (!apiKey) return chunks.slice(0, topN)

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

    // Build a compact prompt listing all candidates
    const passages = chunks
      .map((c, i) => `[${i}] ${(c.windowContent ?? c.content).slice(0, 300)}`)
      .join('\n\n')

    const prompt = `You are a relevance judge. For each passage below, output ONLY a JSON array of numbers (0-10) representing how relevant each passage is to the query. Output nothing else.\n\nQuery: "${query}"\n\nPassages:\n${passages}\n\nOutput format: [score0, score1, ...]`

    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()

    // Extract the JSON array from the response
    const match = raw.match(/\[[\d.,\s]+\]/)
    if (!match) return chunks.slice(0, topN)

    const scores: number[] = JSON.parse(match[0])
    if (scores.length !== chunks.length) return chunks.slice(0, topN)

    // Blend reranker score (0–1) with existing hybrid score
    const reranked = chunks.map((c, i) => ({
      ...c,
      hybridScore: 0.5 * (c.hybridScore ?? 0) + 0.5 * (scores[i]! / 10),
    }))

    return reranked
      .sort((a, b) => (b.hybridScore ?? 0) - (a.hybridScore ?? 0))
      .slice(0, topN)
  } catch {
    // Fallback: return top-N by existing hybrid score
    return chunks.slice(0, topN)
  }
}

// ─── Note retrieval ───────────────────────────────────────────────────────────

export async function searchSimilarNotes(
  userId: string,
  query: string,
  limit = 4,
  minSimilarity = 0.55,
  useHyde = true,
): Promise<RagNote[]> {
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
  limit = 4,
  minSimilarity = 0.45,   // slightly lower threshold — reranker handles precision
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

  // Fetch more candidates (limit * 3) so the reranker has something to work with
  const candidates = await db.$queryRaw<
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
    LIMIT ${limit * 3}
  `

  if (candidates.length === 0) return []

  // Step 1: hybrid re-scoring (vector + BM25 keyword)
  const hybridScored: RagChunk[] = candidates.map((chunk) => ({
    ...chunk,
    windowContent: chunk.windowContent ?? chunk.content,
    hybridScore: hybridScore(Number(chunk.similarity), keywordScore(chunk.content, query)),
  }))

  // Step 2: sort by hybrid score and take top candidates for Gemini reranking
  hybridScored.sort((a, b) => (b.hybridScore ?? 0) - (a.hybridScore ?? 0))
  const topCandidates = hybridScored.slice(0, Math.min(hybridScored.length, limit * 2))

  // Step 3: Gemini cross-encoder rerank (L3 notebook pattern)
  const reranked = await rerankChunksWithGemini(query, topCandidates, limit)

  return reranked
}

// ─── Unified context builder ──────────────────────────────────────────────────

export interface RagFigure {
  pageIndex: number
  imageBase64: string   // PNG — pass directly to Gemini Vision as inline_data
  caption: string | null
  similarity: number
}

export interface RagResult {
  context: string
  notesUsed: RagNote[]
  chunksUsed: RagChunk[]
  figuresUsed: RagFigure[]
  hydeUsed: boolean
}

/**
 * Search FigureEmbedding table using CLIP text encoding of the query.
 * Returns page images whose visual content is similar to the query.
 */
async function searchSimilarFigures(
  userId: string,
  query: string,
  limit = 2,
  minSimilarity = 0.20,  // CLIP scores are lower than BGE — use a lower threshold
): Promise<RagFigure[]> {
  try {
    const clipVec = await embedTextForImageSearch(query)
    const vectorStr = clipEmbeddingToSql(clipVec)

    const results = await db.$queryRaw<Array<{
      pageIndex: number
      imageBase64: string
      caption: string | null
      similarity: number
    }>>`
      SELECT
        fe."pageIndex",
        fe."imageBase64",
        fe."caption",
        1 - (fe.embedding <=> ${vectorStr}::vector(512)) AS similarity
      FROM "FigureEmbedding" fe
      JOIN "Upload" u ON u.id = fe."uploadId"
      WHERE u."userId" = ${userId}
        AND fe.embedding IS NOT NULL
        AND 1 - (fe.embedding <=> ${vectorStr}::vector(512)) > ${minSimilarity}
      ORDER BY fe.embedding <=> ${vectorStr}::vector(512)
      LIMIT ${limit}
    `

    return results.map(r => ({ ...r, similarity: Number(r.similarity) }))
  } catch {
    // FigureEmbedding table may not exist yet on older deployments
    return []
  }
}

export async function getRagContext(userId: string, query: string): Promise<string> {
  const { context } = await getRagResult(userId, query)
  return context
}

export async function getRagResult(userId: string, query: string): Promise<RagResult> {
  try {
    // Run all three searches in parallel
    const [notes, chunks, figures] = await Promise.all([
      searchSimilarNotes(userId, query, 4, 0.55, true),
      searchSimilarChunks(userId, query, 4, 0.45, true),
      searchSimilarFigures(userId, query, 2, 0.20),
    ])

    const parts: string[] = []

    if (notes.length > 0) parts.push(buildRagContext(notes))

    if (chunks.length > 0) {
      const chunkSection = chunks.map(
        (c, i) =>
          `[Document ${i + 1} — ${c.filename}]: ${(c.windowContent ?? c.content).slice(0, 800)}`
      )
      parts.push(
        [
          '--- Relevant passages from uploaded documents ---',
          ...chunkSection,
          '--- End of documents ---',
        ].join('\n\n')
      )
    }

    // Figures are returned separately so callers can pass them as Gemini Vision images.
    // The context string includes captions for models that don't support vision.
    if (figures.length > 0) {
      const figCaptions = figures
        .filter(f => f.caption)
        .map((f, i) => `[Figure ${i + 1} — page ${f.pageIndex + 1}]: ${f.caption}`)
      if (figCaptions.length > 0) {
        parts.push(
          ['--- Relevant figures from uploaded documents ---', ...figCaptions, '--- End of figures ---'].join('\n\n')
        )
      }
    }

    return {
      context: parts.join('\n\n'),
      notesUsed: notes,
      chunksUsed: chunks,
      figuresUsed: figures,
      hydeUsed: true,
    }
  } catch {
    return { context: '', notesUsed: [], chunksUsed: [], figuresUsed: [], hydeUsed: false }
  }
}
