import { NextRequest, NextResponse } from 'next/server'
import { generateEmbedding } from '@/lib/ai/embeddings'

const DEBUG_KEY = process.env['DEBUG_KEY'] ?? '979800'

/**
 * GET /api/debug/embed-test?key=979800
 *
 * Calls generateEmbedding() directly and returns the result or the exact error.
 * Use this to confirm embedding-001 works end-to-end on Vercel:
 *
 *   Invoke-WebRequest -Uri "https://cognibloom.vercel.app/api/debug/embed-test?key=979800" |
 *     Select-Object -ExpandProperty Content
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== DEBUG_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const t0 = Date.now()
  try {
    const testText = 'The Pythagorean theorem: a² + b² = c²'
    const embedding = await generateEmbedding(testText, 'RETRIEVAL_QUERY')
    const latencyMs = Date.now() - t0

    return NextResponse.json({
      ok: true,
      model: 'embedding-001',
      dims: embedding.length,
      firstFive: embedding.slice(0, 5),
      latencyMs,
      env: {
        hasGoogleKey: !!process.env['GOOGLE_API_KEY'],
        hasGeminiKey: !!process.env['GEMINI_API_KEY'],
      },
    })
  } catch (err) {
    const latencyMs = Date.now() - t0
    return NextResponse.json({
      ok: false,
      error: String(err),
      latencyMs,
      env: {
        hasGoogleKey: !!process.env['GOOGLE_API_KEY'],
        hasGeminiKey: !!process.env['GEMINI_API_KEY'],
      },
    }, { status: 500 })
  }
}
