/**
 * clear-published.mjs
 *
 * Clears the published HTML for specific bad notes, then immediately republishes
 * them with fresh AI output (Gemini 3.5 Flash → Groq → Claude fallback chain).
 *
 * Usage (from apps/web):
 *   node scripts/clear-published.mjs
 *
 * Or to target a single slug:
 *   node scripts/clear-published.mjs 20260625_Daily_Reflection_001
 *
 * What it does per note:
 *   1. GET /api/notes/published  → find the noteId for the slug
 *   2. DELETE /api/notes/<id>/publish  → clear publishedHtml/Slug/At from DB
 *   3. POST /api/notes/<id>/publish    → regenerate with fresh AI (120s timeout)
 *   4. Reports the new published URL
 *
 * If you only want to unpublish (no republish), pass --no-republish flag:
 *   node scripts/clear-published.mjs --no-republish
 */

const BASE_URL = process.env.BASE_URL ?? 'https://cognibloom.vercel.app'

const BAD_SLUGS = [
  '20260625_Daily_Reflection_001',
  '20260624_Daily_Reflection_001',
]

const args = process.argv.slice(2)
const noRepublish = args.includes('--no-republish')
const targetSlugs = args.filter(a => !a.startsWith('--'))
const slugsToProcess = targetSlugs.length > 0 ? targetSlugs : BAD_SLUGS

async function processSlug(slug) {
  console.log(`\n──────────────────────────────────────────`)
  console.log(`📋 Processing: ${slug}`)

  // 1. Find note from published list
  const listRes = await fetch(`${BASE_URL}/api/notes/published`)
  if (!listRes.ok) throw new Error(`GET /api/notes/published → HTTP ${listRes.status}`)
  const { data: notes } = await listRes.json()
  const note = notes?.find(n => n.publishedSlug === slug)

  if (!note) {
    console.log(`⚠️  No published note found with slug: ${slug}`)
    console.log(`   (It may already be unpublished — skipping)`)
    return
  }
  console.log(`✅ Found: "${note.title}" (id: ${note.id})`)

  // 2. Clear published state from DB
  console.log(`🗑️  Unpublishing (clearing publishedHtml from DB)…`)
  const delRes = await fetch(`${BASE_URL}/api/notes/${note.id}/publish`, { method: 'DELETE' })
  if (!delRes.ok) {
    const body = await delRes.text()
    throw new Error(`DELETE publish → HTTP ${delRes.status}\n${body.slice(0, 200)}`)
  }
  const delData = await delRes.json()
  if (!delData.success) throw new Error(delData.error ?? 'Unpublish failed')
  console.log(`   ✓ Published HTML cleared`)

  if (noRepublish) {
    console.log(`   (--no-republish set — skipping AI regeneration)`)
    return
  }

  // 3. Republish with fresh AI
  console.log(`🚀 Republishing with fresh AI… (up to 120s)`)
  const startMs = Date.now()
  const pubRes = await fetch(`${BASE_URL}/api/notes/${note.id}/publish`, {
    method: 'POST',
    signal: AbortSignal.timeout(135_000),
  })
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1)

  if (!pubRes.ok) {
    const body = await pubRes.text()
    throw new Error(`POST publish → HTTP ${pubRes.status} (${elapsed}s)\n${body.slice(0, 200)}`)
  }
  const pubData = await pubRes.json()
  if (!pubData.success) throw new Error(pubData.error ?? 'Republish failed')

  const newSlug = pubData.data?.slug ?? slug
  console.log(`✅ Republished in ${elapsed}s`)
  console.log(`   URL: ${BASE_URL}/notes/view/${newSlug}`)
}

async function main() {
  console.log(`\n🌐 Base URL: ${BASE_URL}`)
  console.log(`📝 Slugs to process: ${slugsToProcess.join(', ')}`)
  if (noRepublish) console.log(`   Mode: unpublish only (no AI regeneration)`)

  let ok = 0, failed = 0
  for (const slug of slugsToProcess) {
    try {
      await processSlug(slug)
      ok++
    } catch (e) {
      console.error(`\n❌ Failed for "${slug}": ${e.message}`)
      failed++
    }
  }

  console.log(`\n──────────────────────────────────────────`)
  console.log(`Done: ${ok} succeeded, ${failed} failed`)
  if (ok > 0) console.log(`\n💡 Hard-refresh any open published pages to see new content.`)
  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message ?? err)
  process.exit(1)
})
