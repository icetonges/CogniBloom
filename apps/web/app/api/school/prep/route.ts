import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { chatWithFallback } from '@/lib/ai/fallback'
import {
  buildPrep,
  describeDayForAI,
  nextSchoolDay,
  toKey,
  resourcesFor,
  competitionsForSubject,
  DISTRICT_SOURCES,
  type CoursePrep,
} from '@/lib/school'
import { schoolDayFor } from '@/lib/school-db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
/** Planner tag namespace used to persist ladder progress, e.g. "ladder:algebra:3". */
const LADDER_PREFIX = 'ladder:'

interface SubjectContext {
  subject: string
  notes: { title: string; slug: string | null; updatedAt: string }[]
  noteCount: number
  flashcardsDue: number
  weakestCards: string[]
}

/**
 * GET /api/school/prep?date=YYYY-MM-DD&ai=1
 *
 * Assembles everything needed to walk into a day prepared: the class list with
 * times and rooms, the pack list, per-course authoritative sources, the next
 * rung on each challenge ladder, plus the student's own notes and due
 * flashcards for each subject. With `ai=1` it also generates a coaching
 * briefing that ties those together.
 *
 * Defaults to the *next* school day, because prep is a night-before activity.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id

    const { searchParams } = new URL(request.url)
    const raw = searchParams.get('date')
    const today = toKey(new Date())
    const date = raw && DAY_RE.test(raw) ? raw : (nextSchoolDay(today) ?? today)
    const wantAi = searchParams.get('ai') === '1'

    const day = await schoolDayFor(date)
    if (!day.isSchoolDay) {
      return NextResponse.json({
        success: true,
        date,
        day,
        prep: [],
        subjects: [],
        districtSources: DISTRICT_SOURCES,
        briefing: '',
        message: `${day.dateLabel} — ${day.label}${day.closureReason && day.closureReason !== day.label ? ` (${day.closureReason})` : ''}. No classes to prepare for.`,
      })
    }

    // ── ladder progress, persisted as tags on a single planner marker entry ──
    const ladderLevels = await readLadderLevels(userId)
    const prep: CoursePrep[] = buildPrep(date, ladderLevels)

    // ── the student's own material, per subject ──
    const subjects = Array.from(new Set(day.periods.map((p) => p.course.subject)))
    const now = new Date()

    const [notes, dueCards] = await Promise.all([
      db.note.findMany({
        where: { userId, subject: { in: subjects } },
        select: { title: true, slug: true, subject: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 60,
      }),
      db.flashcard.findMany({
        where: { userId, subject: { in: subjects }, nextReviewAt: { lte: now } },
        select: { front: true, subject: true, easeFactor: true },
        orderBy: { easeFactor: 'asc' },
        take: 120,
      }),
    ])

    const subjectContext: SubjectContext[] = subjects.map((subject) => {
      const mine = notes.filter((n) => n.subject === subject)
      const cards = dueCards.filter((c) => c.subject === subject)
      return {
        subject,
        notes: mine.slice(0, 4).map((n) => ({
          title: n.title,
          slug: n.slug,
          updatedAt: n.updatedAt.toISOString(),
        })),
        noteCount: mine.length,
        flashcardsDue: cards.length,
        // Lowest ease factor = the cards he keeps getting wrong.
        weakestCards: cards.slice(0, 3).map((c) => c.front.slice(0, 120)),
      }
    })

    const enriched = prep.map((p) => {
      const ctx = subjectContext.find((s) => s.subject === p.course.subject)
      const res = resourcesFor(p.course.id)
      return {
        ...p,
        allSources: res?.sources ?? [],
        ladder: res?.ladder ?? [],
        ladderAt: ladderLevels[p.course.id] ?? 0,
        competitions: competitionsForSubject(p.course.subject),
        myNotes: ctx?.notes ?? [],
        noteCount: ctx?.noteCount ?? 0,
        flashcardsDue: ctx?.flashcardsDue ?? 0,
        weakestCards: ctx?.weakestCards ?? [],
      }
    })

    let briefing = ''
    if (wantAi) {
      briefing = await generateBriefing(date, ladderLevels, enriched)
    }

    return NextResponse.json({
      success: true,
      date,
      day,
      prep: enriched,
      subjects: subjectContext,
      districtSources: DISTRICT_SOURCES,
      ladderLevels,
      briefing,
    })
  } catch (err) {
    console.error('[GET /api/school/prep]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/school/prep — record progress up a course's challenge ladder.
 * body: { courseId, level }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id
    const body = (await request.json()) as { courseId?: string; level?: number }
    if (!body.courseId || typeof body.level !== 'number') {
      return NextResponse.json({ error: 'courseId and level required' }, { status: 400 })
    }
    const level = Math.max(0, Math.min(20, Math.round(body.level)))

    const marker = await ensureMarker(userId)
    const kept = marker.tags.filter((t) => !t.startsWith(`${LADDER_PREFIX}${body.courseId}:`))
    const tags = [...kept, `${LADDER_PREFIX}${body.courseId}:${level}`]

    await db.plannerEntry.update({ where: { id: marker.id }, data: { tags } })
    return NextResponse.json({ success: true, ladderLevels: parseLadder(tags) })
  } catch (err) {
    console.error('[POST /api/school/prep]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── ladder persistence ──────────────────────────────────────────────────────
//
// Ladder progress is a handful of small integers, so rather than add a table
// (and a migration) it rides on a single reserved PlannerEntry anchored to the
// first day of the school year and tagged `__ladder__`. It never renders in the
// planner because the UI skips entries carrying a reserved tag.

const LADDER_MARKER = '__ladder__'
const LADDER_ANCHOR = new Date(Date.UTC(2026, 7, 24))

async function ensureMarker(userId: string) {
  const found = await db.plannerEntry.findFirst({
    where: { userId, scope: 'day', date: LADDER_ANCHOR, title: LADDER_MARKER },
  })
  if (found) return found
  return db.plannerEntry.create({
    data: {
      userId, scope: 'day', date: LADDER_ANCHOR,
      title: LADDER_MARKER, tags: [LADDER_MARKER], sortOrder: 9999,
      details: 'Reserved — stores challenge-ladder progress per course.',
    },
  })
}

function parseLadder(tags: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of tags) {
    if (!t.startsWith(LADDER_PREFIX)) continue
    const [, courseId, level] = t.split(':')
    if (courseId && level !== undefined) out[courseId] = Number(level) || 0
  }
  return out
}

async function readLadderLevels(userId: string): Promise<Record<string, number>> {
  const marker = await db.plannerEntry.findFirst({
    where: { userId, scope: 'day', date: LADDER_ANCHOR, title: LADDER_MARKER },
    select: { tags: true },
  })
  return marker ? parseLadder(marker.tags) : {}
}

// ── AI briefing ─────────────────────────────────────────────────────────────

type Enriched = CoursePrep & {
  ladderAt: number
  flashcardsDue: number
  noteCount: number
  weakestCards: string[]
}

async function generateBriefing(
  date: string,
  ladderLevels: Record<string, number>,
  prep: Enriched[]
): Promise<string> {
  const facts = prep.map((p) => ({
    course: p.course.name,
    rigor: p.course.rigor,
    period: p.period,
    time: p.time,
    room: p.room,
    teacher: p.course.teacher,
    ladderAt: p.ladderAt,
    nextRung: p.nextRung ? `L${p.nextRung.level} ${p.nextRung.title} — ${p.nextRung.action}` : 'ladder complete',
    myNotes: p.noteCount,
    flashcardsDue: p.flashcardsDue,
    strugglingWith: p.weakestCards,
  }))

  const prompt = `You are Daniel's study coach. He is a 7th grader at Frost Middle School in Fairfax County, VA, taking Algebra 1 Honors (high-school credit) plus three Advanced Academic courses. He is aiming at competition math (AMC 8, working toward AMC 10) alongside keeping his coursework airtight.

Tomorrow's schedule and his current state:

${describeDayForAI(date, ladderLevels)}

PER-COURSE DATA (JSON):
${JSON.stringify(facts, null, 1)}

Write his prep briefing in markdown, about 220-280 words. Structure it exactly like this:

**Tonight** — the 3 highest-leverage things to do this evening, in priority order, each one sentence and specific. Lead with anything where flashcards are due or he is struggling, and name the actual card topic if the data shows one.

**Tomorrow, class by class** — one short line per class in period order: what to have ready or reviewed. Reference the room only if the transition is worth flagging.

**One level up** — pick the single course where pushing past the syllabus matters most tomorrow, and name the concrete next rung action from the data. If Algebra is on the schedule, favour it and connect it to competition math.

**Watch out** — one honest risk: something slipping, a habit to hold, or a tight transition.

Rules: be concrete and warm, never generic. Do not invent assignments, grades, test dates, or teacher instructions that are not in the data above — you do not have his gradebook. If flashcardsDue is 0 for everything, say so plainly instead of manufacturing work. Start directly with the **Tonight** heading.`

  try {
    const r = await chatWithFallback({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.55,
      maxTokens: 1100,
    })
    return r.content
  } catch (err) {
    console.error('[prep briefing]', err)
    return ''
  }
}
