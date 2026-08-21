import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { BOOKS, CORRECTED_BOOKS, AMBIGUOUS_BOOKS, HANDOUT_RESOURCES, LAYERS, allThemes } from '@/lib/english'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * GET  /api/english/books            → the 43 titles with this student's progress
 * POST /api/english/books {ingest}   → (re)load lib/english/books.ts into the DB
 *
 * The catalog is static config; only progress is user data. If the table does
 * not exist yet (migration pending) the catalog still returns, with no
 * progress attached, so the page works before the migration is applied.
 */
export async function GET() {
  const session = await auth()
  const userId = session?.user?.id ?? null

  let progress: Record<string, unknown> = {}
  let migrated = true
  if (userId) {
    try {
      const rows = await db.bookProgress.findMany({
        where: { userId },
        select: {
          layer: true, status: true, currentPart: true, percent: true,
          rating: true, startedAt: true, finishedAt: true,
          book: { select: { slug: true } },
        },
      })
      progress = Object.fromEntries(rows.map((r) => [r.book.slug, r]))
    } catch (err) {
      if (isMissingTable(err)) migrated = false
      else throw err
    }
  }

  return NextResponse.json({
    success: true,
    migrated,
    books: BOOKS,
    progress,
    layers: LAYERS,
    themes: allThemes(),
    resources: HANDOUT_RESOURCES,
    counts: {
      total: BOOKS.length,
      corrected: CORRECTED_BOOKS.length,
      ambiguous: AMBIGUOUS_BOOKS.length,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = (await request.json()) as { action?: string }
    if (body.action !== 'ingest') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    let created = 0
    let updated = 0
    for (const b of BOOKS) {
      const data = {
        n: b.n, title: b.title, subtitle: b.subtitle ?? null,
        authors: [...b.authors], year: b.year, form: b.form, band: b.band,
        themes: [...b.themes], series: b.series ?? null,
        handoutSays: b.handoutSays ?? null,
        correction: b.correction ?? null,
        ambiguity: b.ambiguity ?? null,
        pairsWith: [...(b.pairsWith ?? [])],
        source: 'fcps-handout-2026-27',
      }
      const existing = await db.englishBook.findUnique({ where: { slug: b.slug } })
      if (existing) { await db.englishBook.update({ where: { slug: b.slug }, data }); updated++ }
      else { await db.englishBook.create({ data: { slug: b.slug, ...data } }); created++ }
    }
    return NextResponse.json({ success: true, total: BOOKS.length, created, updated })
  } catch (err) {
    console.error('[POST /api/english/books]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string }
  return e?.code === 'P2021' || /does not exist/i.test(e?.message ?? '')
}
