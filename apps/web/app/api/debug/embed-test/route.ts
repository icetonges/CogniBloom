import { NextRequest, NextResponse } from 'next/server'

const DEBUG_KEY = process.env['DEBUG_KEY'] ?? '979800'
const HF_TOKEN = process.env['HF_TOKEN'] ?? process.env['HUGGINGFACE_API_KEY'] ?? ''

/** Serialize an error including its .cause chain */
function serializeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const cause = (err as Error & { cause?: unknown }).cause
  return err.message + (cause ? ` → cause: ${serializeError(cause)}` : '')
}

async function tryFetch(label: string, url: string, body: unknown): Promise<{
  ok: boolean; status?: number; dims?: number; error?: string; latencyMs: number
}> {
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const latencyMs = Date.now() - t0
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, status: res.status, error: `HTTP ${res.status}: ${text.slice(0, 200)}`, latencyMs }
    }
    const data = await res.json() as number[] | number[][]
    const values: number[] = Array.isArray(data[0]) ? (data as number[][])[0] : (data as number[])
    return { ok: true, status: res.status, dims: values.length, latencyMs }
  } catch (err) {
    return { ok: false, error: serializeError(err), latencyMs: Date.now() - t0 }
  }
}

/**
 * GET /api/debug/embed-test?key=979800
 * Tests multiple HF endpoint formats + a connectivity ping to isolate the failure.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== DEBUG_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Basic internet connectivity check (no auth required)
  const pingResult = await (async () => {
    const t0 = Date.now()
    try {
      const r = await fetch('https://huggingface.co/api/health-check')
      return { ok: r.ok, status: r.status, latencyMs: Date.now() - t0 }
    } catch (err) {
      return { ok: false, error: serializeError(err), latencyMs: Date.now() - t0 }
    }
  })()

  const model = 'BAAI/bge-base-en-v1.5'
  const inputText = 'test embedding sentence'

  // 2. Old Inference API format
  const oldApi = await tryFetch(
    'old-api',
    `https://api-inference.huggingface.co/models/${model}`,
    { inputs: inputText, options: { wait_for_model: true } }
  )

  // 3. New Inference API v3 format
  const newApi = await tryFetch(
    'new-api',
    `https://router.huggingface.co/hf-inference/models/${model}/v1/feature-extraction`,
    { inputs: inputText }
  )

  // 4. Pipeline API format
  const pipelineApi = await tryFetch(
    'pipeline-api',
    `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`,
    { inputs: inputText }
  )

  return NextResponse.json({
    env: { hasHfToken: !!HF_TOKEN, tokenPrefix: HF_TOKEN ? HF_TOKEN.slice(0, 6) + '...' : null },
    connectivity: { 'huggingface.co health-check': pingResult },
    endpoints: {
      'api-inference (old)': oldApi,
      'router.huggingface.co (new v3)': newApi,
      'pipeline/feature-extraction': pipelineApi,
    },
    working: [oldApi, newApi, pipelineApi]
      .map((r, i) => ({ name: ['old', 'new-v3', 'pipeline'][i], ...r }))
      .filter(r => r.ok)
      .map(r => `${r.name} → ${r.dims} dims in ${r.latencyMs}ms`),
  })
}
