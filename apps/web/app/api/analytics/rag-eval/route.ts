import { NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'

/**
 * GET /api/analytics/rag-eval
 * Returns RAG quality metrics aggregated over the last 30 days.
 */
export async function GET() {
  try {
    const userId = DANIEL_USER_ID
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const evals = await db.ragEvaluation.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      select: {
        createdAt: true,
        faithfulness: true,
        answerRelevancy: true,
        contextPrecision: true,
        ragUsed: true,
        notesRetrieved: true,
        chunksRetrieved: true,
        hydeUsed: true,
      },
    })

    if (evals.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          averages: { faithfulness: null, answerRelevancy: null, contextPrecision: null },
          totalEvaluations: 0,
          ragUsageRate: 0,
          hydeUsageRate: 0,
          timeline: [],
        },
      })
    }

    // Compute averages (skip nulls)
    function avg(values: (number | null)[]): number | null {
      const valid = values.filter((v): v is number => v !== null)
      return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null
    }

    const averages = {
      faithfulness: avg(evals.map((e) => e.faithfulness)),
      answerRelevancy: avg(evals.map((e) => e.answerRelevancy)),
      contextPrecision: avg(evals.map((e) => e.contextPrecision)),
    }

    const ragUsageRate = evals.filter((e) => e.ragUsed).length / evals.length
    const hydeUsageRate = evals.filter((e) => e.hydeUsed).length / evals.length

    // Daily timeline (group by date)
    const byDay: Record<
      string,
      { faithfulness: number[]; answerRelevancy: number[]; contextPrecision: number[] }
    > = {}

    for (const e of evals) {
      const day = e.createdAt.toISOString().slice(0, 10)
      if (!byDay[day]) byDay[day] = { faithfulness: [], answerRelevancy: [], contextPrecision: [] }
      if (e.faithfulness !== null) byDay[day].faithfulness.push(e.faithfulness)
      if (e.answerRelevancy !== null) byDay[day].answerRelevancy.push(e.answerRelevancy)
      if (e.contextPrecision !== null) byDay[day].contextPrecision.push(e.contextPrecision)
    }

    const timeline = Object.entries(byDay).map(([date, scores]) => ({
      date,
      faithfulness: avg(scores.faithfulness),
      answerRelevancy: avg(scores.answerRelevancy),
      contextPrecision: avg(scores.contextPrecision),
    }))

    return NextResponse.json({
      success: true,
      data: {
        averages,
        totalEvaluations: evals.length,
        ragUsageRate,
        hydeUsageRate,
        timeline,
      },
    })
  } catch (err) {
    console.error('[GET /api/analytics/rag-eval]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
