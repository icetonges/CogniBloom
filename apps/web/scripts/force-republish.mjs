/**
 * force-republish.mjs
 *
 * Clears any cached writerJson for a note and forces a fresh AI republish.
 * Run from apps/web:
 *
 *   node scripts/force-republish.mjs 20260625_Daily_Reflection_001
 *
 * The script:
 *  1. Calls GET /api/notes/published to find the noteId for the given slug
 *  2. Clears the note's writerJson via a direct DB update (so no bad fallback is used)
 *  3. Calls POST /api/notes/<noteId>/publish → the full AI writer runs fresh
 *  4. Reports success or failure with the published URL
 *
 * Prerequisites:
 *  - Run `npx prisma db push` first (to create the writerJson column)
 *  - The app must be deployed to Vercel (or run `pnpm dev` locally and set BASE_URL)
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const BASE_URL = process.env.BASE_URL ?? 'https://cognibloom.vercel.app'
const slug = process.argv[2]

if (!slug) {
  console.error('Usage: node scripts/force-republish.mjs <publishedSlug>')
  console.error('  e.g. node scripts/force-republish.mjs 20260625_Daily_Reflection_001')
  process.exit(1)
}

async function main() {
  console.log(`\n🔍 Looking up note: ${slug}`)

  // 1. Find note ID from the published list
  const listRes = await fetch(`${BASE_URL}/api/notes/published`)
  if (!listRes.ok) {
    throw new Error(`GET /api/notes/published → HTTP ${listRes.status}`)
  }
  const { data: notes } = await listRes.json()
  const note = notes?.find(n => n.publishedSlug === slug)
  if (!note) {
    throw new Error(`No published note found with slug: ${slug}`)
  }
  console.log(`✅ Found note: "${note.title}" (id: ${note.id})`)

  // 2. Clear writerJson via the DB directly so AI runs completely fresh
  //    This step uses Prisma — must be run from apps/web directory.
  let dbCleared = false
  try {
    // Dynamic import works if running from apps/web with the right env
    const { db } = await import('../lib/db.js').catch(() => require('../lib/db'))
    await db.note.update({
      where: { id: note.id },
      data: { writerJson: null },
    })
    console.log('🗑️  Cleared cached writerJson — AI will generate fresh content')
    dbCleared = true
  } catch (e) {
    console.warn(`⚠️  Could not clear writerJson directly (${e.message?.slice(0, 80)})`)
    console.warn('   Proceeding anyway — the AI will still run and overwrite on success.')
  }

  // 3. Trigger republish — AI writer runs with 120s timeout on Vercel
  console.log(`\n🚀 Triggering AI republish... (this can take up to 60s)`)
  const startMs = Date.now()

  const publishRes = await fetch(`${BASE_URL}/api/notes/${note.id}/publish`, {
    method: 'POST',
    signal: AbortSignal.timeout(130_000), // 130s client timeout > 120s server timeout
  })

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1)

  if (!publishRes.ok) {
    const body = await publishRes.text()
    throw new Error(`POST /api/notes/${note.id}/publish → HTTP ${publishRes.status}\n${body.slice(0, 300)}`)
  }

  const result = await publishRes.json()
  console.log(`\n✅ Republished in ${elapsed}s`)
  console.log(`   Title: ${result.data?.publishTitle ?? '(unknown)'}`)
  console.log(`   URL:   ${BASE_URL}${result.data?.url ?? `/notes/view/${slug}`}`)
  console.log('\n🎉 Done! Hard-refresh the page to see the new content.')
}

main().catch(err => {
  console.error('\n❌ Error:', err.message ?? err)
  process.exit(1)
})
