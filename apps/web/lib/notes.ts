import { db } from '@/lib/db'
import { generateEmbedding, embeddingToSql } from '@/lib/ai/embeddings'

/**
 * Generates a 768-dim vector embedding for a note and persists it to the DB.
 *
 * Designed to run inside `next/server after()` so it executes after the HTTP
 * response is already delivered — keeping the serverless function alive until
 * the DB write completes without blocking the user-facing latency.
 */
export async function embedNote(noteId: string, title: string, content: string): Promise<void> {
  try {
    const text = `${title}\n\n${content}`
    const embedding = await generateEmbedding(text)
    const vectorStr = embeddingToSql(embedding)
    await db.$executeRaw`
      UPDATE "Note" SET embedding = ${vectorStr}::vector(768) WHERE id = ${noteId}
    `
  } catch {
    // Non-fatal — the note is still usable without an embedding.
  }
}
