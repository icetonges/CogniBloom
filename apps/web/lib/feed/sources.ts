/**
 * Feed source registry — all 13 learning categories.
 *
 * Each source describes where to pull content and how to normalize it.
 * Sources that can't be fetched fall back to the AI generator automatically.
 */

import { fetchRss, type RssItem } from './rss'
import { chatWithFallback } from '@/lib/ai/fallback'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Category =
  | 'math'
  | 'coding'
  | 'science'
  | 'writing'
  | 'vocabulary'
  | 'public-speaking'
  | 'debate'
  | 'leadership'
  | 'growth-mindset'
  | 'current-events'
  | 'projects'
  | 'robotics'
  | 'wiki'
  | 'ai'

export interface RawItem {
  title: string
  summary: string
  body?: string
  url?: string
  imageUrl?: string
  tags?: string[]
  difficulty?: 'easy' | 'medium' | 'hard'
  estimatedMinutes?: number
  contentType?: string
  author?: string
  publishedAt?: Date
  isAiGenerated?: boolean
  emoji?: string
}

export interface SourceDef {
  id: string           // unique slug, e.g. "hacker-news-coding"
  name: string         // human label, e.g. "Hacker News"
  category: Category
  url: string          // "" for AI-only
  type: 'rss' | 'api' | 'ai'
  description: string
  pull: () => Promise<RawItem[]>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s
}

/** Parse an AI JSON response into a RawItem */
async function aiGenerate(
  prompt: string,
  category: Category,
  emoji: string,
  contentType = 'article',
): Promise<RawItem | null> {
  try {
    const res = await chatWithFallback({
      messages: [
        {
          role: 'user',
          content: `${prompt}

Return ONLY a JSON object, no markdown fences:
{"title":"Short catchy title (max 12 words)","summary":"2-3 sentences for a preview","body":"The full content (4-6 sentences, educational and engaging)","difficulty":"easy|medium|hard","estimatedMinutes":3,"tags":["tag1","tag2"],"url":""}`,
        },
      ],
      temperature: 0.85,
      maxTokens: 500,
    })

    const text = res.content
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/```json\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    return {
      title: String(parsed['title'] ?? 'Learning Bite'),
      summary: String(parsed['summary'] ?? ''),
      body: String(parsed['body'] ?? ''),
      url: String(parsed['url'] ?? ''),
      tags: Array.isArray(parsed['tags']) ? (parsed['tags'] as string[]) : [category],
      difficulty: (parsed['difficulty'] as 'easy' | 'medium' | 'hard') ?? 'medium',
      estimatedMinutes: Number(parsed['estimatedMinutes']) || 3,
      contentType,
      isAiGenerated: true,
      emoji,
    }
  } catch {
    return null
  }
}

/** Map RSS items to RawItems (shared normalizer) */
function rssToItems(
  items: RssItem[],
  category: Category,
  emoji: string,
  contentType = 'article',
  tagsExtra: string[] = [],
): RawItem[] {
  return items
    .filter((i) => i.title && i.title !== 'Untitled')
    .map((i) => ({
      title: truncate(i.title, 120),
      summary: truncate(i.description || i.title, 400),
      url: i.link || undefined,
      imageUrl: i.imageUrl || undefined,
      tags: [category, ...tagsExtra],
      difficulty: 'medium' as const,
      estimatedMinutes: 3,
      contentType,
      author: i.author,
      publishedAt: i.pubDate ? new Date(i.pubDate) : undefined,
      isAiGenerated: false,
      emoji,
    }))
}

// ─── Source definitions ───────────────────────────────────────────────────────

export const FEED_SOURCES: SourceDef[] = [

  // ──────────────────────────────── MATH ──────────────────────────────────────

  {
    id: 'arxiv-math',
    name: 'arXiv Mathematics',
    category: 'math',
    url: 'https://export.arxiv.org/rss/math.HO',
    type: 'rss',
    description: 'Mathematics history and overview from arXiv preprint server',
    async pull() {
      const items = await fetchRss('https://export.arxiv.org/rss/math.HO', 5)
      return rssToItems(items, 'math', '🧮', 'article', ['research', 'mathematics'])
    },
  },
  {
    id: 'arxiv-math-puzzles',
    name: 'arXiv Combinatorics',
    category: 'math',
    url: 'https://export.arxiv.org/rss/math.CO',
    type: 'rss',
    description: 'Combinatorics and graph theory — great for puzzle thinking',
    async pull() {
      const items = await fetchRss('https://export.arxiv.org/rss/math.CO', 4)
      return rssToItems(items, 'math', '🧩', 'article', ['combinatorics', 'puzzles'])
    },
  },
  {
    id: 'ai-math',
    name: 'AI Math Challenge',
    category: 'math',
    url: '',
    type: 'ai',
    description: 'AI-generated math challenges and concepts for honors students',
    async pull() {
      const prompts = [
        'Create a challenging but accessible math problem for a middle school honors student, with a step-by-step solution and the underlying concept explained',
        'Explain a surprising or counterintuitive mathematical fact that would fascinate a 12-14 year old honors student',
        'Create a number theory puzzle suitable for AMC 8/10 preparation, with hint and full solution',
      ]
      const prompt = prompts[Math.floor(Math.random() * prompts.length)]!
      const item = await aiGenerate(prompt, 'math', '🧮', 'challenge')
      return item ? [item] : []
    },
  },

  // ──────────────────────────────── CODING ────────────────────────────────────

  {
    id: 'hacker-news-coding',
    name: 'Hacker News',
    category: 'coding',
    url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    type: 'api',
    description: 'Top technology and programming stories from Hacker News',
    async pull() {
      try {
        const idsRes = await fetch(
          'https://hacker-news.firebaseio.com/v0/topstories.json',
          { signal: AbortSignal.timeout(10_000) }
        )
        const ids = (await idsRes.json() as number[]).slice(0, 12)
        const stories = await Promise.allSettled(
          ids.map((id) =>
            fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
              signal: AbortSignal.timeout(8_000),
            }).then((r) => r.json())
          )
        )
        return stories
          .filter((s): s is PromiseFulfilledResult<Record<string, unknown>> => s.status === 'fulfilled' && s.value?.title)
          .map((s) => ({
            title: truncate(String(s.value.title), 120),
            summary: `Trending on Hacker News${s.value.score ? ` · ${s.value.score} points` : ''}${s.value.descendants ? ` · ${s.value.descendants} comments` : ''}`,
            url: String(s.value.url || `https://news.ycombinator.com/item?id=${s.value.id}`),
            tags: ['hacker-news', 'coding', 'tech'],
            difficulty: 'medium' as const,
            estimatedMinutes: 5,
            contentType: 'article',
            publishedAt: s.value.time ? new Date((s.value.time as number) * 1000) : undefined,
            isAiGenerated: false,
            emoji: '⚡',
          }))
          .slice(0, 6)
      } catch {
        return []
      }
    },
  },
  {
    id: 'devto-coding',
    name: 'DEV.to',
    category: 'coding',
    url: 'https://dev.to/api/articles?tag=beginners&per_page=6',
    type: 'api',
    description: 'Beginner-friendly coding articles from DEV Community',
    async pull() {
      try {
        const res = await fetch(
          'https://dev.to/api/articles?tag=beginners&per_page=6&sort_by=published_at',
          { headers: { 'User-Agent': 'CogniBloom-FeedBot/1.0' }, signal: AbortSignal.timeout(10_000) }
        )
        if (!res.ok) return []
        const articles = await res.json() as Array<Record<string, unknown>>
        return articles.map((a) => ({
          title: truncate(String(a['title'] ?? 'Article'), 120),
          summary: truncate(String(a['description'] ?? ''), 400),
          url: String(a['url'] ?? ''),
          imageUrl: a['cover_image'] ? String(a['cover_image']) : undefined,
          tags: ((a['tag_list'] as string[]) ?? ['coding']).slice(0, 4),
          difficulty: 'easy' as const,
          estimatedMinutes: Number(a['reading_time_minutes']) || 4,
          contentType: 'article',
          author: a['user'] ? String((a['user'] as Record<string, unknown>)['name'] ?? '') : undefined,
          publishedAt: a['published_at'] ? new Date(String(a['published_at'])) : undefined,
          isAiGenerated: false,
          emoji: '💻',
        }))
      } catch {
        return []
      }
    },
  },
  {
    id: 'arxiv-cs-ai',
    name: 'arXiv CS / AI',
    category: 'coding',
    url: 'https://export.arxiv.org/rss/cs.PL',
    type: 'rss',
    description: 'Programming languages research from arXiv',
    async pull() {
      const items = await fetchRss('https://export.arxiv.org/rss/cs.PL', 4)
      return rssToItems(items, 'coding', '🔬', 'article', ['research', 'computer-science'])
    },
  },
  {
    id: 'ai-coding',
    name: 'AI Coding Challenge',
    category: 'coding',
    url: '',
    type: 'ai',
    description: 'AI-generated beginner coding challenges with solutions',
    async pull() {
      const prompts = [
        'Create a beginner Python coding challenge for a middle school student (age 12-14) with a hint, full solution, and explanation of the concept',
        'Explain a fundamental computer science concept (like recursion, loops, or data structures) in an engaging way for a young coder with a mini-project idea',
        'Create a fun JavaScript or Scratch-style logic challenge for a young programmer, include expected output and solution',
      ]
      const prompt = prompts[Math.floor(Math.random() * prompts.length)]!
      const item = await aiGenerate(prompt, 'coding', '💻', 'challenge')
      return item ? [item] : []
    },
  },

  // ──────────────────────────────── SCIENCE ───────────────────────────────────

  {
    id: 'nasa-apod',
    name: 'NASA APOD',
    category: 'science',
    url: 'https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY',
    type: 'api',
    description: 'NASA Astronomy Picture of the Day with explanation',
    async pull() {
      try {
        const res = await fetch(
          'https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&thumbs=true',
          { signal: AbortSignal.timeout(10_000) }
        )
        if (!res.ok) return []
        const data = await res.json() as Record<string, unknown>
        return [{
          title: String(data['title'] ?? 'Astronomy Picture of the Day'),
          summary: truncate(String(data['explanation'] ?? ''), 400),
          body: String(data['explanation'] ?? ''),
          url: 'https://apod.nasa.gov/apod/astropix.html',
          imageUrl: String(data['thumbnail_url'] ?? data['url'] ?? ''),
          tags: ['nasa', 'astronomy', 'space'],
          difficulty: 'medium' as const,
          estimatedMinutes: 4,
          contentType: 'article',
          publishedAt: data['date'] ? new Date(String(data['date'])) : new Date(),
          isAiGenerated: false,
          emoji: '🔭',
        }]
      } catch {
        return []
      }
    },
  },
  {
    id: 'arxiv-physics',
    name: 'arXiv Physics (Popular)',
    category: 'science',
    url: 'https://export.arxiv.org/rss/physics.pop-ph',
    type: 'rss',
    description: 'Popular physics articles from arXiv preprint server',
    async pull() {
      const items = await fetchRss('https://export.arxiv.org/rss/physics.pop-ph', 5)
      return rssToItems(items, 'science', '🔬', 'article', ['physics', 'research'])
    },
  },
  {
    id: 'arxiv-bio',
    name: 'arXiv Quantitative Biology',
    category: 'science',
    url: 'https://export.arxiv.org/rss/q-bio.PE',
    type: 'rss',
    description: 'Biology and ecology research papers',
    async pull() {
      const items = await fetchRss('https://export.arxiv.org/rss/q-bio.PE', 4)
      return rssToItems(items, 'science', '🧬', 'article', ['biology', 'ecology'])
    },
  },
  {
    id: 'ai-science',
    name: 'AI Science Fact',
    category: 'science',
    url: '',
    type: 'ai',
    description: 'AI-generated fascinating science facts and experiments',
    async pull() {
      const prompts = [
        'Share a fascinating and surprising science fact from physics, chemistry, or biology that would captivate a middle school honors student, with a simple experiment or thought experiment to try',
        'Explain a cutting-edge science discovery or concept from 2024-2025 in a way a 12-14 year old would understand and find exciting',
        'Describe a real scientific mystery that scientists are still trying to solve, explained for curious middle school students',
      ]
      const prompt = prompts[Math.floor(Math.random() * prompts.length)]!
      const item = await aiGenerate(prompt, 'science', '🔬', 'fact')
      return item ? [item] : []
    },
  },

  // ──────────────────────────────── WRITING ───────────────────────────────────

  {
    id: 'ai-writing-prompt',
    name: 'AI Writing Prompt',
    category: 'writing',
    url: '',
    type: 'ai',
    description: 'AI-generated creative and expository writing prompts',
    async pull() {
      const prompts = [
        'Create an engaging creative writing prompt for a middle school student, include the prompt itself, 3 story starter options, and tips for strong writing',
        'Create a persuasive writing challenge for an honors middle schooler: provide the topic, two perspectives to consider, and a mini-outline framework',
        'Create an expository writing exercise for a 12-14 year old: give a fascinating topic, key points to research, and a paragraph structure guide',
      ]
      const prompt = prompts[Math.floor(Math.random() * prompts.length)]!
      const item = await aiGenerate(prompt, 'writing', '✍️', 'challenge')
      return item ? [item] : []
    },
  },
  {
    id: 'ai-writing-technique',
    name: 'Writing Technique',
    category: 'writing',
    url: '',
    type: 'ai',
    description: 'AI-generated writing skills and techniques lessons',
    async pull() {
      const prompts = [
        'Teach one powerful writing technique (e.g., show don\'t tell, varied sentence structure, strong verbs) with a bad example, improved version, and a mini-exercise',
        'Explain how to write a compelling introduction — hook, background, thesis — with a before/after example for middle school students',
        'Teach the art of descriptive writing with sensory details: include examples and a 5-minute practice exercise',
      ]
      const prompt = prompts[Math.floor(Math.random() * prompts.length)]!
      const item = await aiGenerate(prompt, 'writing', '📝', 'tip')
      return item ? [item] : []
    },
  },

  // ──────────────────────────────── VOCABULARY ─────────────────────────────────

  {
    id: 'merriam-webster-wotd',
    name: 'Merriam-Webster Word of the Day',
    category: 'vocabulary',
    url: 'https://www.merriam-webster.com/wotd/feed/rss2',
    type: 'rss',
    description: 'Daily vocabulary word with definition and etymology from Merriam-Webster',
    async pull() {
      const items = await fetchRss('https://www.merriam-webster.com/wotd/feed/rss2', 3)
      return rssToItems(items, 'vocabulary', '📖', 'vocabulary', ['word-of-the-day', 'english'])
    },
  },
  {
    id: 'ai-vocabulary',
    name: 'AI Vocabulary Builder',
    category: 'vocabulary',
    url: '',
    type: 'ai',
    description: 'AI-generated vocabulary words with etymology, context, and usage',
    async pull() {
      const prompts = [
        'Teach an advanced vocabulary word useful for honors middle school essays and tests: include the word, pronunciation guide, etymology/origin, multiple definitions, 3 example sentences, and a memory trick',
        'Introduce a "power word" — a sophisticated synonym for a common word — with etymology, usage examples, and common misusages to avoid. Target age: 12-14',
        'Explain the difference between two commonly confused words (e.g., affect/effect, principal/principle) with clear rules and memorable examples',
      ]
      const prompt = prompts[Math.floor(Math.random() * prompts.length)]!
      const item = await aiGenerate(prompt, 'vocabulary', '📖', 'vocabulary')
      return item ? [item] : []
    },
  },

  // ──────────────────────────────── PUBLIC SPEAKING ────────────────────────────

  {
    id: 'ted-talks',
    name: 'TED Talks',
    category: 'public-speaking',
    url: 'https://feeds.feedburner.com/TedtalksHD',
    type: 'rss',
    description: 'TED Talks on communication, ideas, and public speaking',
    async pull() {
      const items = await fetchRss('https://feeds.feedburner.com/TedtalksHD', 4)
      if (items.length === 0) {
        // fallback to TED-Ed
        const alt = await fetchRss('https://feeds.feedburner.com/TEDxTalks', 4)
        return rssToItems(alt, 'public-speaking', '🎤', 'video', ['ted', 'speaking'])
      }
      return rssToItems(items, 'public-speaking', '🎤', 'video', ['ted', 'speaking'])
    },
  },
  {
    id: 'ai-public-speaking',
    name: 'AI Speaking Coach',
    category: 'public-speaking',
    url: '',
    type: 'ai',
    description: 'AI-generated public speaking tips, exercises, and speech topics',
    async pull() {
      const prompts = [
        'Provide a daily public speaking challenge for a middle school student: include a 2-minute speech topic, 3 key points to cover, tips for confident delivery, and how to handle nerves',
        'Teach one specific public speaking skill (e.g., eye contact, vocal variety, pausing for effect) with a practical exercise and a self-assessment checklist',
        'Create a mini debate/presentation topic for a 12-14 year old with both perspectives outlined, key vocabulary, and delivery tips',
      ]
      const prompt = prompts[Math.floor(Math.random() * prompts.length)]!
      const item = await aiGenerate(prompt, 'public-speaking', '🎤', 'challenge')
      return item ? [item] : []
    },
  },

  // ──────────────────────────────── DEBATE ────────────────────────────────────

  {
    id: 'ai-debate',
    name: 'AI Debate Topic',
    category: 'debate',
    url: '',
    type: 'ai',
    description: 'AI-generated debate topics with arguments for both sides',
    async pull() {
      const prompts = [
        'Create a middle school debate topic with clear affirmative and negative positions, 3 arguments per side, evidence examples, and tips for rebuttal',
        'Design a Socratic seminar discussion for 12-14 year olds: provide an interesting ethical dilemma, key questions to explore, and vocabulary for thoughtful discussion',
        'Create a Lincoln-Douglas style debate prompt for middle schoolers with value premise and criterion on each side',
      ]
      const prompt = prompts[Math.floor(Math.random() * prompts.length)]!
      const item = await aiGenerate(prompt, 'debate', '⚖️', 'challenge')
      return item ? [item] : []
    },
  },
  {
    id: 'hacker-news-debate',
    name: 'Tech Debate (Hacker News)',
    category: 'debate',
    url: 'https://hacker-news.firebaseio.com/v0/askstories.json',
    type: 'api',
    description: 'Ask HN discussion threads that spark critical thinking',
    async pull() {
      try {
        const idsRes = await fetch('https://hacker-news.firebaseio.com/v0/askstories.json', {
          signal: AbortSignal.timeout(8_000),
        })
        const ids = (await idsRes.json() as number[]).slice(0, 6)
        const stories = await Promise.allSettled(
          ids.map((id) =>
            fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
              signal: AbortSignal.timeout(6_000),
            }).then((r) => r.json())
          )
        )
        return stories
          .filter((s): s is PromiseFulfilledResult<Record<string, unknown>> => s.status === 'fulfilled' && s.value?.title)
          .map((s) => ({
            title: truncate(String(s.value.title), 120),
            summary: truncate(String(s.value.text ?? s.value.title), 400),
            url: `https://news.ycombinator.com/item?id=${s.value.id}`,
            tags: ['debate', 'discussion', 'hacker-news'],
            difficulty: 'medium' as const,
            estimatedMinutes: 5,
            contentType: 'article',
            isAiGenerated: false,
            emoji: '⚖️',
          }))
          .slice(0, 3)
      } catch {
        return []
      }
    },
  },

  // ──────────────────────────────── LEADERSHIP ────────────────────────────────

  {
    id: 'ai-leadership',
    name: 'AI Leadership Lesson',
    category: 'leadership',
    url: '',
    type: 'ai',
    description: 'AI-generated leadership principles, stories, and challenges',
    async pull() {
      const prompts = [
        'Share a leadership lesson from a historical or modern leader with a real story/example, the principle illustrated, and a reflection question for a 12-14 year old',
        'Teach one key leadership skill (e.g., active listening, decision-making, conflict resolution) with a scenario exercise for middle school students',
        'Share an inspiring story of youth leadership — someone who made a difference at a young age — with 3 lessons and how to apply them',
      ]
      const prompt = prompts[Math.floor(Math.random() * prompts.length)]!
      const item = await aiGenerate(prompt, 'leadership', '🌟', 'tip')
      return item ? [item] : []
    },
  },
  {
    id: 'ted-leadership',
    name: 'TED Leadership Talks',
    category: 'leadership',
    url: 'https://feeds.feedburner.com/TedtalksHD',
    type: 'rss',
    description: 'TED Talks on leadership, purpose, and success',
    async pull() {
      const items = await fetchRss('https://feeds.feedburner.com/TedtalksHD', 4)
      return rssToItems(items, 'leadership', '🌟', 'video', ['ted', 'leadership', 'growth'])
    },
  },

  // ──────────────────────────────── GROWTH MINDSET ────────────────────────────

  {
    id: 'ai-growth-mindset',
    name: 'AI Growth Mindset',
    category: 'growth-mindset',
    url: '',
    type: 'ai',
    description: 'AI-generated growth mindset lessons backed by psychology research',
    async pull() {
      const prompts = [
        'Share a growth mindset lesson based on Carol Dweck\'s research with a real student scenario, a fixed vs. growth mindset comparison, and a daily habit to build resilience in a 12-14 year old',
        'Explain the neuroscience of learning (neuroplasticity, deliberate practice) for a middle schooler — make it exciting and motivating with a self-improvement challenge',
        'Share a story about overcoming failure and how it led to success (real or composite), with 3 actionable strategies for a young student facing academic challenges',
      ]
      const prompt = prompts[Math.floor(Math.random() * prompts.length)]!
      const item = await aiGenerate(prompt, 'growth-mindset', '🌱', 'tip')
      return item ? [item] : []
    },
  },

  // ──────────────────────────────── CURRENT EVENTS ────────────────────────────

  {
    id: 'hacker-news-current',
    name: 'Hacker News (Tech News)',
    category: 'current-events',
    url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    type: 'api',
    description: 'Top technology and science news from Hacker News',
    async pull() {
      try {
        const idsRes = await fetch('https://hacker-news.firebaseio.com/v0/newstories.json', {
          signal: AbortSignal.timeout(10_000),
        })
        const ids = (await idsRes.json() as number[]).slice(0, 15)
        const stories = await Promise.allSettled(
          ids.map((id) =>
            fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
              signal: AbortSignal.timeout(6_000),
            }).then((r) => r.json())
          )
        )
        return stories
          .filter((s): s is PromiseFulfilledResult<Record<string, unknown>> => s.status === 'fulfilled' && s.value?.url && s.value?.title)
          .map((s) => ({
            title: truncate(String(s.value.title), 120),
            summary: `Latest news from Hacker News${s.value.score ? ` · ${s.value.score} points` : ''}`,
            url: String(s.value.url),
            tags: ['news', 'technology', 'current-events'],
            difficulty: 'medium' as const,
            estimatedMinutes: 4,
            contentType: 'article',
            publishedAt: s.value.time ? new Date((s.value.time as number) * 1000) : undefined,
            isAiGenerated: false,
            emoji: '📰',
          }))
          .slice(0, 6)
      } catch {
        return []
      }
    },
  },
  {
    id: 'ai-current-events',
    name: 'AI Current Events',
    category: 'current-events',
    url: '',
    type: 'ai',
    description: 'AI-generated current events analysis for critical thinkers',
    async pull() {
      const item = await aiGenerate(
        'Describe a significant recent event in science, technology, society, or global affairs (2025) that would fascinate a honors middle school student. Include what happened, why it matters, different perspectives, and a discussion question',
        'current-events',
        '📰',
        'article'
      )
      return item ? [item] : []
    },
  },

  // ──────────────────────────────── PROJECTS ───────────────────────────────────

  {
    id: 'github-trending',
    name: 'GitHub Trending',
    category: 'projects',
    url: 'https://github.com/trending',
    type: 'api',
    description: 'Trending open-source projects on GitHub',
    async pull() {
      try {
        // Use GitHub search API (no auth needed for basic searches)
        const res = await fetch(
          'https://api.github.com/search/repositories?q=stars:%3E100+created:%3E2025-01-01&sort=stars&order=desc&per_page=6',
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'CogniBloom-FeedBot/1.0',
            },
            signal: AbortSignal.timeout(10_000),
          }
        )
        if (!res.ok) return []
        const data = await res.json() as Record<string, unknown>
        const repos = (data['items'] as Record<string, unknown>[]) ?? []
        return repos.map((r) => ({
          title: `${String(r['name'])} by ${String((r['owner'] as Record<string, unknown>)?.['login'] ?? '')}`,
          summary: truncate(String(r['description'] ?? 'Open-source project'), 400),
          url: String(r['html_url'] ?? ''),
          tags: ['github', 'open-source', 'project', String(r['language'] ?? 'code').toLowerCase()].filter(Boolean),
          difficulty: 'medium' as const,
          estimatedMinutes: 5,
          contentType: 'article',
          isAiGenerated: false,
          emoji: '🚀',
        })).slice(0, 5)
      } catch {
        return []
      }
    },
  },
  {
    id: 'ai-projects',
    name: 'AI Project Idea',
    category: 'projects',
    url: '',
    type: 'ai',
    description: 'AI-generated hands-on project ideas for curious students',
    async pull() {
      const prompts = [
        'Design a fun beginner coding project for a 12-14 year old to build in Python or JavaScript: include what it does, step-by-step plan, skills learned, and extension ideas',
        'Create a science + engineering project idea that a middle school student can build at home or school, with materials list, steps, and the concept it demonstrates',
        'Suggest a creative maker/DIY project combining coding and physical building (like a basic robot or smart device) for an honors middle school student',
      ]
      const prompt = prompts[Math.floor(Math.random() * prompts.length)]!
      const item = await aiGenerate(prompt, 'projects', '🚀', 'challenge')
      return item ? [item] : []
    },
  },

  // ──────────────────────────────── ROBOTICS ───────────────────────────────────

  {
    id: 'arduino-blog',
    name: 'Arduino Blog',
    category: 'robotics',
    url: 'https://blog.arduino.cc/feed/',
    type: 'rss',
    description: 'Latest projects and news from the Arduino community',
    async pull() {
      const items = await fetchRss('https://blog.arduino.cc/feed/', 5)
      return rssToItems(items, 'robotics', '🤖', 'article', ['arduino', 'hardware', 'maker'])
    },
  },
  {
    id: 'hackster-robotics',
    name: 'Hackster.io',
    category: 'robotics',
    url: 'https://www.hackster.io/news.atom',
    type: 'rss',
    description: 'Hardware and robotics project news from Hackster.io',
    async pull() {
      const items = await fetchRss('https://www.hackster.io/news.atom', 5)
      return rssToItems(items, 'robotics', '🤖', 'article', ['robotics', 'hardware', 'maker'])
    },
  },
  {
    id: 'ai-robotics',
    name: 'AI Robotics Lesson',
    category: 'robotics',
    url: '',
    type: 'ai',
    description: 'AI-generated robotics concepts and project ideas',
    async pull() {
      const prompts = [
        'Explain a key robotics concept (sensors, actuators, PID control, path planning) for a middle school student interested in FIRST Robotics or VEX, with a simple experiment',
        'Describe a real-world robotics application (medical robots, autonomous vehicles, space robots) and the engineering principles behind it, aimed at 12-14 year olds',
        'Create a beginner robotics/electronics project using Arduino or Raspberry Pi for an honors middle schooler, with components list and code snippets',
      ]
      const prompt = prompts[Math.floor(Math.random() * prompts.length)]!
      const item = await aiGenerate(prompt, 'robotics', '🤖', 'challenge')
      return item ? [item] : []
    },
  },

  // ──────────────────────────────── WIKI ───────────────────────────────────────

  {
    id: 'wikipedia-featured',
    name: 'Wikipedia Featured Article',
    category: 'wiki',
    url: 'https://en.wikipedia.org/api/rest_v1/feed/featured/{date}',
    type: 'api',
    description: "Today's Wikipedia Featured Article — the best content on Wikipedia",
    async pull() {
      try {
        const now = new Date()
        const y = now.getUTCFullYear()
        const m = String(now.getUTCMonth() + 1).padStart(2, '0')
        const d = String(now.getUTCDate()).padStart(2, '0')
        const res = await fetch(
          `https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${d}`,
          { headers: { 'User-Agent': 'CogniBloom-FeedBot/1.0' }, signal: AbortSignal.timeout(10_000) }
        )
        if (!res.ok) return []
        const data = await res.json() as Record<string, unknown>
        const tfa = data['tfa'] as Record<string, unknown> | undefined
        if (!tfa) return []
        const title = String(tfa['normalizedtitle'] ?? tfa['title'] ?? 'Wikipedia Featured Article')
        const extract = String(tfa['extract'] ?? '')
        const thumb = tfa['thumbnail'] as Record<string, unknown> | undefined
        return [{
          title: truncate(title, 120),
          summary: truncate(extract, 400),
          body: extract,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(tfa['title'] ?? title))}`,
          imageUrl: thumb ? String(thumb['source'] ?? '') : undefined,
          tags: ['wikipedia', 'featured', 'knowledge'],
          difficulty: 'medium' as const,
          estimatedMinutes: 5,
          contentType: 'article',
          isAiGenerated: false,
          emoji: '📚',
        }]
      } catch {
        return []
      }
    },
  },
  {
    id: 'wikipedia-on-this-day',
    name: 'Wikipedia On This Day',
    category: 'wiki',
    url: 'https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/{mm}/{dd}',
    type: 'api',
    description: 'Historical events that happened on this day from Wikipedia',
    async pull() {
      try {
        const now = new Date()
        const m = String(now.getUTCMonth() + 1).padStart(2, '0')
        const d = String(now.getUTCDate()).padStart(2, '0')
        const res = await fetch(
          `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${m}/${d}`,
          { headers: { 'User-Agent': 'CogniBloom-FeedBot/1.0' }, signal: AbortSignal.timeout(10_000) }
        )
        if (!res.ok) return []
        const data = await res.json() as Record<string, unknown>
        const events = (data['events'] as Record<string, unknown>[]) ?? []
        return events.slice(0, 4).map((e) => {
          const pages = (e['pages'] as Record<string, unknown>[]) ?? []
          const thumb = (pages[0]?.['thumbnail'] as Record<string, unknown> | undefined)
          return {
            title: `${String(e['year'])} — ${truncate(String(e['text'] ?? ''), 80)}`,
            summary: truncate(String(e['text'] ?? ''), 400),
            url: pages[0] ? `https://en.wikipedia.org/wiki/${encodeURIComponent(String(pages[0]['title'] ?? ''))}` : undefined,
            imageUrl: thumb ? String(thumb['source'] ?? '') : undefined,
            tags: ['wikipedia', 'history', 'on-this-day'],
            difficulty: 'easy' as const,
            estimatedMinutes: 3,
            contentType: 'article',
            isAiGenerated: false,
            emoji: '📅',
          }
        })
      } catch {
        return []
      }
    },
  },

  // ──────────────────────────────── AI (category) ──────────────────────────────

  {
    id: 'arxiv-ai-category',
    name: 'arXiv Artificial Intelligence',
    category: 'ai',
    url: 'https://export.arxiv.org/rss/cs.AI',
    type: 'rss',
    description: 'Latest AI research papers from arXiv',
    async pull() {
      const items = await fetchRss('https://export.arxiv.org/rss/cs.AI', 5)
      return rssToItems(items, 'ai', '🤖', 'article', ['ai', 'research', 'machine-learning'])
    },
  },
  {
    id: 'arxiv-ml',
    name: 'arXiv Machine Learning',
    category: 'ai',
    url: 'https://export.arxiv.org/rss/cs.LG',
    type: 'rss',
    description: 'Machine learning research from arXiv',
    async pull() {
      const items = await fetchRss('https://export.arxiv.org/rss/cs.LG', 4)
      return rssToItems(items, 'ai', '🧠', 'article', ['machine-learning', 'deep-learning'])
    },
  },
  {
    id: 'ai-ai-concept',
    name: 'AI Concept of the Day',
    category: 'ai',
    url: '',
    type: 'ai',
    description: 'AI-generated explanations of AI/ML concepts for students',
    async pull() {
      const prompts = [
        'Explain a key AI or machine learning concept (neural networks, gradient descent, transformers, reinforcement learning) for a curious 12-14 year old with an analogy and a simple demonstration idea',
        'Describe a real-world AI application that impacts daily life and explain the technology behind it simply for a middle school honors student',
        'Explain the ethics of AI to a young student: choose one topic (bias, privacy, job displacement, or deepfakes) and present balanced perspectives with a discussion question',
      ]
      const prompt = prompts[Math.floor(Math.random() * prompts.length)]!
      const item = await aiGenerate(prompt, 'ai', '🤖', 'article')
      return item ? [item] : []
    },
  },
]

// ─── Category metadata ────────────────────────────────────────────────────────

export interface CategoryMeta {
  slug: Category
  label: string
  emoji: string
  description: string
  color: string  // Tailwind color prefix for UI
}

export const CATEGORY_META: CategoryMeta[] = [
  { slug: 'math',           label: 'Math',            emoji: '🧮', description: 'Puzzles, problems, and mathematical thinking',          color: 'blue'   },
  { slug: 'coding',         label: 'Coding',          emoji: '💻', description: 'Programming challenges and computer science',           color: 'violet' },
  { slug: 'science',        label: 'Science',         emoji: '🔬', description: 'Physics, biology, chemistry, and space',               color: 'green'  },
  { slug: 'writing',        label: 'Writing',         emoji: '✍️', description: 'Creative writing, essays, and storytelling',           color: 'amber'  },
  { slug: 'vocabulary',     label: 'Vocabulary',      emoji: '📖', description: 'Words, etymology, and language mastery',               color: 'pink'   },
  { slug: 'public-speaking',label: 'Public Speaking', emoji: '🎤', description: 'Speeches, presentations, and confident communication', color: 'orange' },
  { slug: 'debate',         label: 'Debate',          emoji: '⚖️', description: 'Critical arguments, logic, and persuasion',            color: 'red'    },
  { slug: 'leadership',     label: 'Leadership',      emoji: '🌟', description: 'Leadership skills, stories, and principles',           color: 'yellow' },
  { slug: 'growth-mindset', label: 'Growth Mindset',  emoji: '🌱', description: 'Resilience, neuroplasticity, and self-development',    color: 'emerald'},
  { slug: 'current-events', label: 'Current Events',  emoji: '📰', description: 'Technology, science, and world news',                  color: 'cyan'   },
  { slug: 'projects',       label: 'Projects',        emoji: '🚀', description: 'Maker projects, open-source, and building things',     color: 'indigo' },
  { slug: 'robotics',       label: 'Robotics',        emoji: '🤖', description: 'Electronics, automation, and engineering',             color: 'teal'   },
  { slug: 'wiki',           label: 'Wiki',            emoji: '📚', description: 'Wikipedia featured articles and history',              color: 'slate'  },
  { slug: 'ai',             label: 'AI',              emoji: '🧠', description: 'Artificial intelligence concepts and research',         color: 'purple' },
]

export const ALL_CATEGORIES = CATEGORY_META.map((c) => c.slug)

/** Get sources for a specific category */
export function getSourcesForCategory(category: Category): SourceDef[] {
  return FEED_SOURCES.filter((s) => s.category === category && s.type !== 'ai')
    .concat(FEED_SOURCES.filter((s) => s.category === category && s.type === 'ai'))
}
