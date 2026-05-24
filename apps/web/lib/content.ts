/**
 * Shared content utilities — chunking, Wikipedia/arXiv fetching,
 * and the admin-level content ingestion pipeline.
 */
import { db } from '@/lib/db'
import { generateEmbedding, embeddingToSql } from '@/lib/ai/embeddings'
import { DANIEL_USER_ID } from '@/lib/user'

// ─── Text chunking ────────────────────────────────────────────────────��───────

/**
 * Sentence-window chunking: splits on sentence boundaries, groups into small
 * retrieval chunks, and stores a wider surrounding window for LLM context.
 */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10)
}

export interface ChunkWithWindow {
  content: string       // the retrieval chunk (embedded & matched)
  windowContent: string // wider surrounding context for the prompt
}

/**
 * Returns chunks with their surrounding sentence-window context.
 * childSize  = number of sentences per retrieval chunk (default 3)
 * windowSize = half-width of the surrounding context window in sentences (default 2)
 */
export function chunkTextWithWindows(
  text: string,
  childSize = 3,
  windowSize = 2,
): ChunkWithWindow[] {
  const sentences = splitIntoSentences(text)
  if (sentences.length === 0) return []

  const chunks: ChunkWithWindow[] = []
  for (let i = 0; i < sentences.length; i += childSize) {
    const childSentences = sentences.slice(i, i + childSize)
    const content = childSentences.join(' ').trim()
    if (content.length < 30) continue

    const winStart = Math.max(0, i - windowSize)
    const winEnd = Math.min(sentences.length, i + childSize + windowSize)
    const windowContent = sentences.slice(winStart, winEnd).join(' ').trim()
    chunks.push({ content, windowContent })
  }
  return chunks
}

/**
 * Simple flat chunking — returns retrieval-unit strings.
 * Sentence-window aware for shorter texts; fixed-size for longer ones.
 */
export function chunkText(text: string, chunkSize = 1500, overlap = 200): string[] {
  if (text.length < chunkSize * 2) {
    const withWindows = chunkTextWithWindows(text)
    if (withWindows.length > 0) return withWindows.map((c) => c.content)
  }

  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length)
    if (end < text.length) {
      const snippet = text.slice(end - 200, end)
      const lastPeriod = snippet.lastIndexOf('.')
      if (lastPeriod >= 0) end = end - 200 + lastPeriod + 1
    }
    chunks.push(text.slice(start, end).trim())
    start += chunkSize - overlap
  }
  return chunks.filter((c) => c.length > 50)
}

// ─── Wikipedia fetch ──────────────────────────────────────────────────────────

interface WikiSummary {
  title: string
  extract: string
  description: string
}

export async function fetchWikipediaSummary(title: string): Promise<WikiSummary | null> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CogniBloom/1.0 (educational AI platform; https://cognibloom.vercel.app)' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const data = await res.json() as { title?: string; extract?: string; description?: string }
    if (!data.extract) return null
    return {
      title: data.title ?? title,
      extract: data.extract,
      description: data.description ?? '',
    }
  } catch {
    return null
  }
}

// ─── arXiv fetch ──────────────────────────────────────────────────────────────

interface ArxivEntry {
  title: string
  summary: string
  authors: string[]
  published: string
  id: string
}

export async function fetchArxivPapers(
  categories: string[],
  limit = 10,
): Promise<ArxivEntry[]> {
  try {
    const catQuery = categories.map((c) => `cat:${c}`).join('+OR+')
    const url = `https://export.arxiv.org/api/query?search_query=${catQuery}&start=0&max_results=${limit}&sortBy=submittedDate&sortOrder=descending`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CogniBloom/1.0' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []

    const xml = await res.text()
    const entries: ArxivEntry[] = []

    // Simple XML extraction — no DOM parser needed for this structure
    const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)
    for (const match of entryMatches) {
      const entry = match[1]
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/)
      const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/)
      const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/)
      const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/)
      const authorMatches = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)]

      if (!titleMatch?.[1] || !summaryMatch?.[1]) continue

      entries.push({
        title: titleMatch[1].trim().replace(/\s+/g, ' '),
        summary: summaryMatch[1].trim().replace(/\s+/g, ' '),
        authors: authorMatches.map((m) => m[1].trim()).slice(0, 3),
        published: publishedMatch?.[1]?.trim() ?? '',
        id: idMatch?.[1]?.trim() ?? '',
      })
    }

    return entries
  } catch {
    return []
  }
}

// ─── Core ingestion pipeline ──────────────────────────────────────────────────

export interface IngestResult {
  title: string
  status: 'ingested' | 'skipped' | 'failed'
  chunks?: number
  reason?: string
}

/**
 * Ingest a single piece of educational content into the knowledge base.
 * Uses the r2Url field as a deduplication key — safe to call repeatedly.
 */
export async function ingestContent(
  r2UrlKey: string,
  filename: string,
  extractedText: string,
): Promise<IngestResult> {
  const title = filename.replace(/\.[^/.]+$/, '')

  // Dedup — skip if already ingested
  const existing = await db.upload.findFirst({ where: { r2Url: r2UrlKey } })
  if (existing) return { title, status: 'skipped', reason: 'already ingested' }

  if (!extractedText.trim()) return { title, status: 'failed', reason: 'empty content' }

  let upload: { id: string } | null = null
  try {
    upload = await db.upload.create({
      data: {
        userId: DANIEL_USER_ID,
        filename,
        mimeType: 'text/markdown',
        fileSize: extractedText.length,
        fileType: 'text',
        r2Url: r2UrlKey,
        status: 'processing',
        extractedText,
      },
    })

    const chunks = chunkText(extractedText)
    let embeddedCount = 0

    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await generateEmbedding(chunks[i], 'RETRIEVAL_DOCUMENT')
        const vectorStr = embeddingToSql(embedding)
        await db.$executeRaw`
          INSERT INTO "Chunk" ("id", "uploadId", "chunkIndex", "content")
          VALUES (gen_random_uuid()::text, ${upload.id}, ${i}, ${chunks[i]})
          ON CONFLICT ("uploadId", "chunkIndex") DO NOTHING
        `
        await db.$executeRaw`
          UPDATE "Chunk" SET embedding = ${vectorStr}::vector(768)
          WHERE "uploadId" = ${upload.id} AND "chunkIndex" = ${i}
        `
        embeddedCount++
      } catch {
        // Non-fatal: continue to next chunk
      }
    }

    await db.upload.update({ where: { id: upload.id }, data: { status: 'ready' } })
    return { title, status: 'ingested', chunks: embeddedCount }
  } catch (err) {
    if (upload) {
      await db.upload.update({ where: { id: upload.id }, data: { status: 'failed' } }).catch(() => {})
    }
    return { title, status: 'failed', reason: String(err) }
  }
}

// ─── K12 topic catalogue ──────────────────────────────────────────────────────

/** Wikipedia topics to ingest per source type. */
export const K12_TOPICS: Record<string, string[]> = {
  math: [
    'Algebra', 'Geometry', 'Calculus', 'Trigonometry', 'Statistics',
    'Fraction', 'Exponentiation', 'Logarithm', 'Quadratic equation',
    'Pythagorean theorem', 'Linear equation', 'Polynomial', 'Matrix (mathematics)',
    'Probability', 'Set theory',
  ],
  science: [
    'Photosynthesis', "Newton's laws of motion", 'Periodic table',
    'Cell (biology)', 'Genetics', 'Evolution', 'Thermodynamics',
    'Electromagnetism', 'Chemical bond', 'DNA', 'Atom', 'Ecosystem',
    'Human digestive system', 'Solar System', 'Plate tectonics',
  ],
  history: [
    'World War II', 'American Revolution', 'French Revolution', 'Cold War',
    'Renaissance', 'Industrial Revolution', 'Ancient Rome', 'Ancient Greece',
    'World War I', 'Colonialism', 'Civil rights movement',
  ],
  english: [
    'Grammar', 'William Shakespeare', 'Poetry', 'Narrative', 'Metaphor',
    'Literary device', 'Novel', 'Short story', 'Essay', 'Rhetoric',
  ],
  computing: [
    'Algorithm', 'Data structure', 'Object-oriented programming',
    'Recursion', 'Sorting algorithm', 'Binary number', 'Computer network',
    'Artificial intelligence', 'Machine learning', 'Cryptography',
  ],
}

export const ARXIV_CATEGORIES: Record<string, string[]> = {
  math: ['math.GM', 'math.ST', 'math.HO'],    // General Mathematics, Statistics, History & Overview
  cs: ['cs.AI', 'cs.LG', 'cs.DS'],             // AI, Machine Learning, Data Structures
}
