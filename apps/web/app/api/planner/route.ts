import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Parse a "YYYY-MM-DD" (day) or "YYYY-MM" (month) string into a UTC anchor Date.
function parseAnchor(value: string, scope: string): Date | null {
  if (scope === 'month') {
    const m = /^(\d{4})-(\d{2})$/.exec(value)
    if (!m) return null
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1))
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

// GET /api/planner?scope=day&date=2026-06-22
// GET /api/planner?scope=month&date=2026-06       → all day+month entries in that month
export async function GET(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope') ?? 'day'
    const date = searchParams.get('date') ?? ''

    let where: Record<string, unknown> = { userId }

    if (scope === 'month') {
      // Return everything anchored inside this calendar month (both monthly
      // goals and the individual day entries) so the month view can render.
      const anchor = parseAnchor(date, 'month')
      if (!anchor) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
      const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1))
      where = { userId, date: { gte: anchor, lt: end } }
    } else {
      const anchor = parseAnchor(date, 'day')
      if (!anchor) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
      where = { userId, scope: 'day', date: anchor }
    }

    const entries = await db.plannerEntry.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    // Collect the user's distinct tags for autocomplete chips.
    const all = await db.plannerEntry.findMany({ where: { userId }, select: { tags: true } })
    const tagSet = new Set<string>()
    all.forEach((e) => e.tags.forEach((t) => tagSet.add(t)))

    return NextResponse.json({ success: true, data: entries, tags: Array.from(tagSet).sort() })
  } catch (err) {
    console.error('[GET /api/planner]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/planner — create an entry
//   body: { scope, date ("YYYY-MM-DD" or "YYYY-MM"), title, details?, tags?, priority?, startTime?, color? }
export async function POST(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const body = (await request.json()) as {
      scope?: string
      date?: string
      title?: string
      details?: string
      tags?: string[]
      priority?: string
      startTime?: string
      color?: string
    }

    const scope = body.scope === 'month' ? 'month' : 'day'
    if (!body.title?.trim() || !body.date) {
      return NextResponse.json({ error: 'title and date required' }, { status: 400 })
    }
    const anchor = parseAnchor(body.date, scope)
    if (!anchor) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })

    const last = await db.plannerEntry.findFirst({
      where: { userId, scope, date: anchor },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })

    const entry = await db.plannerEntry.create({
      data: {
        userId,
        scope,
        date: anchor,
        title: body.title.trim().slice(0, 300),
        details: body.details?.trim() || null,
        tags: (body.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 12),
        priority: ['low', 'normal', 'high'].includes(body.priority ?? '') ? body.priority! : 'normal',
        startTime: body.startTime?.trim() || null,
        color: body.color?.trim() || null,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    })

    return NextResponse.json({ success: true, data: entry })
  } catch (err) {
    console.error('[POST /api/planner]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/planner — update an entry (toggle done, edit fields)
//   body: { id, ...partial }
export async function PATCH(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const body = (await request.json()) as {
      id?: string
      title?: string
      details?: string | null
      tags?: string[]
      status?: string
      priority?: string
      startTime?: string | null
      color?: string | null
    }
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const existing = await db.plannerEntry.findFirst({ where: { id: body.id, userId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data['title'] = body.title.trim().slice(0, 300)
    if (body.details !== undefined) data['details'] = body.details?.trim() || null
    if (body.tags !== undefined) data['tags'] = body.tags.map((t) => t.trim()).filter(Boolean).slice(0, 12)
    if (body.priority !== undefined && ['low', 'normal', 'high'].includes(body.priority)) data['priority'] = body.priority
    if (body.startTime !== undefined) data['startTime'] = body.startTime?.trim() || null
    if (body.color !== undefined) data['color'] = body.color?.trim() || null
    if (body.status !== undefined && ['pending', 'done'].includes(body.status)) {
      data['status'] = body.status
      data['completedAt'] = body.status === 'done' ? new Date() : null
    }

    const entry = await db.plannerEntry.update({ where: { id: body.id }, data })
    return NextResponse.json({ success: true, data: entry })
  } catch (err) {
    console.error('[PATCH /api/planner]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/planner?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await db.plannerEntry.deleteMany({ where: { id, userId } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/planner]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
