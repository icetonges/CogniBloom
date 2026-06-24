import { NextRequest, NextResponse, after } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { chatWithFallback } from '@/lib/ai/fallback'
import { easternMidnight } from '@/lib/timezone'

export const maxDuration = 60

export interface FeedItem {
  id: string
  type: 'fact' | 'challenge' | 'vocabulary' | 'puzzle' | 'tip'
  emoji: string
  title: string
  body: string
  subject: string
  difficulty: 'easy' | 'medium' | 'hard'
  estimatedMinutes: number
  sourceUrl?: string    // Original article URL or Wikipedia search
  sourceName?: string   // Human-readable source name (e.g. "FreeCodeCamp", "arXiv")
  createdAt?: string    // ISO date — used for date grouping in the UI
}

const FEED_TOPICS = [
  { type: 'fact', subject: 'Science', emoji: '🔬', prompt: 'a fascinating science fact that would surprise a student' },
  { type: 'fact', subject: 'History', emoji: '📜', prompt: 'an interesting historical fact most people do not know' },
  { type: 'challenge', subject: 'Math', emoji: '🧮', prompt: 'a fun math challenge problem with a step-by-step solution' },
  { type: 'vocabulary', subject: 'Language', emoji: '📖', prompt: 'a useful vocabulary word with definition, etymology, and example sentence' },
  { type: 'puzzle', subject: 'Logic', emoji: '🧩', prompt: 'a logic puzzle suitable for students, with the answer and explanation' },
  { type: 'tip', subject: 'Study Skills', emoji: '💡', prompt: 'a proven study tip or learning technique backed by science' },
  { type: 'fact', subject: 'Technology', emoji: '💻', prompt: 'an amazing technology or computer science fact' },
  { type: 'challenge', subject: 'Coding', emoji: '⚡', prompt: 'a beginner coding challenge with a hint and solution' },
]

/**
 * Robustly extract the first JSON object from any AI response.
 * Handles:
 *  - Bare JSON
 *  - Markdown code fences (```json ... ```)
 *  - Gemini thinking blocks (<thinking>...</thinking> prefix)
 *  - Any extra prose before/after the object
 */
function extractJson(text: string): Record<string, unknown> {
  // 1. Strip <thinking>...</thinking> and similar preamble tags
  const stripped = text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```json\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  // 2. Find the first {...} block — handles extra prose around the JSON
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`No JSON object found in AI response. Got: ${text.slice(0, 200)}`)

  return JSON.parse(match[0]) as Record<string, unknown>
}

const PAGE_SIZE = 8

/**
 * Build a Wikipedia search URL for a given topic/title.
 * This is always a valid, useful link even when the exact article name differs.
 */
function wikipediaUrl(title: string): string {
  return `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(title)}`
}

/**
 * One-time backfill: write a Wikipedia search URL into any DB row that has
 * sourceUrl = null (items created before this feature was added).
 * Runs in the background — never blocks the response.
 */
async function backfillSourceUrls(): Promise<void> {
  try {
    const missing = await db.dailyFeedItem.findMany({
      where: { sourceUrl: null },
      select: { id: true, title: true },
    })
    for (const item of missing) {
      await db.dailyFeedItem.update({
        where: { id: item.id },
        data: { sourceUrl: wikipediaUrl(item.title) },
      })
    }
  } catch {
    // Non-critical — ignore errors
  }
}

// GET /api/feed
// ?refresh=true        — force-regenerate today's feed
// ?page=N (default 1) — 1 = today's feed, 2+ = older history (8 items per page)
export async function GET(request: NextRequest) {
  // Patch any legacy items that are missing sourceUrl — runs after response, non-blocking
  after(() => backfillSourceUrls())

  try {
    const userId = DANIEL_USER_ID
    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get('refresh') === 'true'
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))

    // ── History pages (page 2+): older CategoryFeedItems + legacy DailyFeedItems ──
    if (page > 1) {
      const today = easternMidnight()
      const skip = (page - 2) * PAGE_SIZE

      // Try CategoryFeedItem history first
      try {
        const history = await db.categoryFeedItem.findMany({
          where: { createdAt: { lt: today } },
          orderBy: { createdAt: 'desc' },
          skip,
          take: PAGE_SIZE,
        })
        const total = await db.categoryFeedItem.count({ where: { createdAt: { lt: today } } })
        if (history.length > 0) {
          return NextResponse.json({
            success: true,
            data: history.map(mapCategoryItem),
            meta: { page, pageSize: PAGE_SIZE, total, hasMore: skip + history.length < total },
          })
        }
      } catch { /* table may not exist yet — fall through */ }

      // Legacy fallback
      const history = await db.dailyFeedItem.findMany({
        where: { createdAt: { lt: today } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      })
      const total = await db.dailyFeedItem.count({ where: { createdAt: { lt: today } } })
      return NextResponse.json({
        success: true,
        data: history.map(mapDbItem),
        meta: { page, pageSize: PAGE_SIZE, total, hasMore: skip + history.length < total },
      })
    }

    // ── Page 1: today's feed — prefer CategoryFeedItem (real sourced content) ──
    if (!refresh) {
      const today = easternMidnight()

      // 1. Try the new ingested category feed (real sources)
      try {
        const sourced = await db.categoryFeedItem.findMany({
          where: { createdAt: { gte: today } },
          orderBy: { createdAt: 'desc' },
          take: 60, // fetch more, then sample across categories
        })
        if (sourced.length >= 4) {
          // Pick up to 2 items per category for a diverse mix, cap at PAGE_SIZE
          const byCategory: Record<string, typeof sourced> = {}
          for (const item of sourced) {
            byCategory[item.category] ??= []
            byCategory[item.category]!.push(item)
          }
          const diverse: typeof sourced = []
          const groups = Object.values(byCategory)
          let round = 0
          while (diverse.length < PAGE_SIZE && round < 3) {
            for (const group of groups) {
              if (diverse.length >= PAGE_SIZE) break
              if (group[round]) diverse.push(group[round]!)
            }
            round++
          }
          return NextResponse.json({
            success: true,
            data: diverse.map(mapCategoryItem),
            meta: { cached: true, sourced: true, page: 1, generatedAt: sourced[0]?.createdAt },
          })
        }
      } catch { /* CategoryFeedItem table not yet migrated — fall through */ }

      // 2. Fall back to legacy DailyFeedItem cache
      const cached = await db.dailyFeedItem.findMany({
        where: { createdAt: { gte: today } },
        take: PAGE_SIZE,
        orderBy: { createdAt: 'asc' },
      })
      if (cached.length >= 4) {
        return NextResponse.json({
          success: true,
          data: cached.map(mapDbItem),
          meta: { cached: true, page: 1, generatedAt: cached[0]?.createdAt },
        })
      }

      // 3. Serve yesterday's items while we regenerate
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      const recent = await db.dailyFeedItem.findMany({
        where: { createdAt: { gte: yesterday, lt: today } },
        take: PAGE_SIZE,
        orderBy: { createdAt: 'desc' },
      })
      if (recent.length >= 4) {
        return NextResponse.json({
          success: true,
          data: recent.map(mapDbItem),
          meta: { cached: true, stale: true, page: 1, generatedAt: recent[0]?.createdAt },
        })
      }
    }

    // ── Generate fresh today's feed ───────────────────────────────────────────
    const prefs = await db.userPreferences.findUnique({ where: { userId } })
    const userSubjects = prefs?.subjects?.length ? prefs.subjects : ['Math', 'Science']
    const userGrade = prefs?.grade ?? 'Year 9'

    const weightedTopics = FEED_TOPICS.flatMap((t) =>
      userSubjects.some((s) => t.subject.toLowerCase().includes(s.toLowerCase()))
        ? [t, t]
        : [t]
    )
    const selected = shuffle(weightedTopics).slice(0, 6)

    const items = await Promise.allSettled(
      selected.map(async (topic) => {
        const res = await chatWithFallback({
          messages: [
            {
              role: 'user',
              content: `Create ${topic.prompt} for a ${userGrade} student. Be engaging, concise, and educational.

Return ONLY a JSON object — no explanation, no markdown fences, no preamble:
{"title":"Short catchy title (max 10 words)","body":"The main content (2-4 sentences, clear and engaging)","difficulty":"easy|medium|hard","estimatedMinutes":2,"sourceTopic":"The most precise Wikipedia article title for further reading on this topic"}`,
            },
          ],
          temperature: 0.85,
          maxTokens: 450,
        })

        const parsed = extractJson(res.content)

        const title = String(parsed['title'] ?? 'Untitled')
        const body = String(parsed['body'] ?? '')
        const difficulty = String(parsed['difficulty'] ?? 'medium')
        const estimatedMinutes = Number(parsed['estimatedMinutes']) || 2
        const sourceTopic = String(parsed['sourceTopic'] ?? title)
        const sourceUrl = wikipediaUrl(sourceTopic)

        const dbItem = await db.dailyFeedItem.create({
          data: {
            type: topic.type,
            title,
            description: body,
            content: body,
            subject: topic.subject,
            difficulty,
            gradeLevel: [5, 6, 7, 8, 9, 10],
            estimatedTime: estimatedMinutes,
            isAiGenerated: true,
            sourceUrl,
            // Keep indefinitely — never expires; history is valuable
            expiresAt: new Date('2099-01-01'),
          },
        })

        return {
          id: dbItem.id,
          type: topic.type as FeedItem['type'],
          emoji: topic.emoji,
          title,
          body,
          subject: topic.subject,
          difficulty: difficulty as FeedItem['difficulty'],
          estimatedMinutes,
          sourceUrl,
          createdAt: dbItem.createdAt.toISOString(),
        } as FeedItem
      })
    )

    const feed: FeedItem[] = items
      .filter((r): r is PromiseFulfilledResult<FeedItem> => r.status === 'fulfilled')
      .map((r) => r.value)

    const failures = items.filter((r) => r.status === 'rejected')
    if (failures.length > 0) {
      console.warn(`[feed] ${failures.length}/${items.length} items failed to generate`)
    }

    // Last resort: serve most recent DB items
    if (feed.length === 0) {
      const stale = await db.dailyFeedItem.findMany({
        orderBy: { createdAt: 'desc' },
        take: PAGE_SIZE,
      })
      if (stale.length > 0) {
        return NextResponse.json({
          success: true,
          data: stale.map(mapDbItem),
          meta: { cached: true, stale: true, page: 1, generatedAt: stale[0]?.createdAt },
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: feed,
      meta: { cached: false, page: 1, generatedAt: new Date() },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function mapDbItem(item: {
  id: string; type: string; title: string; description: string;
  subject: string; difficulty: string; estimatedTime: number;
  sourceUrl: string | null; createdAt: Date;
}): FeedItem {
  const emojiMap: Record<string, string> = {
    Science: '🔬', History: '📜', Math: '🧮', Language: '📖',
    Logic: '🧩', 'Study Skills': '💡', Technology: '💻', Coding: '⚡',
  }
  return {
    id: item.id,
    type: item.type as FeedItem['type'],
    emoji: emojiMap[item.subject] ?? '📚',
    title: item.title,
    body: item.description,
    subject: item.subject,
    difficulty: item.difficulty as FeedItem['difficulty'],
    estimatedMinutes: item.estimatedTime,
    // Fall back to a Wikipedia search URL derived from the title so that
    // items created before sourceUrl was introduced still show a link.
    sourceUrl: item.sourceUrl ?? wikipediaUrl(item.title),
    createdAt: item.createdAt.toISOString(),
  }
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

/** Map a CategoryFeedItem (new sourced system) → FeedItem (UI interface) */
function mapCategoryItem(item: {
  id: string
  category: string
  title: string
  summary: string
  body: string | null
  url: string | null
  emoji: string
  difficulty: string
  estimatedMinutes: number
  contentType: string
  isAiGenerated: boolean
  sourceName: string | null
  createdAt: Date
}): FeedItem {
  // Map contentType → FeedItem type
  const typeMap: Record<string, FeedItem['type']> = {
    challenge: 'challenge',
    vocabulary: 'vocabulary',
    puzzle: 'puzzle',
    tip: 'tip',
    article: 'fact',
    fact: 'fact',
  }
  // Capitalise category slug for display ("growth-mindset" → "Growth Mindset")
  const subject = item.category
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  // Use full body if available, else fall back to summary
  const bodyText = item.body?.trim() || item.summary

  return {
    id: item.id,
    type: typeMap[item.contentType] ?? 'fact',
    emoji: item.emoji || '📚',
    title: item.title,
    body: bodyText,
    subject,
    difficulty: (item.difficulty as FeedItem['difficulty']) ?? 'medium',
    estimatedMinutes: item.estimatedMinutes ?? 3,
    sourceUrl: item.url ?? undefined,
    sourceName: item.sourceName ?? undefined,
    createdAt: item.createdAt.toISOString(),
  }
}
