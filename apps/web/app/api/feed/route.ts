import { NextRequest, NextResponse } from 'next/server'
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
  source?: string
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

// GET /api/feed — return today's personalised feed
export async function GET(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get('refresh') === 'true'

    // Try to serve from DB cache (generated today)
    if (!refresh) {
      const today = easternMidnight()
      const cached = await db.dailyFeedItem.findMany({
        where: { createdAt: { gte: today } },
        take: 8,
        orderBy: { createdAt: 'asc' },
      })
      if (cached.length >= 4) {
        return NextResponse.json({
          success: true,
          data: cached.map(mapDbItem),
          meta: { cached: true, generatedAt: cached[0]?.createdAt },
        })
      }

      // Fallback: serve most recent items from the last 7 days while we regenerate
      // (prevents "empty feed" flash on first load of a new day)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const recent = await db.dailyFeedItem.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        take: 8,
        orderBy: { createdAt: 'desc' },
      })
      if (recent.length >= 4) {
        // Return stale items immediately; client can refresh for fresh content
        return NextResponse.json({
          success: true,
          data: recent.map(mapDbItem),
          meta: { cached: true, stale: true, generatedAt: recent[0]?.createdAt },
        })
      }
    }

    // Load user preferences for personalisation
    const prefs = await db.userPreferences.findUnique({ where: { userId } })
    const userSubjects = prefs?.subjects?.length ? prefs.subjects : ['Math', 'Science']
    const userGrade = prefs?.grade ?? 'Year 9'

    // Weight topics: preferred subjects get 2 entries, others get 1
    const weightedTopics = FEED_TOPICS.flatMap((t) =>
      userSubjects.some((s) => t.subject.toLowerCase().includes(s.toLowerCase()))
        ? [t, t]
        : [t]
    )
    const selected = shuffle(weightedTopics).slice(0, 6)

    // Generate fresh feed via AI (with fallback across providers)
    const items = await Promise.allSettled(
      selected.map(async (topic) => {
        const res = await chatWithFallback({
          messages: [
            {
              role: 'user',
              content: `Create ${topic.prompt} for a ${userGrade} student. Be engaging, concise, and educational.

Return ONLY a JSON object — no explanation, no markdown fences, no preamble:
{"title":"Short catchy title (max 10 words)","body":"The main content (2-4 sentences, clear and engaging)","difficulty":"easy|medium|hard","estimatedMinutes":2}`,
            },
          ],
          temperature: 0.85,
          maxTokens: 400,
        })

        const parsed = extractJson(res.content)

        // Persist to DB for caching
        const dbItem = await db.dailyFeedItem.create({
          data: {
            type: topic.type,
            title: String(parsed.title ?? 'Untitled'),
            description: String(parsed.body ?? ''),
            content: String(parsed.body ?? ''),
            subject: topic.subject,
            difficulty: String(parsed.difficulty ?? 'medium'),
            gradeLevel: [5, 6, 7, 8, 9, 10],
            estimatedTime: Number(parsed.estimatedMinutes) || 2,
            isAiGenerated: true,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        })

        return {
          id: dbItem.id,
          type: topic.type as FeedItem['type'],
          emoji: topic.emoji,
          title: String(parsed.title ?? 'Untitled'),
          body: String(parsed.body ?? ''),
          subject: topic.subject,
          difficulty: (String(parsed.difficulty ?? 'medium')) as FeedItem['difficulty'],
          estimatedMinutes: Number(parsed.estimatedMinutes) || 2,
        } satisfies FeedItem
      })
    )

    const feed: FeedItem[] = items
      .filter((r): r is PromiseFulfilledResult<FeedItem> => r.status === 'fulfilled')
      .map((r) => r.value)

    // Log any failures for debugging
    const failures = items.filter((r) => r.status === 'rejected')
    if (failures.length > 0) {
      console.warn(`[feed] ${failures.length}/${items.length} items failed to generate`)
      failures.forEach((r, i) => {
        if (r.status === 'rejected') console.warn(`[feed] item ${i} error:`, r.reason)
      })
    }

    // If generation completely failed, serve stale items as last resort
    if (feed.length === 0) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const stale = await db.dailyFeedItem.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        take: 8,
        orderBy: { createdAt: 'desc' },
      })
      if (stale.length > 0) {
        return NextResponse.json({
          success: true,
          data: stale.map(mapDbItem),
          meta: { cached: true, stale: true, generatedAt: stale[0]?.createdAt },
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: feed,
      meta: { cached: false, generatedAt: new Date() },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function mapDbItem(item: {
  id: string; type: string; title: string; description: string;
  subject: string; difficulty: string; estimatedTime: number
}): FeedItem {
  const emojiMap: Record<string, string> = {
    Science: '🔬', History: '📜', Math: '🧮', Language: '📖',
    Logic: '🧩', 'Study Skills': '💡', Technology: '💻', Coding: '⚡',
  }
  return {
    id: item.id,
    type: item.type as FeedItem['type'],
    emoji: emojiMap[item.subject] || '📚',
    title: item.title,
    body: item.description,
    subject: item.subject,
    difficulty: item.difficulty as FeedItem['difficulty'],
    estimatedMinutes: item.estimatedTime,
  }
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}
