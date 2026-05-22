import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  fetchWikipediaSummary,
  fetchArxivPapers,
  ingestContent,
  K12_TOPICS,
  ARXIV_CATEGORIES,
  type IngestResult,
} from '@/lib/content'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function verifyAdmin(request: NextRequest): boolean {
  const secret = process.env['ADMIN_SECRET_KEY']
  if (!secret) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

// ─── Request schema ───────────────────────────────────────────────────────────

const IngestSchema = z.object({
  sources: z.array(z.enum(['khan-academy', 'edu-domains', 'arxiv'])),
  gradeRange: z.tuple([z.number(), z.number()]).optional(),
  categories: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(100).default(20),
})

// ─── Source handlers ──────────────────────────────────────────────────────────

async function ingestWikipediaTopics(topicKeys: string[], limit: number): Promise<IngestResult[]> {
  const results: IngestResult[] = []

  // Flatten all topics from the requested keys, deduplicate, apply limit
  const topics = topicKeys
    .flatMap((key) => K12_TOPICS[key] ?? [])
    .filter((v, i, arr) => arr.indexOf(v) === i) // unique
    .slice(0, limit)

  for (const topic of topics) {
    const wiki = await fetchWikipediaSummary(topic)
    if (!wiki) {
      results.push({ title: topic, status: 'failed', reason: 'Wikipedia fetch failed' })
      continue
    }

    const text = [
      `# ${wiki.title}`,
      wiki.description ? `*${wiki.description}*` : '',
      '',
      wiki.extract,
    ].filter(Boolean).join('\n')

    const r2Key = `system://wikipedia/${encodeURIComponent(wiki.title)}`
    const result = await ingestContent(r2Key, `${wiki.title}.md`, text)
    results.push(result)

    // Small pause to avoid hammering Wikipedia's API
    await new Promise((r) => setTimeout(r, 300))
  }

  return results
}

async function ingestArxiv(categories: string[], limit: number): Promise<IngestResult[]> {
  const results: IngestResult[] = []

  // Resolve category aliases from our catalogue
  const resolved: string[] = []
  for (const cat of categories) {
    const mapped = ARXIV_CATEGORIES[cat]
    if (mapped) resolved.push(...mapped)
    else resolved.push(cat) // pass through raw arXiv category codes like 'math.GR'
  }

  const papers = await fetchArxivPapers(resolved, limit)

  for (const paper of papers) {
    const text = [
      `# ${paper.title}`,
      paper.authors.length > 0 ? `*Authors: ${paper.authors.join(', ')}*` : '',
      paper.published ? `*Published: ${paper.published.slice(0, 10)}*` : '',
      '',
      paper.summary,
    ].filter(Boolean).join('\n')

    const r2Key = `system://arxiv/${encodeURIComponent(paper.id || paper.title)}`
    const result = await ingestContent(r2Key, `${paper.title.slice(0, 80)}.md`, text)
    results.push(result)
  }

  return results
}

// ─── POST /api/admin/content/ingest ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = IngestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const { sources, categories, limit } = parsed.data
  const allResults: IngestResult[] = []

  for (const source of sources) {
    if (source === 'khan-academy') {
      // K12 math + science topics — the core curriculum content
      const res = await ingestWikipediaTopics(['math', 'science'], Math.ceil(limit / 2))
      allResults.push(...res)
    }

    if (source === 'edu-domains') {
      // Broader K12 topics: history, English, computing
      const res = await ingestWikipediaTopics(['history', 'english', 'computing'], Math.ceil(limit / 2))
      allResults.push(...res)
    }

    if (source === 'arxiv') {
      const cats = categories ?? ['math', 'cs']
      const res = await ingestArxiv(cats, limit)
      allResults.push(...res)
    }
  }

  const ingested = allResults.filter((r) => r.status === 'ingested').length
  const skipped = allResults.filter((r) => r.status === 'skipped').length
  const failed = allResults.filter((r) => r.status === 'failed').length

  return NextResponse.json({
    success: true,
    summary: { ingested, skipped, failed, total: allResults.length },
    results: allResults,
  })
}
