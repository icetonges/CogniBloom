import { NextRequest, NextResponse, after } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { generateEmbedding, embeddingToSql } from '@/lib/ai/embeddings'
import { chunkText } from '@/lib/content'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ['application/pdf', 'text/plain', 'text/markdown']
export const maxDuration = 60

// POST /api/uploads — accepts multipart form with a file
export async function POST(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const noteId = formData.get('noteId') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` }, { status: 413 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Allowed: PDF, TXT, MD' }, { status: 415 })
    }

    // Extract text
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    let extractedText = ''

    if (file.type === 'application/pdf') {
      // pdf-parse is CJS — dynamic import returns the module object; the actual
      // callable may sit on .default or directly on the module export.
      type PdfParseFn = (buf: Buffer) => Promise<{ text: string }>
      const pdfMod = await import('pdf-parse')
      const pdfParse = ((pdfMod as unknown as { default?: PdfParseFn }).default ?? pdfMod) as PdfParseFn
      const parsed = await pdfParse(buffer)
      extractedText = parsed.text
    } else {
      extractedText = buffer.toString('utf-8')
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ error: 'Could not extract text from file' }, { status: 422 })
    }

    // Create Upload record (no R2 for now — store extracted text directly)
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

    // Chunk and embed after the response. On Vercel, `after()` keeps this work
    // attached to the request lifecycle instead of dropping it when the response ends.
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
    return NextResponse.json({ error: 'Upload failed: ' + String(error) }, { status: 500 })
  }
}

async function embedUpload(uploadId: string, text: string) {
  try {
    const chunks = chunkText(text)
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateEmbedding(chunks[i])
      const vectorStr = embeddingToSql(embedding)
      await db.$executeRaw`
        INSERT INTO "Chunk" ("id", "uploadId", "chunkIndex", "content")
        VALUES (gen_random_uuid()::text, ${uploadId}, ${i}, ${chunks[i]})
        ON CONFLICT ("uploadId", "chunkIndex") DO NOTHING
      `
      // Store embedding via raw update (Unsupported type)
      await db.$executeRaw`
        UPDATE "Chunk" SET embedding = ${vectorStr}::vector(768)
        WHERE "uploadId" = ${uploadId} AND "chunkIndex" = ${i}
      `
    }
    await db.upload.update({ where: { id: uploadId }, data: { status: 'ready' } })
  } catch {
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

    // Chunks cascade-delete via FK
    await db.upload.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
