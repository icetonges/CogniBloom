/**
 * Shared content utilities — chunking, Wikipedia/arXiv fetching,
 * and the admin-level content ingestion pipeline.
 */
import { db } from '@/lib/db'
import { generateEmbedding, embeddingToSql } from '@/lib/ai/embeddings'
import { DANIEL_USER_ID } from '@/lib/user'

// ─── Text chunking ─────────────────────────────────────────────────────────────

/**
 * Strip markdown / rich-text formatting from a block of text and return
 * a clean prose string suitable for embedding.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')          // fenced code blocks
    .replace(/`[^`\n]+`/g, '')               // inline code
    .replace(/^#{1,6}\s+/gm, '')             // ATX headings → plain text
    .replace(/^\s*[-*+]\s+/gm, '')           // unordered list markers
    .replace(/^\s*\d+\.\s+/gm, '')           // ordered list markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')  // images → drop
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')// bold / italic → text
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')  // underscore bold/italic
    .replace(/~~([^~]+)~~/g, '$1')           // strikethrough
    .replace(/^\s*>\s+/gm, '')               // blockquotes
    .replace(/^\s*[-_*]{3,}\s*$/gm, '')      // horizontal rules
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Split a block of clean prose (post-stripMarkdown) into logical units:
 * paragraphs → sentences → falls back to raw paragraphs if no sentence
 * boundaries are found. Handles academic PDFs, markdown notes, and
 * multi-line bullet text uniformly.
 */
function splitIntoUnits(text: string): string[] {
  const units: string[] = []

  // Split on blank lines first → paragraph-level units
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter((p) => p.length > 5)

  for (const para of paragraphs) {
    // Attempt sentence-level splitting.
    // Pattern: sentence end (. ! ?) followed by whitespace + capital letter,
    // digit, or closing quote — covers most academic and conversational prose.
    const sentenceRe = /(?<=[.!?])\s+(?=[A-Z\d"'(])/g
    const parts = para.split(sentenceRe).map((s) => s.trim()).filter((s) => s.length > 5)

    if (parts.length >= 2) {
      units.push(...parts)
    } else {
      // No sentence breaks — keep the paragraph as one unit (handles bullet
      // text, headers, single-sentence paragraphs, etc.)
      units.push(para)
    }
  }

  return units
}

export interface ChunkWithWindow {
  content: string       // the retrieval chunk (embedded & matched)
  windowContent: string // wider surrounding context for the prompt
}

/**
 * Sentence-window chunking — the core indexing technique from the notebooks.
 *
 * Each retrieval chunk contains `childSize` logical units (sentences or
 * paragraphs). The window stored alongside it extends `windowSize` units
 * in each direction so the LLM always sees richer context at query time.
 *
 * Works on plain text, markdown, and PDF-extracted prose.
 *
 * @param text        Raw extracted text (any format).
 * @param childSize   Units per retrieval chunk (default 3 — matches L3 notebook).
 * @param windowSize  Extra units of context on each side (default 3).
 * @param minLength   Minimum characters for a chunk to be included.
 */
export function chunkTextWithWindows(
  text: string,
  childSize = 3,
  windowSize = 3,
  minLength = 20,
): ChunkWithWindow[] {
  const clean = stripMarkdown(text)
  if (clean.length < minLength) return []

  const units = splitIntoUnits(clean)
  if (units.length === 0) return []

  // Adaptive child size: never require more sentences than we actually have.
  // This fixes the "0 chunks for short markdown" bug.
  const effectiveChild = Math.min(childSize, Math.max(1, Math.ceil(units.length / 3)))

  const chunks: ChunkWithWindow[] = []

  for (let i = 0; i < units.length; i += effectiveChild) {
    const childUnits = units.slice(i, i + effectiveChild)
    const content = childUnits.join(' ').trim()
    if (content.length < minLength) continue

    const winStart = Math.max(0, i - windowSize)
    const winEnd = Math.min(units.length, i + effectiveChild + windowSize)
    const windowContent = units.slice(winStart, winEnd).join(' ').trim()

    chunks.push({ content, windowContent })
  }

  return chunks
}

/**
 * Simple flat chunking — returns retrieval-unit strings.
 * Uses sentence-window chunking for shorter texts; character-window for longer.
 */
export function chunkText(text: string, chunkSize = 1500, overlap = 200): string[] {
  const withWindows = chunkTextWithWindows(text)
  if (withWindows.length > 0) return withWindows.map((c) => c.content)

  // Fallback: character-based sliding window
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length)
    if (end < text.length) {
      const snippet = text.slice(end - 200, end)
      const lastPeriod = snippet.lastIndexOf('.')
      if (lastPeriod >= 0) end = end - 200 + lastPeriod + 1
    }
    const chunk = text.slice(start, end).trim()
    if (chunk.length > 50) chunks.push(chunk)
    start += chunkSize - overlap
  }
  return chunks
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

    const chunks = chunkTextWithWindows(extractedText)
    let embeddedCount = 0

    for (let i = 0; i < chunks.length; i++) {
      try {
        const { content } = chunks[i]
        const embedding = await generateEmbedding(content, 'RETRIEVAL_DOCUMENT')
        const vectorStr = embeddingToSql(embedding)
        await db.$executeRaw`
          INSERT INTO "Chunk" ("id", "uploadId", "chunkIndex", "content")
          VALUES (gen_random_uuid()::text, ${upload.id}, ${i}, ${content})
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
  math: ['math.GM', 'math.ST', 'math.HO'],
  cs: ['cs.AI', 'cs.LG', 'cs.DS'],
}
