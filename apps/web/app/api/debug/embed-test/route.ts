import { NextRequest, NextResponse } from 'next/server'
import { generateEmbedding } from '@/lib/ai/embeddings'

const DEBUG_KEY = process.env['DEBUG_KEY'] ?? '979800'

/**
 * GET /api/debug/embed-test?key=979800
 *
 * Confirms BAAI/bge-base-en-v1.5 via HuggingFace Inference API is working.
 * Requires HF_TOKEN in Vercel env vars.
 *
 *   curl "https://cognibloom.vercel.app/api/debug/embed-test?key=979800"
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== DEBUG_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const t0 = Date.now()
  try {
    const embedding = await generateEmbedding(
      'The Pythagorean theorem: a² + b² = c²',
      'RETRIEVAL_QUERY',
    )
    return NextResponse.json({
      ok: true,
      model: 'BAAI/bge-base-en-v1.5',
      provider: 'HuggingFace Inference API',
      dims: embedding.length,
      firstFive: embedding.slice(0, 5),
      latencyMs: Date.now() - t0,
      env: { hasHfToken: !!process.env['HF_TOKEN'] || !!process.env['HUGGINGFACE_API_KEY'] },
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      model: 'BAAI/bge-base-en-v1.5',
      provider: 'HuggingFace Inference API',
      error: String(err),
      latencyMs: Date.now() - t0,
      env: { hasHfToken: !!process.env['HF_TOKEN'] || !!process.env['HUGGINGFACE_API_KEY'] },
    }, { status: 500 })
  }
}
