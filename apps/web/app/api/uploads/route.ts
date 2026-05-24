import { NextRequest, NextResponse, after } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { generateEmbedding, embeddingToSql } from '@/lib/ai/embeddings'
import { chunkTextWithWindows } from '@/lib/content'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ['application/pdf', 'text/plain', 'text/markdown']
export const maxDuration = 60

/**
 * Extract plain text from a PDF using Gemini vision.
 * This avoids all pdf-parse / pdfjs-dist / DOMMatrix / CJS bundler issues.
 */
// Retry + model fallback chain for PDF extraction.
// Pattern: the first call often gets a transient 503 but the same model
// works immediately on retry — so we retry the primary model once with a
// short delay before falling through to backup models.
const PDF_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
]

const PDF_PROMPT = `Extract ALL text from this document verbatim. Preserve headings, paragraphs, lists, tables, and numbered items. Include all math formulas, chemical equations, and captions exactly as written.
Output ONLY the extracted text — no commentary, no formatting instructions, no markdown wrappers.`

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function isTransientError(err: unknown): boolean {
  const msg = String(err)
  return msg.includes('503') || msg.includes('429') || msg.includes('overload') || msg.includes('unavailable')
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const apiKey = process.env['GOOGLE_API_KEY'] ?? process.env['GEMINI_API_KEY']
  if (!apiKey) throw new Error('No Google API key configured for PDF extraction.')

  const genAI = new GoogleGenerativeAI(apiKey)
  const inlineData = { mimeType: 'application/pdf' as const, data: buffer.toString('base64') }
  let lastError: unknown

  for (let m = 0; m < PDF_MODELS.length; m++) {
    const modelId = PDF_MODELS[m]
    // Each model gets up to 2 attempts: immediate + one retry after a short delay
    const attempts = m === 0 ? 2 : 1
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: modelId })
        const result = await model.generateContent([{ inlineData }, PDF_PROMPT])
        const text = result.response.text().trim()
        if (text) return text
      } catch (err) {
        if (!isTransientError(err)) throw err  // auth/quota errors bubble up immediately
        lastError = err
        if (attempt < attempts) {
          console.warn(`[extractPdfText] ${modelId} attempt ${attempt} failed (503/429), retrying in 1.5s...`)
          await sleep(1500)
        } else {
          console.warn(`[extractPdfText] ${modelId} exhausted, trying next model...`)
        }
      }
    }
  }

  throw lastError ?? new Error('All Gemini models failed for PDF extraction.')
}

// POST /api/uploads — accepts multipart form with a file
export async function POST(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const noteId = formData.get('noteId') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` },
        { status: 413 }
      )
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Allowed: PDF, TXT, MD' },
        { status: 415 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    let extractedText = ''

    if (file.type === 'application/pdf') {
      extractedText = await extractPdfText(buffer)
    } else {
      // TXT / Markdown — read directly
      extractedText = buffer.toString('utf-8')
    }

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: 'Could not extract text from file' },
        { status: 422 }
      )
    }

    // Persist the upload record
    const upload = await db.upload.create({
      data: {
        userId,
        noteId: noteId ?? undefined,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        fileType: file.type === 'application/pdf' ? 'pdf' : 'text',
        r2Url: `local://${Date.now()}_${file.name}`, // placeholder until R2 is wired
        status: 'processing',
        extractedText,
      },
    })

    // Chunk + embed asynchronously after the response is sent.
    // `after()` keeps this alive on Vercel without blocking the client.
    after(() => embedUpload(upload.id, extractedText))

    return NextResponse.json({
      success: true,
      data: {
        id: upload.id,
        filename: upload.filename,
        fileSize: upload.fileSize,
        status: 'processing',
        charsExtracted: extractedText.length,
      },
    })
  } catch (error) {
    console.error('[POST /api/uploads]', error)
    return NextResponse.json(
      { error: 'Upload failed: ' + String(error) },
      { status: 500 }
    )
  }
}

async function ensureChunkSchema() {
  // Idempotent DDL — ensures the windowContent column exists in production
  // regardless of whether the Prisma migration has been applied yet.
  await db.$executeRawUnsafe(
    `ALTER TABLE "Chunk" ADD COLUMN IF NOT EXISTS "windowContent" TEXT`
  )
}

async function embedUpload(uploadId: string, text: string) {
  try {
    // Self-heal schema before first INSERT — safe to run on every call
    await ensureChunkSchema()

    const chunks = chunkTextWithWindows(text)
    for (let i = 0; i < chunks.length; i++) {
      const { content, windowContent } = chunks[i]
      const embedding = await generateEmbedding(content, 'RETRIEVAL_DOCUMENT')
      const vectorStr = embeddingToSql(embedding)
      await db.$executeRaw`
        INSERT INTO "Chunk" ("id", "uploadId", "chunkIndex", "content", "windowContent")
        VALUES (gen_random_uuid()::text, ${uploadId}, ${i}, ${content}, ${windowContent})
        ON CONFLICT ("uploadId", "chunkIndex") DO UPDATE SET
          "content" = EXCLUDED."content",
          "windowContent" = EXCLUDED."windowContent"
      `
      await db.$executeRaw`
        UPDATE "Chunk" SET embedding = ${vectorStr}::vector(768)
        WHERE "uploadId" = ${uploadId} AND "chunkIndex" = ${i}
      `
    }
    await db.upload.update({ where: { id: uploadId }, data: { status: 'ready' } })
  } catch (err) {
    console.error('[embedUpload]', uploadId, err)
    await db.upload.update({ where: { id: uploadId }, data: { status: 'failed' } })
  }
}

// GET /api/uploads — list user's uploads
export async function GET() {
  try {
    const userId = DANIEL_USER_ID
    const uploads = await db.upload.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, filename: true, fileType: true, fileSize: true,
        status: true, createdAt: true, noteId: true,
        _count: { select: { chunks: true } },
      },
    })
    return NextResponse.json({ success: true, data: uploads })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/uploads?id=xxx — remove an upload and its chunks
export async function DELETE(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const upload = await db.upload.findFirst({ where: { id, userId } })
    if (!upload) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.upload.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
