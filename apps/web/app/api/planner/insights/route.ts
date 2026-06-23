import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { chatWithFallback } from '@/lib/ai/fallback'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

const META_TAG = '__meta__'

// GET /api/planner/insights?days=30 — analyze planner trend, effort & consistency
export async function GET(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const { searchParams } = new URL(request.url)
    const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '30', 10) || 30, 7), 90)

    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const start = new Date(today)
    start.setUTCDate(today.getUTCDate() - (days - 1))

    const entries = await db.plannerEntry.findMany({
      where: { userId, scope: 'day', date: { gte: start } },
      select: { title: true, status: true, tags: true, date: true },
      orderBy: { date: 'asc' },
    })
    const real = entries.filter((e) => !e.tags.includes(META_TAG))

    // per-day completion
    const byDay = new Map<string, { total: number; done: number }>()
    for (const e of real) {
      const k = e.date.toISOString().slice(0, 10)
      const d = byDay.get(k) ?? { total: 0, done: 0 }
      d.total++
      if (e.status === 'done') d.done++
      byDay.set(k, d)
    }
    const series = Array.from(byDay.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, v]) => ({ date, total: v.total, done: v.done, pct: v.total ? Math.round((v.done / v.total) * 100) : 0 }))

    // per-habit consistency (routine items)
    const routine = real.filter((e) => e.tags.includes('routine'))
    const habitMap = new Map<string, { scheduled: number; completed: number }>()
    for (const e of routine) {
      const h = habitMap.get(e.title) ?? { scheduled: 0, completed: 0 }
      h.scheduled++
      if (e.status === 'done') h.completed++
      habitMap.set(e.title, h)
    }
    const habits = Array.from(habitMap.entries())
      .map(([title, v]) => ({ title, scheduled: v.scheduled, completed: v.completed, rate: v.scheduled ? Math.round((v.completed / v.scheduled) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate)

    // current streak — consecutive days (ending today) with at least one completion
    let streak = 0
    for (let i = 0; ; i++) {
      const d = new Date(today)
      d.setUTCDate(today.getUTCDate() - i)
      const v = byDay.get(d.toISOString().slice(0, 10))
      if (v && v.done > 0) streak++
      else break
    }

    const totalTasks = real.length
    const totalDone = real.filter((e) => e.status === 'done').length
    const overallRate = totalTasks ? Math.round((totalDone / totalTasks) * 100) : 0
    const stats = { days, activeDays: byDay.size, totalTasks, totalDone, overallRate, streak, habits, series }

    let analysis = ''
    if (totalTasks > 0) {
      const prompt = `You are an encouraging but honest personal productivity coach reviewing a student's daily-planner data from the last ${days} days.

DATA (JSON):
${JSON.stringify({ overallRate, activeDays: byDay.size, streak, habits, recentDays: series.slice(-14) })}

Write a concise coaching analysis in markdown (~160-200 words) with these bold sections:
- **Trend** — is effort rising, steady, or slipping across the period? Reference the recentDays percentages.
- **Consistency** — name the strongest habit(s) and the weakest by name, with their rates.
- **Effort & streak** — comment on overall completion (${overallRate}%) and the ${streak}-day streak.
- **Next step** — one or two specific, doable suggestions.
Be warm and motivating, specific to the data, no generic filler. Start directly with the **Trend** heading.`
      try {
        const r = await chatWithFallback({ messages: [{ role: 'user', content: prompt }], temperature: 0.6, maxTokens: 700 })
        analysis = r.content
      } catch {
        analysis = ''
      }
    }

    return NextResponse.json({ success: true, stats, analysis })
  } catch (err) {
    console.error('[GET /api/planner/insights]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
