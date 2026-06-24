import { NextRequest, NextResponse, after } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { generateEmbeddings, embeddingToSql } from '@/lib/ai/embeddings'
import { embedImage, clipEmbeddingToSql } from '@/lib/ai/visual-embeddings'
import { renderPdfPages, pageHasFigures } from '@/lib/pdf-renderer'
import { MODELS } from '@/lib/ai/models'
import { chunkTextWithWindows } from '@/lib/content'

// Vercel serverless functions enforce a 4.5 MB request-body limit at infrastructure level.
// The client validates before upload; this is the server-side safety net.
const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4 MB
const ALLOWED_TYPES = ['application/pdf', 'text/plain', 'text/markdown']
// 300 s covers Gemini extraction + background embedding on Vercel Pro.
// after() callbacks also run within this budget.
export const maxDuration = 300

/**
 * Extract plain text from a PDF using Gemini vision.
 * This avoids all pdf-parse / pdfjs-dist / DOMMatrix / CJS bundler issues.
 */
// PDF extraction needs native PDF input, so only use Gemini models from the
// central registry. Llama and Claude remain in the chat fallback chain, but
// they do not receive raw PDF bytes here.
const PDF_MODEL_PRIORITY = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro']
const PDF_MODELS = PDF_MODEL_PRIORITY.filter((modelId) =>
  MODELS.some((model) => model.id === modelId && model.provider === 'google' && model.supportsVision)
)

const PDF_PROMPT = `You are processing an educational document for a RAG (retrieval-augmented generation) system. Students will ask questions about this content, so completeness is critical.

For each page, output the content in reading order:

1. TEXT: Extract every word verbatim — questions, answer choices, headings, paragraphs, formulas, equations, captions, labels, numbers, units. Do not paraphrase.

2. FIGURES: For EVERY diagram, shape, chart, graph, table, or image — no matter how small — write a detailed description immediately at the location where it appears in the text. Wrap it in [FIGURE: ...] tags. Include:
   - Exact shape(s) and their spatial arrangement
   - All labeled dimensions, measurements, and units (e.g. "10 m wide, 8 m tall")
   - Shaded, colored, or highlighted regions and precisely what they represent
   - All numbers, tick marks, axes, legends, arrows
   - How the figure relates to the surrounding question or text
   Example: [FIGURE: A rectangle 10m wide and 8m tall. A 1-meter-wide shaded border runs along the inside of all four edges, forming a frame. The unshaded inner rectangle is 8m×6m. The shaded border represents the area within 1 meter of any edge.]

Output ONLY the extracted content with inline [FIGURE: ...] descriptions. No meta-commentary, no markdown fences, no instructions.`

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function isTransientError(err: unknown): boolean {
  const msg = String(err)
  return msg.includes('503') || msg.includes('429') || msg.includes('overload') || msg.includes('unavailable')
}

function isModelUnavailableError(err: unknown): boolean {
  const msg = String(err).toLowerCase()
  return msg.includes('404') || msg.includes('not found') || msg.includes('no longer available')
}

export interface PageContent {
  pageIndex: number   // 0-based
  text: string        // extracted text + inline [FIGURE: ...] descriptions
}

/**
 * Extract text + figure descriptions from a PDF using Gemini Vision.
 * Sends the whole PDF at once (Gemini handles multi-page natively).
 * Also asks for page markers so we can track which chunk came from which page.
 */
async function extractPdfPages(buffer: Buffer): Promise<PageContent[]> {
  const apiKey = process.env['GOOGLE_API_KEY'] ?? process.env['GEMINI_API_KEY']
  if (!apiKey) throw new Error('No Google API key configured for PDF extraction.')

  const genAI = new GoogleGenerativeAI(apiKey)
  const inlineData = { mimeType: 'application/pdf' as const, data: buffer.toString('base64') }

  // Page-aware prompt: Gemini outputs ===PAGE N=== markers between pages
  const pagedPrompt = PDF_PROMPT + `

IMPORTANT: Before the content of each page, output a marker exactly like this:
===PAGE 1===
===PAGE 2===
(use the actual page number, starting from 1)`

  let lastError: unknown
  for (let m = 0; m < PDF_MODELS.length; m++) {
    const modelId = PDF_MODELS[m]
    const attempts = m === 0 ? 2 : 1
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: modelId })
        const result = await model.generateContent([{ inlineData }, pagedPrompt])
        const raw = result.response.text().trim()
        if (!raw) continue
        return parsePagedOutput(raw)
      } catch (err) {
        if (isModelUnavailableError(err)) {
          lastError = err
          console.warn(`[extractPdfPages] ${modelId} unavailable, trying next...`)
          break
        }
        if (!isTransientError(err)) throw err
        lastError = err
        if (attempt < attempts) {
          console.warn(`[extractPdfPages] ${modelId} attempt ${attempt} failed, retrying in 1.5s...`)
          await sleep(1500)
        }
      }
    }
  }
  throw lastError ?? new Error('All Gemini models failed for PDF extraction.')
}

/** Parse Gemini output with ===PAGE N=== markers into PageContent[]. */
function parsePagedOutput(raw: string): PageContent[] {
  const segments = raw.split(/^===PAGE \d+===/m).filter(s => s.trim())
  const markers = [...raw.matchAll(/^===PAGE (\d+)===/gm)]

  if (markers.length === 0) {
    return [{ pageIndex: 0, text: raw.trim() }]
  }

  return segments.map((text, i) => ({
    pageIndex: i,
    text: text.trim(),
  })).filter(p => p.text.length > 0)
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
    let pages: PageContent[] = []
    let extractedText = ''

    if (file.type === 'application/pdf') {
      pages = await extractPdfPages(buffer)
      extractedText = pages.map(p => p.text).join('\n\n')
    } else {
      // TXT / Markdown — treat as single page
      extractedText = buffer.toString('utf-8')
      pages = [{ pageIndex: 0, text: extractedText }]
    }

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: 'Could not extract text from file' },
        { status: 422 }
      )
    }

    // Persist the upload record immediately — embedding happens in background
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
        extractedMetadata: { pageCount: pages.length },
      },
    })

    // Run chunking + embedding AFTER the HTTP response is sent.
    // after() callbacks still respect maxDuration (300 s above) — no timeout risk.
    // Errors are persisted to the DB (status: 'failed') so the uploads list can
    // surface them without needing to stay in the request window.
    const isPdf = file.type === 'application/pdf'
    after(async () => {
      await embedUpload(upload.id, pages)
      if (isPdf) {
        await embedFigures(upload.id, buffer, pages)
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        id: upload.id,
        filename: upload.filename,
        fileSize: upload.fileSize,
        // Embedding is async — the actual status will become 'ready' or 'failed'
        // once the background job completes. The uploads list polls GET /api/uploads.
        status: 'processing',
        charsExtracted: extractedText.length,
        pageCount: pages.length,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/uploads]', error)
    return NextResponse.json(
      { error: 'Upload failed: ' + String(error) },
      { status: 500 }
    )
  }
}

async function ensureChunkSchema() {
  // Idempotent DDL — self-heals the production DB schema regardless of
  // whether the Prisma migration has been applied.

  // 1. windowContent column (sentence-window context)
  await db.$executeRawUnsafe(
    `ALTER TABLE "Chunk" ADD COLUMN IF NOT EXISTS "windowContent" TEXT`
  )

  // 2. Unique constraint required by ON CONFLICT ("uploadId", "chunkIndex").
  //    Prisma defines @@unique([uploadId, chunkIndex]) but if the migration
  //    was never applied the constraint is absent and every INSERT throws
  //    "there is no unique or exclusion constraint matching the ON CONFLICT".
  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Chunk_uploadId_chunkIndex_key"
    ON "Chunk"("uploadId", "chunkIndex")
  `)
}

interface EmbedResult {
  chunksEmbedded: number
  chunksTotal: number
  error?: string
}

async function embedUpload(uploadId: string, pages: PageContent[]): Promise<EmbedResult> {
  try {
    // Self-heal schema before first INSERT — safe to run on every call
    await ensureChunkSchema()

    // Build flat chunk list, each chunk tagged with its source page index
    const allChunks: Array<{ content: string; windowContent: string | undefined; pageIndex: number }> = []
    for (const page of pages) {
      const pageChunks = chunkTextWithWindows(page.text)
      for (const c of pageChunks) {
        allChunks.push({ content: c.content, windowContent: c.windowContent, pageIndex: page.pageIndex })
      }
    }

    console.log(`[embedUpload] ${uploadId}: ${allChunks.length} chunks across ${pages.length} pages`)

    if (allChunks.length === 0) {
      const msg = `chunkTextWithWindows produced 0 chunks — total text length=${pages.map(p => p.text).join('').length}`
      console.warn(`[embedUpload] ${uploadId}: ${msg}`)
      await db.upload.update({ where: { id: uploadId }, data: { status: 'failed' } })
      return { chunksEmbedded: 0, chunksTotal: 0, error: msg }
    }

    // Batch-embed all chunks in one/few HF API calls (vs N sequential calls)
    let embeddings: number[][]
    try {
      embeddings = await generateEmbeddings(
        allChunks.map((c) => c.content),
        'RETRIEVAL_DOCUMENT',
      )
    } catch (batchErr) {
      const msg = `Batch embedding failed: ${String(batchErr)}`
      await db.upload.update({ where: { id: uploadId }, data: { status: 'failed' } })
      return { chunksEmbedded: 0, chunksTotal: allChunks.length, error: msg }
    }

    let embeddedCount = 0
    let firstError: string | undefined
    const { randomUUID } = await import('crypto')

    for (let i = 0; i < allChunks.length; i++) {
      const { content, windowContent, pageIndex } = allChunks[i]!
      const embedding = embeddings[i]
      if (!embedding) continue

      try {
        const vectorStr = embeddingToSql(embedding)
        const chunkId = randomUUID()
        await db.$executeRaw`
          INSERT INTO "Chunk" ("id", "uploadId", "chunkIndex", "content", "windowContent", "startPage", "endPage")
          VALUES (${chunkId}, ${uploadId}, ${i}, ${content}, ${windowContent ?? null}, ${pageIndex}, ${pageIndex})
          ON CONFLICT ("uploadId", "chunkIndex") DO UPDATE SET
            "content" = EXCLUDED."content",
            "windowContent" = EXCLUDED."windowContent",
            "startPage" = EXCLUDED."startPage",
            "endPage" = EXCLUDED."endPage"
        `
        await db.$executeRaw`
          UPDATE "Chunk" SET embedding = ${vectorStr}::vector(768)
          WHERE "uploadId" = ${uploadId} AND "chunkIndex" = ${i}
        `
        embeddedCount++
      } catch (chunkErr) {
        console.error(`[embedUpload] chunk ${i} failed for upload ${uploadId}:`, chunkErr)
        if (!firstError) firstError = `chunk ${i}: ${String(chunkErr)}`
      }
    }

    if (embeddedCount === 0) {
      const msg = `All ${allChunks.length} chunks failed to embed. First error: ${firstError}`
      await db.upload.update({ where: { id: uploadId }, data: { status: 'failed' } })
      return { chunksEmbedded: 0, chunksTotal: allChunks.length, error: msg }
    }

    console.log(`[embedUpload] ${uploadId}: ${embeddedCount}/${allChunks.length} chunks embedded`)
    await db.upload.update({ where: { id: uploadId }, data: { status: 'ready' } })
    return { chunksEmbedded: embeddedCount, chunksTotal: allChunks.length, error: firstError }
  } catch (err) {
    const msg = String(err)
    console.error('[embedUpload]', uploadId, err)
    await db.upload.update({ where: { id: uploadId }, data: { status: 'failed' } }).catch(() => null)
    return { chunksEmbedded: 0, chunksTotal: 0, error: msg }
  }
}

/** Render figure-containing PDF pages to PNG, CLIP-embed them, store in FigureEmbedding table. */
async function embedFigures(
  uploadId: string,
  pdfBuffer: Buffer,
  pages: PageContent[],
): Promise<{ embedded: number; error?: string }> {
  try {
    // Only process pages that Gemini marked as having figures
    const figurePageIndices = new Set(
      pages
        .filter(p => pageHasFigures(p.text))
        .map(p => p.pageIndex)
    )

    if (figurePageIndices.size === 0) {
      return { embedded: 0 }
    }

    // Render all pages to PNG using MuPDF WASM
    const renderedPages = await renderPdfPages(pdfBuffer)

    // Self-heal: ensure FigureEmbedding table + vector column exist
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "FigureEmbedding" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "uploadId" TEXT NOT NULL,
        "pageIndex" INTEGER NOT NULL,
        "imageBase64" TEXT NOT NULL,
        "caption" TEXT,
        "width" INTEGER,
        "height" INTEGER,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await db.$executeRawUnsafe(`
      ALTER TABLE "FigureEmbedding" ADD COLUMN IF NOT EXISTS "embedding" vector(512)
    `)

    let embedded = 0
    let firstError: string | undefined

    for (const rendered of renderedPages) {
      if (!figurePageIndices.has(rendered.pageIndex)) continue

      try {
        const clipVector = await embedImage(rendered.png)
        const vectorStr = clipEmbeddingToSql(clipVector)
        const caption = pages.find(p => p.pageIndex === rendered.pageIndex)?.text
          .match(/\[FIGURE:[^\]]+\]/gi)?.join('\n') ?? null

        const { randomUUID } = await import('crypto')
        const id = randomUUID()

        await db.$executeRaw`
          INSERT INTO "FigureEmbedding"
            ("id", "uploadId", "pageIndex", "imageBase64", "caption", "width", "height")
          VALUES
            (${id}, ${uploadId}, ${rendered.pageIndex}, ${rendered.base64},
             ${caption}, ${rendered.width}, ${rendered.height})
          ON CONFLICT DO NOTHING
        `
        await db.$executeRaw`
          UPDATE "FigureEmbedding"
          SET embedding = ${vectorStr}::vector(512)
          WHERE "id" = ${id}
        `
        embedded++
      } catch (err) {
        if (!firstError) firstError = `page ${rendered.pageIndex}: ${String(err)}`
        console.error(`[embedFigures] page ${rendered.pageIndex} failed:`, err)
      }
    }

    return { embedded, error: firstError }
  } catch (err) {
    return { embedded: 0, error: String(err) }
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
