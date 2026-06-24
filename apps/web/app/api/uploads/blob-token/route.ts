import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/uploads/blob-token
 *
 * Generates a signed Vercel Blob upload token so the browser can upload
 * large files (>4 MB) directly to Blob storage — bypassing the 4.5 MB
 * serverless-function request-body limit enforced by Vercel's infrastructure.
 *
 * After the browser completes the direct upload, it calls POST /api/uploads
 * with { blobUrl, filename, fileSize } to trigger extraction + embedding.
 *
 * Requires: BLOB_READ_WRITE_TOKEN env var (set in Vercel dashboard → Storage → Blob)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!process.env['BLOB_READ_WRITE_TOKEN']) {
    return NextResponse.json(
      { error: 'Vercel Blob is not configured. Add BLOB_READ_WRITE_TOKEN to env vars.' },
      { status: 503 }
    )
  }

  try {
    const body = (await request.json()) as HandleUploadBody

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['application/pdf', 'text/plain', 'text/markdown'],
        maximumSizeInBytes: 50 * 1024 * 1024, // 50 MB — Vercel Blob handles this
      }),
      onUploadCompleted: async ({ blob }) => {
        // Nothing to do here — the client will call POST /api/uploads with the URL
        console.log('[blob-token] Upload completed:', blob.url)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (err) {
    console.error('[blob-token]', err)
    return NextResponse.json({ error: String(err) }, { status: 400 })
  }
}
