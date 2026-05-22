import { db } from '@/lib/db'
import { generateEmbedding, embeddingToSql } from './embeddings'

export interface RagNote {
  id: string
  title: string
  content: string
  subject: string | null
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
      1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM "Note"
    WHERE "userId" = ${userId}
      AND embedding IS NOT NULL
      AND 1 - (embedding <=> ${vectorStr}::vector) > ${minSimilarity}
    ORDER BY embedding <=> ${vectorStr}::vector
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

export async function getRagContext(userId: string, query: string): Promise<string> {
  try {
    const notes = await searchSimilarNotes(userId, query)
    return buildRagContext(notes)
  } catch {
    // Fail silently — RAG is an enhancement, not a requirement
    return ''
  }
}
