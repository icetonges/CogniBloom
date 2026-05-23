import { db } from '@/lib/db'
import { generateEmbedding, embeddingToSql } from '@/lib/ai/embeddings'
import { buildNoteSlug } from '@/lib/note-format'

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

/**
 * Generate a unique slug for a new note.
 * Finds the current max subjectIndex for this subject, increments it.
 * Returns { slug, subjectIndex }.
 */
export async function generateUniqueNoteSlug(
  userId: string,
  subject: string | null | undefined,
  createdAt: Date,
): Promise<{ slug: string; subjectIndex: number }> {
  // Normalise subject for comparison: case-insensitive, trimmed
  const subjectTrimmed = subject?.trim() || null

  const maxResult = await db.note.aggregate({
    where: {
      userId,
      subject: subjectTrimmed
        ? { equals: subjectTrimmed, mode: 'insensitive' }
        : null,
    },
    _max: { subjectIndex: true },
  })

  const nextIndex = (maxResult._max.subjectIndex ?? 0) + 1
  const slug = buildNoteSlug(createdAt, subject, nextIndex)

  return { slug, subjectIndex: nextIndex }
}
