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

// ─── Ensure schema is up to date ──────────────────────────────────────────────
// Runs idempotent DDL so this endpoint works even if the Prisma migration
// hasn't been applied to the production database yet.

async function ensureSchema() {
  // windowContent column
  await db.$executeRawUnsafe(
    `ALTER TABLE "Chunk" ADD COLUMN IF NOT EXISTS "windowContent" TEXT`
  )

  // Unique constraint required for ON CONFLICT — may be missing if migration never ran
  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Chunk_uploadId_chunkIndex_key"
    ON "Chunk"("uploadId", "chunkIndex")
  `)
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RagEvaluation" (
      "id"               TEXT NOT NULL,
      "userId"           TEXT NOT NULL,
      "sessionId"        TEXT NOT NULL,
      "query"            TEXT NOT NULL,
      "response"         TEXT NOT NULL,
      "faithfulness"     DOUBLE PRECISION,
      "answerRelevancy"  DOUBLE PRECISION,
      "contextPrecision" DOUBLE PRECISION,
      "ragUsed"          BOOLEAN NOT NULL DEFAULT false,
      "notesRetrieved"   INTEGER NOT NULL DEFAULT 0,
      "chunksRetrieved"  INTEGER NOT NULL DEFAULT 0,
      "hydeUsed"         BOOLEAN NOT NULL DEFAULT false,
      "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "RagEvaluation_pkey" PRIMARY KEY ("id")
    )
  `)
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "RagEvaluation_userId_idx" ON "RagEvaluation"("userId")`
  )
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "RagEvaluation_sessionId_idx" ON "RagEvaluation"("sessionId")`
  )
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "RagEvaluation_createdAt_idx" ON "RagEvaluation"("createdAt")`
  )
}

// ─── POST /api/admin/content/embed ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Ensure windowContent column and RagEvaluation table exist before any inserts
  try {
    await ensureSchema()
  } catch (schemaErr) {
    console.error('[admin/content/embed] schema migration failed', schemaErr)
    return NextResponse.json({ error: 'Schema migration failed: ' + String(schemaErr) }, { status: 500 })
  }

  const pending = await db.upload.findMany({
    where: {
      status: { in: ['processing', 'failed'] },
      extractedText: { not: null },
    },
    select: { id: true, extractedText: true, filename: true },
    take: 50,
    orderBy: { createdAt: 'asc' },
  })

  if (pending.length === 0) {
    return NextResponse.json({ success: true, message: 'Nothing to embed', processed: 0 })
  }

  let processed = 0
  let failed = 0
  const errors: string[] = []

  for (const upload of pending) {
    if (!upload.extractedText) continue
    try {
      const chunks = chunkTextWithWindows(upload.extractedText)
      console.log(`[admin/embed] ${upload.filename}: ${chunks.length} chunks`)

      if (chunks.length === 0) {
        errors.push(`${upload.filename}: chunkTextWithWindows produced 0 chunks`)
        await db.upload.update({ where: { id: upload.id }, data: { status: 'failed' } }).catch(() => {})
        failed++
        continue
      }

      // Delete any stale chunks first (clean re-embed)
      await db.$executeRaw`DELETE FROM "Chunk" WHERE "uploadId" = ${upload.id}`

      let embeddedCount = 0
      for (let i = 0; i < chunks.length; i++) {
        const { content, windowContent } = chunks[i]
        try {
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
          embeddedCount++
        } catch (chunkErr) {
          console.error(`[admin/embed] chunk ${i} failed for ${upload.filename}:`, chunkErr)
        }
      }

      if (embeddedCount === 0) throw new Error(`All ${chunks.length} chunk inserts failed`)

      await db.upload.update({ where: { id: upload.id }, data: { status: 'ready' } })
      console.log(`[admin/embed] ${upload.filename}: ${embeddedCount}/${chunks.length} chunks done`)
      processed++
    } catch (err) {
      const msg = `${upload.filename}: ${String(err)}`
      console.error('[admin/content/embed]', msg)
      errors.push(msg)
      await db.upload.update({ where: { id: upload.id }, data: { status: 'failed' } }).catch(() => {})
      failed++
    }
  }

  return NextResponse.json({
    success: true,
    processed,
    failed,
    total: pending.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}

// ─── GET /api/admin/content/embed ────────────────────────────────────────────

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
