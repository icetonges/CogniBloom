import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import {
  buildIngestRows,
  resolveDay,
  toKey,
  FIRST_DAY,
  LAST_DAY,
  type CalendarOverride,
} from '@/lib/school'
import { overridesFor } from '@/lib/school-db'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * The school calendar table, and the manual overrides layered on top of it.
 *
 *   GET    ?from=&to=       → resolved days in a range (defaults to the year)
 *   GET    ?date=           → one resolved day
 *   POST   { action:'ingest' } → (re)load the published FCPS calendar
 *   POST   { date, ... }    → add or update a manual override (snow day, delay)
 *   DELETE ?date=           → drop a manual override, reverting to FCPS
 *
 * Reads are open (the calendar is public information); writes require a
 * session, since they change what every page shows.
 */

// ── read ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const one = searchParams.get('date')
    const from = searchParams.get('from') ?? FIRST_DAY
    const to = searchParams.get('to') ?? LAST_DAY

    if (one && !DAY_RE.test(one)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }
    const lo = one ?? from
    const hi = one ?? to
    if (!DAY_RE.test(lo) || !DAY_RE.test(hi)) {
      return NextResponse.json({ error: 'from/to must be YYYY-MM-DD' }, { status: 400 })
    }

    const byDate = await overridesFor(lo, hi)

    if (one) {
      return NextResponse.json({ success: true, day: resolveDay(one, byDate.get(one) ?? null) })
    }

    // Every notable date in the range: whatever the FCPS calendar marks, plus
    // any stored override. Ordinary Blue/Gray days are derived client-side.
    const dates = new Set<string>([
      ...buildIngestRows().map((r) => r.date).filter((d) => d >= lo && d <= hi),
      ...Array.from(byDate.keys()).filter((d) => d >= lo && d <= hi),
    ])
    const days = Array.from(dates).sort().map((d) => resolveDay(d, byDate.get(d) ?? null))
    return NextResponse.json({
      success: true,
      from: lo,
      to: hi,
      count: days.length,
      days,
    })
  } catch (err) {
    console.error('[GET /api/school/calendar]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── write ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json()) as {
      action?: string
      date?: string
      noSchool?: boolean
      rotation?: 'blue' | 'gray' | null
      scheduleKind?: 'regular' | 'two-hour-delay' | 'early-release' | null
      label?: string
      category?: string
      note?: string
    }

    // ── ingest the published FCPS calendar ──
    if (body.action === 'ingest') {
      const rows = buildIngestRows()
      let created = 0
      let updated = 0
      let skipped = 0

      for (const r of rows) {
        const date = new Date(`${r.date}T00:00:00.000Z`)
        const existing = await db.schoolCalendarDay.findUnique({ where: { date } })

        // A hand-entered closure is never clobbered by a re-ingest.
        if (existing && existing.source === 'manual') { skipped++; continue }

        const data = {
          rotation: r.rotation,
          noSchool: r.noSchool,
          earlyRelease: r.earlyRelease,
          code: r.code,
          category: r.category,
          label: r.label,
          note: r.note,
          source: 'fcps',
        }
        if (existing) {
          await db.schoolCalendarDay.update({ where: { date }, data })
          updated++
        } else {
          await db.schoolCalendarDay.create({ data: { date, ...data } })
          created++
        }
      }

      return NextResponse.json({
        success: true,
        action: 'ingest',
        total: rows.length,
        created,
        updated,
        skippedManual: skipped,
      })
    }

    // ── manual override ──
    if (!body.date || !DAY_RE.test(body.date)) {
      return NextResponse.json({ error: 'date (YYYY-MM-DD) required' }, { status: 400 })
    }
    const date = new Date(`${body.date}T00:00:00.000Z`)
    const data = {
      noSchool: body.noSchool === true,
      rotation: body.rotation ?? null,
      scheduleKind: body.scheduleKind ?? null,
      label: body.label?.trim().slice(0, 200) || null,
      category: body.category?.trim() || (body.noSchool ? 'student_holiday' : 'instructional'),
      note: body.note?.trim().slice(0, 2000) || null,
      code: null,
      earlyRelease: body.scheduleKind === 'early-release',
      source: 'manual',
    }

    const row = await db.schoolCalendarDay.upsert({
      where: { date },
      create: { date, ...data },
      update: data,
    })

    return NextResponse.json({ success: true, day: resolveDay(body.date, toOverride(row)) })
  } catch (err) {
    console.error('[POST /api/school/calendar]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** DELETE /api/school/calendar?date=YYYY-MM-DD — revert to the FCPS calendar. */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    if (!date || !DAY_RE.test(date)) {
      return NextResponse.json({ error: 'date (YYYY-MM-DD) required' }, { status: 400 })
    }
    // Only manual rows are removable; ingested rows are recreated by the ingest.
    await db.schoolCalendarDay.deleteMany({
      where: { date: new Date(`${date}T00:00:00.000Z`), source: 'manual' },
    })
    return NextResponse.json({ success: true, day: resolveDay(date, null) })
  } catch (err) {
    console.error('[DELETE /api/school/calendar]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────

function toOverride(row: {
  date: Date
  rotation: string | null
  noSchool: boolean
  scheduleKind: string | null
  label: string | null
  category: string | null
  note: string | null
}): CalendarOverride {
  return {
    date: toKey(row.date),
    noSchool: row.noSchool,
    rotation: (row.rotation as 'blue' | 'gray' | null) ?? null,
    scheduleKind: (row.scheduleKind as CalendarOverride['scheduleKind']) ?? null,
    label: row.label,
    category: (row.category as CalendarOverride['category']) ?? null,
    note: row.note,
  }
}
