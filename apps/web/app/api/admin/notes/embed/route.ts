import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { embedNote } from '@/lib/notes'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function verifyAdmin(request: NextRequest): boolean {
  const secret = process.env['ADMIN_SECRET_KEY']
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

// ─── POST /api/admin/notes/embed ──────────────────────────────────────────────
//
// Back-fills embeddings for all notes that don't have one yet.
// Safe to call multiple times — skips notes that already have an embedding.
// Process up to `limit` notes per call (default 50) to stay within timeouts.

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let limit = 50
  try {
    const body = await request.json().catch(() => ({})) as { limit?: number }
    if (typeof body.limit === 'number') limit = Math.min(body.limit, 200)
  } catch { /* ignore */ }

  const pending = await db.note.findMany({
    where: {
      // Prisma can't filter on unsupported vector columns, so we use a raw query
      // to find IDs of notes missing embeddings, then fetch them.
    },
    select: { id: true, title: true, content: true },
    take: limit * 3, // over-fetch; we'll filter below
  })

  // Identify which of those actually have no embedding via raw query
  const withEmbedding = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Note" WHERE embedding IS NOT NULL
  `
  const embeddedIds = new Set(withEmbedding.map((r) => r.id))
  const toEmbed = pending.filter((n) => !embeddedIds.has(n.id)).slice(0, limit)

  if (toEmbed.length === 0) {
    return NextResponse.json({ success: true, message: 'All notes already embedded', processed: 0 })
  }

  let processed = 0
  let failed = 0

  for (const note of toEmbed) {
    try {
      await embedNote(note.id, note.title, note.content)
      processed++
    } catch {
      failed++
    }
  }

  return NextResponse.json({ success: true, processed, failed, total: toEmbed.length })
}

// ─── GET /api/admin/notes/embed ───────────────────────────────────────────────
//
// Returns counts of notes with and without embeddings — useful for monitoring.

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [total, withEmbedding] = await Promise.all([
    db.note.count(),
    db.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) AS count FROM "Note" WHERE embedding IS NOT NULL`,
  ])

  const embedded = Number(withEmbedding[0]?.count ?? 0)

  return NextResponse.json({
    success: true,
    data: { total, embedded, missing: total - embedded },
  })
}
