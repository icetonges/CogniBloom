import { NextRequest, NextResponse } from 'next/server'
import { getAIManager } from '@/lib/ai'
import { db } from '@/lib/db'

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

// GET /api/feed — return today's personalised feed
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get('refresh') === 'true'

    // Try to serve from DB cache (generated today)
    if (!refresh) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const cached = await db.dailyFeedItem.findMany({
        where: { createdAt: { gte: today } },
        take: 6,
        orderBy: { createdAt: 'asc' },
      })
      if (cached.length >= 4) {
        return NextResponse.json({
          success: true,
          data: cached.map(mapDbItem),
          meta: { cached: true, generatedAt: cached[0]?.createdAt },
        })
      }
    }

    // Generate fresh feed via AI
    const aiManager = getAIManager()
    const selected = shuffle(FEED_TOPICS).slice(0, 5)

    const items = await Promise.allSettled(
      selected.map(async (topic) => {
        const res = await aiManager.chat('gemini-2.0-flash', {
          messages: [
            {
              role: 'user',
              content: `Create ${topic.prompt} for a K-12 student. Be engaging, concise, and educational.

Return ONLY valid JSON:
{
  "title": "Short catchy title (max 10 words)",
  "body": "The main content (2-4 sentences, clear and engaging)",
  "difficulty": "easy|medium|hard",
  "estimatedMinutes": 2
}`,
            },
          ],
          temperature: 0.85,
          maxTokens: 400,
        })

        const raw = res.content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
        const parsed = JSON.parse(raw) as { title: string; body: string; difficulty: string; estimatedMinutes: number }

        // Persist to DB for caching
        const dbItem = await db.dailyFeedItem.create({
          data: {
            type: topic.type,
            title: parsed.title,
            description: parsed.body,
            content: parsed.body,
            subject: topic.subject,
            difficulty: parsed.difficulty || 'medium',
            gradeLevel: [5, 6, 7, 8, 9, 10],
            estimatedTime: parsed.estimatedMinutes || 2,
            isAiGenerated: true,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        })

        return {
          id: dbItem.id,
          type: topic.type as FeedItem['type'],
          emoji: topic.emoji,
          title: parsed.title,
          body: parsed.body,
          subject: topic.subject,
          difficulty: (parsed.difficulty || 'medium') as FeedItem['difficulty'],
          estimatedMinutes: parsed.estimatedMinutes || 2,
        } satisfies FeedItem
      })
    )

    const feed: FeedItem[] = items
      .filter((r): r is PromiseFulfilledResult<FeedItem> => r.status === 'fulfilled')
      .map((r) => r.value)

    return NextResponse.json({
      success: true,
      data: feed,
      meta: { cached: false, generatedAt: new Date() },
    })
  } catch (error) {
    console.error('[feed GET]', error)
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
