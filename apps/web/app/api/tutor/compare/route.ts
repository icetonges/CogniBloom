import { NextRequest, NextResponse } from 'next/server'
import { chatWithFallback } from '@/lib/ai/fallback'
import type { ChatMessage } from '@/lib/ai/providers/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/tutor/compare — run a prompt through one or two models and return
// the answer(s). Body: { prompt, modelA, modelB?, system? }
// When modelB is omitted, a single model runs and b is returned as null.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      prompt?: string
      modelA?: string
      modelB?: string
      system?: string
    }
    const prompt = (body.prompt ?? '').trim()
    if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 })
    // modelA is required; modelB is optional. When modelB is omitted we run a
    // single model and return b:null (single-model "Ask" mode).
    if (!body.modelA) {
      return NextResponse.json({ error: 'modelA required' }, { status: 400 })
    }

    const system =
      body.system ??
      'You are a clear, accurate tutor. Answer the question helpfully and concisely.'
    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ]

    const run = async (model: string) => {
      const start = Date.now()
      try {
        const r = await chatWithFallback({ messages, temperature: 0.7, maxTokens: 1536 }, model)
        return {
          requested: model,
          usedModel: r.usedModel,
          content: r.content,
          tokens: r.tokensUsed?.total ?? 0,
          ms: Date.now() - start,
          error: null as string | null,
        }
      } catch (e) {
        return {
          requested: model,
          usedModel: model,
          content: '',
          tokens: 0,
          ms: Date.now() - start,
          error: e instanceof Error ? e.message : 'Failed',
        }
      }
    }

    const [a, b] = await Promise.all([
      run(body.modelA),
      body.modelB ? run(body.modelB) : Promise.resolve(null),
    ])
    return NextResponse.json({ success: true, a, b })
  } catch (err) {
    console.error('[POST /api/tutor/compare]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
