/**
 * Standalone embedding API test — run with:
 *   node test-embedding.mjs
 *
 * Tests the Google text-embedding-004 v1 REST endpoint directly.
 * This is the exact same call path used by apps/web/lib/ai/embeddings.ts
 * Set GOOGLE_API_KEY or GEMINI_API_KEY in your env before running.
 */

const EMBEDDING_MODEL = 'text-embedding-004'
const EMBEDDING_DIMS = 768
const GEMINI_V1_BASE = 'https://generativelanguage.googleapis.com/v1'

async function testEmbedding() {
  const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('❌ No API key found. Set GOOGLE_API_KEY or GEMINI_API_KEY in your environment.')
    console.error('   Example: $env:GOOGLE_API_KEY="AIza..." ; node test-embedding.mjs')
    process.exit(1)
  }

  console.log('🔑 API key found:', apiKey.slice(0, 8) + '...')
  console.log('📡 Calling v1 REST endpoint...')

  const url = `${GEMINI_V1_BASE}/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`
  const testText = 'The Pythagorean theorem states that a squared plus b squared equals c squared.'

  const t0 = Date.now()
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: {
        role: 'user',
        parts: [{ text: testText }],
      },
      taskType: 'RETRIEVAL_DOCUMENT',
    }),
  })

  const elapsed = Date.now() - t0

  if (!response.ok) {
    const errText = await response.text()
    console.error(`❌ API error [${response.status} ${response.statusText}]:`)
    console.error(errText)
    console.error('\nDebugging tips:')
    console.error('  • 403 / API key invalid → check key is valid for Google AI Studio')
    console.error('  • 404 model not found   → make sure you are NOT using v1beta (this script uses v1)')
    console.error('  • 429 quota exceeded    → wait and retry, or check billing')
    process.exit(1)
  }

  const data = await response.json()
  const values = data?.embedding?.values

  if (!values || !Array.isArray(values)) {
    console.error('❌ Unexpected response shape:', JSON.stringify(data, null, 2))
    process.exit(1)
  }

  if (values.length !== EMBEDDING_DIMS) {
    console.error(`❌ Wrong dims: got ${values.length}, expected ${EMBEDDING_DIMS}`)
    process.exit(1)
  }

  console.log(`✅ text-embedding-004 v1 API is working!`)
  console.log(`   Dimensions : ${values.length}`)
  console.log(`   First 5 values : [${values.slice(0, 5).map(v => v.toFixed(6)).join(', ')}]`)
  console.log(`   Latency    : ${elapsed}ms`)
  console.log('\n✅ Embedding pipeline should work. Run admin embed now:')
  console.log('   Invoke-WebRequest -Method POST -UseBasicParsing `')
  console.log('     -Uri "https://cognibloom.vercel.app/api/admin/content/embed" `')
  console.log('     -Headers @{ "Authorization" = "Bearer 979800" } | Select-Object -ExpandProperty Content')
}

testEmbedding().catch((err) => {
  console.error('❌ Unexpected error:', err)
  process.exit(1)
})
