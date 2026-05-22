import { db } from '@/lib/db'
import { generateEmbedding, embeddingToSql } from './embeddings'

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
  filename: string
  similarity: number
}

export async function searchSimilarNotes(
  userId: string,
  query: string,
  limit = 4,
  minSimilarity = 0.65
): Promise<RagNote[]> {
  const embedding = await generateEmbedding(query)
  const vectorStr = embeddingToSql(embedding)

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
    LIMIT ${limit}
  `

  return results
}

export function buildRagContext(notes: RagNote[]): string {
  if (notes.length === 0) return ''

  const sections = notes.map((note, i) => {
    const preview = note.content.slice(0, 600)
    const ellipsis = note.content.length > 600 ? '…' : ''
    return `[Note ${i + 1}${note.subject ? ` — ${note.subject}` : ''}]: ${note.title}\n${preview}${ellipsis}`
  })

  return [
    '--- Relevant notes from the student\'s knowledge base ---',
    ...sections,
    '--- End of notes ---',
  ].join('\n\n')
}

export async function searchSimilarChunks(
  userId: string,
  query: string,
  limit = 3,
  minSimilarity = 0.60
): Promise<RagChunk[]> {
  const embedding = await generateEmbedding(query)
  const vectorStr = embeddingToSql(embedding)

  const results = await db.$queryRaw<Array<{ id: string; content: string; filename: string; similarity: number }>>`
    SELECT c.id, c.content, u.filename,
           1 - (c.embedding <=> ${vectorStr}::vector(768)) AS similarity
    FROM "Chunk" c
    JOIN "Upload" u ON u.id = c."uploadId"
    WHERE u."userId" = ${userId}
      AND c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> ${vectorStr}::vector(768)) > ${minSimilarity}
    ORDER BY c.embedding <=> ${vectorStr}::vector(768)
    LIMIT ${limit}
  `
  return results
}

export async function getRagContext(userId: string, query: string): Promise<string> {
  try {
    const [notes, chunks] = await Promise.all([
      searchSimilarNotes(userId, query),
      searchSimilarChunks(userId, query),
    ])

    const parts: string[] = []
    if (notes.length > 0) parts.push(buildRagContext(notes))
    if (chunks.length > 0) {
      const chunkSection = chunks.map((c, i) =>
        `[Document ${i + 1} — ${c.filename}]: ${c.content.slice(0, 500)}`
      )
      parts.push(['--- Relevant passages from uploaded documents ---', ...chunkSection, '--- End of documents ---'].join('\n\n'))
    }
    return parts.join('\n\n')
  } catch {
    return ''
  }
}
