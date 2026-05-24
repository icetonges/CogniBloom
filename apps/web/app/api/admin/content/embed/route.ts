import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateEmbedding, embeddingToSql } from '@/lib/ai/embeddings'
import { chunkTextWithWindows } from '@/lib/content'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function verifyAdmin(request: NextRequest): boolean {
  const secret = process.env['ADMIN_SECRET_KEY']
  if (!secret) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

// ─── POST /api/admin/content/embed ───────────────────────────────────────────
//
// Re-embeds all uploads that are stuck in 'processing' or have no chunks yet.
// Uses sentence-window chunking: stores both the retrieval chunk and its
// surrounding window context so the RAG pipeline can pass richer context to
// the LLM.

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find uploads that are still processing or have failed but have text
  const pending = await db.upload.findMany({
    where: {
      status: { in: ['processing', 'failed'] },
      extractedText: { not: null },
    },
    select: { id: true, extractedText: true, filename: true },
    take: 50, // Process max 50 at a time to stay within function timeout
    orderBy: { createdAt: 'asc' },
  })

  if (pending.length === 0) {
    return NextResponse.json({ success: true, message: 'Nothing to embed', processed: 0 })
  }

  let processed = 0
  let failed = 0

  for (const upload of pending) {
    if (!upload.extractedText) continue
    try {
      const chunks = chunkTextWithWindows(upload.extractedText)

      for (let i = 0; i < chunks.length; i++) {
        const { content, windowContent } = chunks[i]
        const embedding = await generateEmbedding(content, 'RETRIEVAL_DOCUMENT')
        const vectorStr = embeddingToSql(embedding)
        await db.$executeRaw`
          INSERT INTO "Chunk" ("id", "uploadId", "chunkIndex", "content", "windowContent")
          VALUES (gen_random_uuid()::text, ${upload.id}, ${i}, ${content}, ${windowContent})
          ON CONFLICT ("uploadId", "chunkIndex") DO UPDATE SET
            "content" = EXCLUDED."content",
            "windowContent" = EXCLUDED."windowContent"
        `
        await db.$executeRaw`
          UPDATE "Chunk" SET embedding = ${vectorStr}::vector(768)
          WHERE "uploadId" = ${upload.id} AND "chunkIndex" = ${i}
        `
      }

      await db.upload.update({ where: { id: upload.id }, data: { status: 'ready' } })
      processed++
    } catch (err) {
      console.error('[admin/content/embed]', upload.filename, err)
      await db.upload.update({ where: { id: upload.id }, data: { status: 'failed' } }).catch(() => {})
      failed++
    }
  }

  return NextResponse.json({
    success: true,
    processed,
    failed,
    total: pending.length,
  })
}

// ─── GET /api/admin/content/embed ────────────────────────────────────────────
//
// Returns a count of uploads awaiting embedding — useful for monitoring.

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [processing, ready, failed, total] = await Promise.all([
    db.upload.count({ where: { status: 'processing' } }),
    db.upload.count({ where: { status: 'ready' } }),
    db.upload.count({ where: { status: 'failed' } }),
    db.upload.count(),
  ])

  return NextResponse.json({
    success: true,
    data: { processing, ready, failed, total },
  })
}
