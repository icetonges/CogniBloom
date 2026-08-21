import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { bookBySlug, skillById, LAYER_ORDER, type Layer } from '@/lib/english'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/english/progress  — where he is in a book
 *   { slug, layer?, status?, currentPart?, percent?, rating?, takeaway? }
 *
 * POST  /api/english/progress  — log a reading session and/or move a skill
 *   { slug, minutes?, fromPart?, toPart?, summary?, skillsWorked?, skill?, level? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id
    const b = (await request.json()) as Record<string, unknown>
    const slug = String(b['slug'] ?? '')
    const book = bookBySlug(slug)
    if (!book) return NextResponse.json({ error: 'Unknown book' }, { status: 400 })

    const row = await db.englishBook.findUnique({ where: { slug }, select: { id: true } })
    if (!row) {
      return NextResponse.json(
        { error: 'Catalog not ingested. POST /api/english/books {"action":"ingest"} first.' },
        { status: 409 }
      )
    }

    const status = typeof b['status'] === 'string' ? String(b['status']) : undefined
    const layer = LAYER_ORDER.includes(b['layer'] as Layer) ? (b['layer'] as Layer) : undefined
    const data: Record<string, unknown> = {}
    if (layer) data['layer'] = layer
    if (status && ['not_started', 'reading', 'finished', 'abandoned'].includes(status)) {
      data['status'] = status
      if (status === 'reading') data['startedAt'] = new Date()
      if (status === 'finished') { data['finishedAt'] = new Date(); data['percent'] = 100 }
    }
    if (typeof b['currentPart'] === 'string') data['currentPart'] = String(b['currentPart']).slice(0, 120) || null
    if (typeof b['percent'] === 'number') data['percent'] = Math.max(0, Math.min(100, Math.round(b['percent'] as number)))
    if (typeof b['rating'] === 'number') data['rating'] = Math.max(1, Math.min(5, Math.round(b['rating'] as number)))
    if (typeof b['takeaway'] === 'string') data['takeaway'] = String(b['takeaway']).slice(0, 4000) || null

    const saved = await db.bookProgress.upsert({
      where: { userId_bookId: { userId, bookId: row.id } },
      create: { userId, bookId: row.id, layer: layer ?? 'required', ...data },
      update: data,
    })
    return NextResponse.json({ success: true, progress: saved })
  } catch (err) {
    console.error('[PATCH /api/english/progress]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id
    const b = (await request.json()) as Record<string, unknown>

    // ── move a skill's mastery level ──
    const skillId = typeof b['skill'] === 'string' ? String(b['skill']) : null
    if (skillId) {
      const skill = skillById(skillId)
      if (!skill) return NextResponse.json({ error: 'Unknown skill' }, { status: 400 })
      const level = Math.max(0, Math.min(4, Math.round(Number(b['level'] ?? 0))))
      const saved = await db.skillMastery.upsert({
        where: { userId_skillId: { userId, skillId } },
        create: {
          userId, skillId, strand: skill.strand, level,
          evidence: typeof b['evidence'] === 'string' ? String(b['evidence']).slice(0, 2000) : null,
          lastSeen: new Date(),
        },
        update: {
          level, lastSeen: new Date(),
          ...(typeof b['evidence'] === 'string' ? { evidence: String(b['evidence']).slice(0, 2000) } : {}),
        },
      })
      return NextResponse.json({ success: true, mastery: saved })
    }

    // ── log a reading session ──
    const slug = String(b['slug'] ?? '')
    if (!bookBySlug(slug)) return NextResponse.json({ error: 'Unknown book' }, { status: 400 })
    const row = await db.englishBook.findUnique({ where: { slug }, select: { id: true } })
    if (!row) return NextResponse.json({ error: 'Catalog not ingested' }, { status: 409 })

    const saved = await db.readingSession.create({
      data: {
        userId, bookId: row.id,
        minutes: Math.max(0, Math.min(600, Math.round(Number(b['minutes'] ?? 0)))),
        fromPart: typeof b['fromPart'] === 'string' ? String(b['fromPart']).slice(0, 120) : null,
        toPart: typeof b['toPart'] === 'string' ? String(b['toPart']).slice(0, 120) : null,
        summary: typeof b['summary'] === 'string' ? String(b['summary']).slice(0, 4000) : null,
        skillsWorked: Array.isArray(b['skillsWorked'])
          ? (b['skillsWorked'] as unknown[]).map(String).filter((s) => !!skillById(s)).slice(0, 12)
          : [],
        layer: LAYER_ORDER.includes(b['layer'] as Layer) ? (b['layer'] as Layer) : 'required',
      },
    })
    return NextResponse.json({ success: true, session: saved })
  } catch (err) {
    console.error('[POST /api/english/progress]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
