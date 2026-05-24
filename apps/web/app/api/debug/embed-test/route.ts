import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const DEBUG_KEY = process.env['DEBUG_KEY'] ?? '979800'

const MODELS_TO_TRY = [
  'text-embedding-004',
  'text-embedding-005',
  'embedding-001',
  'gemini-embedding-exp-03-07',
]

async function tryEmbed(
  apiKey: string,
  modelId: string,
): Promise<{ ok: true; dims: number; latencyMs: number } | { ok: false; error: string; latencyMs: number }> {
  const t0 = Date.now()
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: modelId })
    const result = await model.embedContent({
      content: { role: 'user', parts: [{ text: 'test embedding' }] },
    })
    const dims = result.embedding.values?.length ?? 0
    return { ok: true, dims, latencyMs: Date.now() - t0 }
  } catch (err) {
    return { ok: false, error: String(err), latencyMs: Date.now() - t0 }
  }
}

/**
 * GET /api/debug/embed-test?key=979800
 *
 * Tests every embedding model with both API keys.
 * The "working" array in the response shows exactly which combination works.
 *
 *   curl "https://cognibloom.vercel.app/api/debug/embed-test?key=979800"
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== DEBUG_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const googleKey = process.env['GOOGLE_API_KEY'] ?? ''
  const geminiKey = process.env['GEMINI_API_KEY'] ?? ''

  const keysToTest: Array<{ label: string; key: string }> = []
  if (googleKey) keysToTest.push({ label: 'GOOGLE_API_KEY', key: googleKey })
  if (geminiKey && geminiKey !== googleKey) keysToTest.push({ label: 'GEMINI_API_KEY', key: geminiKey })

  // Run all tests
  type TestResult = { ok: true; dims: number; latencyMs: number } | { ok: false; error: string; latencyMs: number }
  const allResults: Record<string, Record<string, TestResult>> = {}
  const working: string[] = []

  for (const { label, key } of keysToTest) {
    allResults[label] = {}
    for (const modelId of MODELS_TO_TRY) {
      const result = await tryEmbed(key, modelId)
      allResults[label][modelId] = result
      if (result.ok) working.push(`${label} + ${modelId} (${result.dims} dims)`)
    }
  }

  return NextResponse.json({
    env: {
      hasGoogleKey: !!googleKey,
      hasGeminiKey: !!geminiKey,
      sameKey: googleKey === geminiKey,
      googleKeyPrefix: googleKey ? googleKey.slice(0, 8) + '...' : null,
      geminiKeyPrefix: geminiKey ? geminiKey.slice(0, 8) + '...' : null,
    },
    working,                // ← look here first: which combos work
    results: allResults,    // ← full detail per key per model
  })
}
