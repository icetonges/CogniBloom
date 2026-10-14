import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

type RouteParams = { params: Promise<{ noteId: string }> }

// A single sitting can't plausibly exceed this; anything larger is a clock bug.
const MAX_MS = 24 * 60 * 60 * 1000
const ms = z.number().int().min(0).max(MAX_MS)
const count = z.number().int().min(0).max(10_000_000)

const sessionSchema = z.object({
  id: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  kind: z.enum(['create', 'edit']),
  template: z.string().max(40).nullable().optional(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  openMs: ms,
  foregroundMs: ms,
  awayMs: ms,
  activeMs: ms,
  idleMs: ms,
  firstInputAt: z.string().datetime().nullable(),
  lastInputAt: z.string().datetime().nullable(),
  typingSpanMs: ms,
  inputEvents: count,
  pauseCount: count,
  longestPauseMs: ms,
  hiddenCount: count,
  wordsStart: count,
  wordsEnd: count,
})

const SESSION_SELECT = {
  id: true,
  kind: true,
  template: true,
  startedAt: true,
  endedAt: true,
  openMs: true,
  foregroundMs: true,
  awayMs: true,
  activeMs: true,
  idleMs: true,
  firstInputAt: true,
  lastInputAt: true,
  typingSpanMs: true,
  inputEvents: true,
  pauseCount: true,
  longestPauseMs: true,
  hiddenCount: true,
  wordsStart: true,
  wordsEnd: true,
} as const

// GET /api/notes/[noteId]/writing-sessions — every session plus totals
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { noteId } = await params

    const note = await db.note.findFirst({ where: { id: noteId, userId: session.user.id }, select: { id: true } })
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    const sessions = await db.noteWritingSession.findMany({
      where: { noteId },
      orderBy: { startedAt: 'asc' },
      select: SESSION_SELECT,
    })

    const totals = sessions.reduce(
      (t, s) => {
        t.openMs += s.openMs
        t.activeMs += s.activeMs
        t.idleMs += s.idleMs
        t.awayMs += s.awayMs
        t.typingSpanMs += s.typingSpanMs
        t.inputEvents += s.inputEvents
        t.wordsAdded += Math.max(0, s.wordsEnd - s.wordsStart)
        return t
      },
      { sessions: sessions.length, openMs: 0, activeMs: 0, idleMs: 0, awayMs: 0, typingSpanMs: 0, inputEvents: 0, wordsAdded: 0 },
    )
    const firstInputAt = sessions.find((s) => s.firstInputAt)?.firstInputAt ?? null
    const lastInputAt = [...sessions].reverse().find((s) => s.lastInputAt)?.lastInputAt ?? null

    return NextResponse.json({ success: true, data: { sessions, totals: { ...totals, firstInputAt, lastInputAt } } })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/notes/[noteId]/writing-sessions — upsert one cumulative snapshot
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { noteId } = await params

    const parsed = sessionSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid session' }, { status: 400 })
    const { id, ...body } = parsed.data

    const note = await db.note.findFirst({ where: { id: noteId, userId: session.user.id }, select: { id: true } })
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    // A session id is bound to the note it was first written against.
    const existing = await db.noteWritingSession.findUnique({ where: { id }, select: { noteId: true, endedAt: true } })
    if (existing && existing.noteId !== noteId) {
      return NextResponse.json({ error: 'Session belongs to another note' }, { status: 409 })
    }
    // keepalive requests can land out of order; never let an older snapshot win.
    if (existing && existing.endedAt > new Date(body.endedAt)) {
      return NextResponse.json({ success: true, stale: true })
    }

    const data = {
      ...body,
      template: body.template ?? null,
      startedAt: new Date(body.startedAt),
      endedAt: new Date(body.endedAt),
      firstInputAt: body.firstInputAt ? new Date(body.firstInputAt) : null,
      lastInputAt: body.lastInputAt ? new Date(body.lastInputAt) : null,
    }

    await db.noteWritingSession.upsert({
      where: { id },
      create: { id, noteId, ...data },
      update: data,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
