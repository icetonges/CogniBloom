import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { chatWithFallback } from '@/lib/ai/fallback'
import { resolveGrade } from '@/lib/tutor/reflection-tutor'
import {
  buildSummaryPrompt, parseSummary, progressFingerprint, reflectionPlainText, isProgressComplete,
  type StoredSummary,
} from '@/lib/reflection-summary'

export const maxDuration = 60

type RouteParams = { params: Promise<{ noteId: string }> }

const bodySchema = z.object({
  // The live editor HTML, so the summary matches what's on screen even if
  // auto-save hasn't caught up yet.
  html: z.string().min(1).max(400_000),
  focusMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).nullable().optional(),
})

// GET /api/notes/[noteId]/reflection-summary — the stored summary, if any
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { noteId } = await params
  const note = await db.note.findFirst({
    where: { id: noteId, userId: session.user.id },
    select: { reflectionSummary: true },
  })
  if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: note.reflectionSummary ?? null })
}

// POST /api/notes/[noteId]/reflection-summary — generate (or regenerate) and store
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id
    const { noteId } = await params

    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const { html, focusMs } = parsed.data

    if (!isProgressComplete(html)) {
      return NextResponse.json({ error: 'Finish the three lines in "14. Progress Summary" first.' }, { status: 422 })
    }

    const [note, prefs, user] = await Promise.all([
      db.note.findFirst({ where: { id: noteId, userId }, select: { id: true, title: true } }),
      db.userPreferences.findUnique({ where: { userId }, select: { grade: true, preferredModel: true } }),
      db.user.findUnique({ where: { id: userId }, select: { name: true, grade: true, age: true } }),
    ])
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    const grade = resolveGrade({ settingsGrade: prefs?.grade, profileGrade: user?.grade, profileAge: user?.age })
    const name = (user?.name ?? '').trim().split(/\s+/)[0] || 'the student'
    const focusMinutes = typeof focusMs === 'number' && focusMs >= 60_000 ? Math.round(focusMs / 60_000) : null

    const prompt = buildSummaryPrompt({
      reflection: reflectionPlainText(html),
      name,
      gradeLabel: grade.label,
      focusMinutes,
      noteTitle: note.title,
    })

    // One retry: a model occasionally wraps or truncates the JSON.
    let summary = null
    for (let attempt = 0; attempt < 2 && !summary; attempt++) {
      const res = await chatWithFallback(
        { messages: [{ role: 'user', content: prompt }], temperature: attempt ? 0.2 : 0.5, maxTokens: 900 },
        prefs?.preferredModel,
      )
      summary = parseSummary(res.content)
    }
    if (!summary) return NextResponse.json({ error: 'The AI reply could not be read. Try again.' }, { status: 502 })

    const stored: StoredSummary = {
      ...summary,
      generatedAt: new Date().toISOString(),
      fingerprint: progressFingerprint(html),
      focusMinutes,
    }
    await db.note.update({
      where: { id: noteId },
      data: { reflectionSummary: stored as unknown as object, reflectionSummaryAt: new Date() },
      select: { id: true },
    })

    return NextResponse.json({ success: true, data: stored })
  } catch (error) {
    console.error('[POST reflection-summary]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
