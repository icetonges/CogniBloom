/**
 * Feed source registry — all 14 learning categories.
 *
 * Each source pulls exactly 3 items per run.
 * Sources curated for middle/high school teens (grades 6–12),
 * focused on STEAM, AI, robotics, automation, and future tech.
 *
 * Real sources: RSS/API from authentic, established publications.
 * AI sources: 3 parallel AI-generated items using varied prompts.
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
  id: string           // unique slug
  name: string         // human label
  category: Category
  url: string          // "" for AI-only
  type: 'rss' | 'api' | 'ai'
  description: string
  pull: () => Promise<RawItem[]>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ITEMS_PER_SOURCE = 3   // every source targets exactly 3 items

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
      temperature: 0.88,
      maxTokens: 520,
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

/** Generate exactly 3 AI items from a rotating prompt list */
async function aiGenerateThree(
  prompts: string[],
  category: Category,
  emoji: string,
  contentType = 'article',
): Promise<RawItem[]> {
  // Pick 3 unique prompts (cycle if fewer than 3 provided)
  const selected: string[] = []
  for (let i = 0; i < ITEMS_PER_SOURCE; i++) {
    selected.push(prompts[i % prompts.length]!)
  }
  const results = await Promise.allSettled(
    selected.map((p) => aiGenerate(p, category, emoji, contentType))
  )
  return results
    .filter((r): r is PromiseFulfilledResult<RawItem> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value!)
}

/** Map RSS items to RawItems, capped at ITEMS_PER_SOURCE */
function rssToItems(
  items: RssItem[],
  category: Category,
  emoji: string,
  contentType = 'article',
  tagsExtra: string[] = [],
): RawItem[] {
  return items
    .filter((i) => i.title && i.title !== 'Untitled')
    .slice(0, ITEMS_PER_SOURCE)
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

  // ══════════════════════════════ MATH ══════════════════════════════════════

  {
    id: 'quanta-math',
    name: 'Quanta Magazine — Math',
    category: 'math',
    url: 'https://www.quantamagazine.org/mathematics/feed/',
    type: 'rss',
    description: 'Award-winning math journalism written for curious minds (Quanta Magazine)',
    async pull() {
      const items = await fetchRss('https://www.quantamagazine.org/mathematics/feed/', ITEMS_PER_SOURCE)
      return rssToItems(items, 'math', '🧮', 'article', ['quanta', 'mathematics'])
    },
  },
  {
    id: 'arxiv-math-combinatorics',
    name: 'arXiv Combinatorics & Puzzles',
    category: 'math',
    url: 'https://export.arxiv.org/rss/math.CO',
    type: 'rss',
    description: 'Combinatorics and graph theory from arXiv — great for AMC/competition prep',
    async pull() {
      const items = await fetchRss('https://export.arxiv.org/rss/math.CO', ITEMS_PER_SOURCE)
      return rssToItems(items, 'math', '🧩', 'article', ['combinatorics', 'puzzles', 'competition'])
    },
  },
  {
    id: 'ai-math',
    name: 'AI Math Challenge',
    category: 'math',
    url: '',
    type: 'ai',
    description: 'AI-generated math challenges, proofs, and AMC-style problems',
    async pull() {
      return aiGenerateThree([
        'Create a challenging but accessible math problem for a middle school honors student preparing for AMC 8/10, with a step-by-step solution and the underlying concept explained',
        'Explain a surprising or counterintuitive mathematical fact that would fascinate a 12–15 year old honors student — include a simple proof or demonstration',
        'Create a number theory or combinatorics puzzle suitable for AMC 8/10 preparation, with a hint, common mistakes to avoid, and a full solution',
        'Describe an elegant real-world application of mathematics (e.g., cryptography, GPS, voting systems) for a curious middle schooler — show the actual math',
        'Write a mini-lesson on a key competition math technique (WLOG, casework, invariants, symmetry) with a solved example and a practice problem',
      ], 'math', '🧮', 'challenge')
    },
  },

  // ══════════════════════════════ CODING ════════════════════════════════════

  {
    id: 'freecodecamp-coding',
    name: 'freeCodeCamp News',
    category: 'coding',
    url: 'https://www.freecodecamp.org/news/rss/',
    type: 'rss',
    description: 'Free tutorials, projects, and guides from freeCodeCamp — made for learners',
    async pull() {
      const items = await fetchRss('https://www.freecodecamp.org/news/rss/', ITEMS_PER_SOURCE)
      return rssToItems(items, 'coding', '💻', 'article', ['tutorial', 'beginner', 'web-dev'])
    },
  },
  {
    id: 'devto-coding',
    name: 'DEV Community — Beginners',
    category: 'coding',
    url: 'https://dev.to/api/articles?tag=beginners&per_page=6',
    type: 'api',
    description: 'Beginner-friendly coding articles from the DEV Community',
    async pull() {
      try {
        const res = await fetch(
          'https://dev.to/api/articles?tag=beginners&per_page=6&sort_by=published_at',
          { headers: { 'User-Agent': 'CogniBloom-FeedBot/1.0' }, signal: AbortSignal.timeout(10_000) }
        )
        if (!res.ok) return []
        const articles = await res.json() as Array<Record<string, unknown>>
        return articles.slice(0, ITEMS_PER_SOURCE).map((a) => ({
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
    id: 'hacker-news-coding',
    name: 'Hacker News — Top Tech',
    category: 'coding',
    url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    type: 'api',
    description: 'Top programming and technology stories from Hacker News',
    async pull() {
      try {
        const idsRes = await fetch(
          'https://hacker-news.firebaseio.com/v0/topstories.json',
          { signal: AbortSignal.timeout(10_000) }
        )
        const ids = (await idsRes.json() as number[]).slice(0, 10)
        const stories = await Promise.allSettled(
          ids.map((id) =>
            fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
              signal: AbortSignal.timeout(8_000),
            }).then((r) => r.json())
          )
        )
        return stories
          .filter((s): s is PromiseFulfilledResult<Record<string, unknown>> =>
            s.status === 'fulfilled' && !!s.value?.title && !!s.value?.url
          )
          .slice(0, ITEMS_PER_SOURCE)
          .map((s) => ({
            title: truncate(String(s.value['title']), 120),
            summary: `Trending on Hacker News${s.value['score'] ? ` · ${s.value['score']} pts` : ''}${s.value['descendants'] ? ` · ${s.value['descendants']} comments` : ''}`,
            url: String(s.value['url'] || `https://news.ycombinator.com/item?id=${s.value['id']}`),
            tags: ['hacker-news', 'coding', 'tech'],
            difficulty: 'medium' as const,
            estimatedMinutes: 5,
            contentType: 'article',
            publishedAt: s.value['time'] ? new Date((s.value['time'] as number) * 1000) : undefined,
            isAiGenerated: false,
            emoji: '⚡',
          }))
      } catch {
        return []
      }
    },
  },
  {
    id: 'ai-coding',
    name: 'AI Coding Challenge',
    category: 'coding',
    url: '',
    type: 'ai',
    description: 'AI-generated coding challenges and CS concepts for young programmers',
    async pull() {
      return aiGenerateThree([
        'Create a beginner Python coding challenge for a middle school student (age 12–15) with a hint, full solution, and explanation of the underlying concept (loops, functions, data structures, etc.)',
        'Explain a fundamental computer science concept (recursion, Big-O notation, binary search, or sorting algorithms) in an engaging way for a young coder with a mini-project idea to try',
        'Create a fun JavaScript or Python mini-project for a young programmer: describe what it builds, the step-by-step logic, and the expected output — keep it completable in 30 minutes',
        'Teach one web development concept (HTML/CSS/JS, APIs, databases) with a concrete example a 12–15 year old can follow and expand on',
        'Create an engaging computer science trivia question or "did you know?" about how modern technology works under the hood — aimed at curious teen coders',
      ], 'coding', '💻', 'challenge')
    },
  },

  // ══════════════════════════════ SCIENCE ════════════════════════════════════

  {
    id: 'science-news-explores',
    name: 'Science News Explores',
    category: 'science',
    url: 'https://www.sciencenewsexplores.org/feed/',
    type: 'rss',
    description: 'Science journalism written for students — published by Society for Science',
    async pull() {
      const items = await fetchRss('https://www.sciencenewsexplores.org/feed/', ITEMS_PER_SOURCE)
      return rssToItems(items, 'science', '🔬', 'article', ['science-news', 'students', 'stem'])
    },
  },
  {
    id: 'quanta-science',
    name: 'Quanta Magazine — Science',
    category: 'science',
    url: 'https://www.quantamagazine.org/science/feed/',
    type: 'rss',
    description: 'In-depth science journalism on physics, biology, and computer science',
    async pull() {
      const items = await fetchRss('https://www.quantamagazine.org/science/feed/', ITEMS_PER_SOURCE)
      return rssToItems(items, 'science', '⚛️', 'article', ['quanta', 'physics', 'biology'])
    },
  },
  {
    id: 'nasa-apod',
    name: 'NASA Astronomy Picture of the Day',
    category: 'science',
    url: 'https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY',
    type: 'api',
    description: "NASA's Astronomy Picture of the Day with expert explanation",
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
    id: 'physorg-science',
    name: 'Phys.org Science News',
    category: 'science',
    url: 'https://phys.org/rss-feed/',
    type: 'rss',
    description: 'Daily science and technology news from phys.org',
    async pull() {
      const items = await fetchRss('https://phys.org/rss-feed/', ITEMS_PER_SOURCE)
      return rssToItems(items, 'science', '🔬', 'article', ['physics', 'science', 'research'])
    },
  },
  {
    id: 'ai-science',
    name: 'AI Science Discovery',
    category: 'science',
    url: '',
    type: 'ai',
    description: 'AI-generated science facts, experiments, and discoveries for students',
    async pull() {
      return aiGenerateThree([
        'Share a fascinating and surprising science fact from physics, chemistry, or biology that would captivate a middle school honors student, with a simple thought experiment or home experiment to try',
        'Explain a cutting-edge science discovery or breakthrough (2024–2025) in physics, biology, chemistry, or medicine in a way a 12–15 year old would understand and find exciting',
        'Describe a real scientific mystery that scientists are still trying to solve — explained engagingly for curious middle school students who love science',
        'Explain a surprising connection between two different fields of science (e.g., biology and physics, chemistry and astronomy) with a concrete example that blows your mind',
        'Describe how a common everyday object or phenomenon (rainbows, microwave ovens, airplane lift, GPS) actually works at the atomic or physics level — for a curious teen',
      ], 'science', '🔬', 'fact')
    },
  },

  // ══════════════════════════════ WRITING ════════════════════════════════════

  {
    id: 'write-practice-writing',
    name: 'The Write Practice',
    category: 'writing',
    url: 'https://thewritepractice.com/feed/',
    type: 'rss',
    description: 'Practical writing craft articles and exercises for aspiring writers',
    async pull() {
      const items = await fetchRss('https://thewritepractice.com/feed/', ITEMS_PER_SOURCE)
      return rssToItems(items, 'writing', '✍️', 'article', ['craft', 'writing-tips', 'storytelling'])
    },
  },
  {
    id: 'writing-forward',
    name: 'Writing Forward',
    category: 'writing',
    url: 'https://www.writingforward.com/feed',
    type: 'rss',
    description: 'Creative writing prompts, tips, and exercises from Writing Forward',
    async pull() {
      const items = await fetchRss('https://www.writingforward.com/feed', ITEMS_PER_SOURCE)
      return rssToItems(items, 'writing', '📝', 'article', ['creative-writing', 'prompts', 'craft'])
    },
  },
  {
    id: 'ai-writing-prompt',
    name: 'AI Creative Writing Prompt',
    category: 'writing',
    url: '',
    type: 'ai',
    description: 'AI-generated creative, expository, and persuasive writing prompts',
    async pull() {
      return aiGenerateThree([
        'Create an engaging creative writing prompt for a middle school student: include the prompt itself, 3 story starter options, tips for strong descriptive writing, and what makes a great ending',
        'Create a persuasive writing challenge for an honors middle schooler: provide a contemporary topic, two balanced perspectives to consider, 3 evidence points per side, and a mini-outline framework',
        'Create an expository writing exercise for a 12–15 year old: give a fascinating topic, 4 key points to research and explain, a paragraph structure guide, and a sample opening sentence',
        'Teach one powerful writing technique (e.g., show-don\'t-tell, varied sentence structure, strong verbs, sensory details) with a before/after revision example and a 5-minute practice exercise',
        'Give a middle school student a real-world writing task: write a brief speech, letter to an editor, or product review. Include the scenario, audience, goal, and an example opening paragraph',
      ], 'writing', '✍️', 'challenge')
    },
  },
  {
    id: 'ai-writing-technique',
    name: 'AI Writing Craft Lesson',
    category: 'writing',
    url: '',
    type: 'ai',
    description: 'Mini-lessons on writing craft and language skills for teen writers',
    async pull() {
      return aiGenerateThree([
        'Teach the art of writing a powerful hook/opening sentence with 5 different techniques (question, bold statement, anecdote, statistic, sensory detail) — include one example of each',
        'Explain how to structure an argument paragraph (claim → evidence → analysis → link) with a fully worked example on a teen-relevant topic',
        'Teach the difference between passive and active voice with examples and a rewriting exercise — explain when each is appropriate in different types of writing',
        'Explain how to write dialogue correctly (punctuation, tags, beats) with common mistakes and corrected examples — for a student writing their first short story',
        'Teach 5 transition words/phrases that level up an essay from choppy to flowing, with before/after paragraph examples a middle schooler can immediately apply',
      ], 'writing', '📝', 'tip')
    },
  },

  // ══════════════════════════════ VOCABULARY ═══════════════════════════════════

  {
    id: 'merriam-webster-wotd',
    name: 'Merriam-Webster Word of the Day',
    category: 'vocabulary',
    url: 'https://www.merriam-webster.com/wotd/feed/rss2',
    type: 'rss',
    description: 'Daily vocabulary with definition and etymology from Merriam-Webster',
    async pull() {
      const items = await fetchRss('https://www.merriam-webster.com/wotd/feed/rss2', ITEMS_PER_SOURCE)
      return rssToItems(items, 'vocabulary', '📖', 'vocabulary', ['word-of-the-day', 'english', 'dictionary'])
    },
  },
  {
    id: 'ai-vocabulary',
    name: 'AI Vocabulary Builder',
    category: 'vocabulary',
    url: '',
    type: 'ai',
    description: 'Advanced vocabulary with etymology, context, and memory tricks for teens',
    async pull() {
      return aiGenerateThree([
        'Teach an advanced vocabulary word highly useful for honors middle school essays and standardized tests (SAT/ACT prep vocabulary): include the word, pronunciation, etymology/origin story, multiple definitions, 3 example sentences in different contexts, and a memorable mnemonic',
        'Introduce a "power word" — a sophisticated synonym for an overused word (e.g., said, big, walk, good) — with its etymology, nuanced meaning vs. the common word, usage examples, and register/formality notes',
        'Explain the difference between two commonly confused words (e.g., affect/effect, imply/infer, fewer/less, lay/lie) with clear rules, memorable tricks, and quiz-style practice examples',
        'Teach a word from Latin or Greek roots that unlocks the meaning of 5+ English words — explain the root, show all the derived words, and give a sentence for each',
        'Share 3 sophisticated academic vocabulary words (Tier 3) from the same field (science, law, philosophy, economics) that a middle schooler can start using in their writing',
      ], 'vocabulary', '📖', 'vocabulary')
    },
  },

  // ══════════════════════════════ PUBLIC SPEAKING ═══════════════════════════════

  {
    id: 'six-minutes-speaking',
    name: 'Six Minutes — Speaking Skills',
    category: 'public-speaking',
    url: 'https://sixminutes.dlugan.com/feed/',
    type: 'rss',
    description: 'In-depth public speaking and presentation skills from Six Minutes blog',
    async pull() {
      const items = await fetchRss('https://sixminutes.dlugan.com/feed/', ITEMS_PER_SOURCE)
      return rssToItems(items, 'public-speaking', '🎤', 'article', ['speaking', 'presentation', 'communication'])
    },
  },
  {
    id: 'manner-of-speaking',
    name: 'Manner of Speaking',
    category: 'public-speaking',
    url: 'https://mannerofspeaking.org/feed/',
    type: 'rss',
    description: 'Public speaking techniques and speech analysis — Toastmasters-style coaching',
    async pull() {
      const items = await fetchRss('https://mannerofspeaking.org/feed/', ITEMS_PER_SOURCE)
      return rssToItems(items, 'public-speaking', '🎙️', 'article', ['speaking', 'toastmasters', 'rhetoric'])
    },
  },
  {
    id: 'ai-public-speaking',
    name: 'AI Speaking Coach',
    category: 'public-speaking',
    url: '',
    type: 'ai',
    description: 'Practical public speaking techniques, exercises, and challenges for teens',
    async pull() {
      return aiGenerateThree([
        'Provide a daily public speaking challenge for a middle school student: a 2-minute speech topic, 3 key points to cover, specific tips for confident delivery, and how to handle nervousness',
        'Teach one specific public speaking skill (e.g., vocal variety, deliberate pausing, eye contact, body language, using gestures) with a hands-on practice exercise and a self-checklist',
        'Create a mini TED-talk prompt for a 12–15 year old: an interesting "idea worth spreading" topic they know about from their life, a 3-part talk structure, and tips to sound authentic not robotic',
        'Explain how to structure a 5-minute informative speech (attention grabber → 3 main points → memorable close) with a worked example on a technology or science topic',
        'Teach techniques to overcome stage fright: the neuroscience behind why we feel nervous, 3 proven techniques to calm down in the moment, and a pre-speech warm-up routine',
      ], 'public-speaking', '🎤', 'challenge')
    },
  },
  {
    id: 'ai-debate-speaking',
    name: 'AI Speech & Debate Drill',
    category: 'public-speaking',
    url: '',
    type: 'ai',
    description: 'Speech drills, tongue twisters, and articulation exercises',
    async pull() {
      return aiGenerateThree([
        'Create a vocabulary and articulation drill for a teen who wants to speak more clearly and confidently: include tongue twisters, projection exercises, and a speed-reading drill',
        'Teach how to use rhetorical devices (anaphora, tricolon, rhetorical question, antithesis) in a speech — give a famous example, explain the effect, and show how a student could use it',
        'Design an impromptu speaking exercise for a 12–15 year old: give a random topic, a 2-minute structure (PREP: Point, Reason, Example, Point), and evaluation criteria',
      ], 'public-speaking', '🎤', 'tip')
    },
  },

  // ══════════════════════════════ DEBATE ═══════════════════════════════════════

  {
    id: 'hacker-news-ask',
    name: 'Ask Hacker News — Discussions',
    category: 'debate',
    url: 'https://hacker-news.firebaseio.com/v0/askstories.json',
    type: 'api',
    description: 'Open-ended tech and society discussions from Hacker News — great for critical thinking',
    async pull() {
      try {
        const idsRes = await fetch('https://hacker-news.firebaseio.com/v0/askstories.json', {
          signal: AbortSignal.timeout(8_000),
        })
        const ids = (await idsRes.json() as number[]).slice(0, 8)
        const stories = await Promise.allSettled(
          ids.map((id) =>
            fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
              signal: AbortSignal.timeout(6_000),
            }).then((r) => r.json())
          )
        )
        return stories
          .filter((s): s is PromiseFulfilledResult<Record<string, unknown>> =>
            s.status === 'fulfilled' && !!s.value?.title
          )
          .slice(0, ITEMS_PER_SOURCE)
          .map((s) => ({
            title: truncate(String(s.value['title']), 120),
            summary: truncate(String(s.value['text'] ?? s.value['title']), 400),
            url: `https://news.ycombinator.com/item?id=${s.value['id']}`,
            tags: ['debate', 'discussion', 'hacker-news', 'critical-thinking'],
            difficulty: 'medium' as const,
            estimatedMinutes: 5,
            contentType: 'article',
            isAiGenerated: false,
            emoji: '⚖️',
          }))
      } catch {
        return []
      }
    },
  },
  {
    id: 'ai-debate',
    name: 'AI Debate Coach',
    category: 'debate',
    url: '',
    type: 'ai',
    description: 'Structured debate topics with both sides argued for teen debaters',
    async pull() {
      return aiGenerateThree([
        'Create a compelling middle school debate topic about technology or society with clear affirmative and negative positions, 3 strong arguments per side, real evidence examples, and rebuttal tips',
        'Design a Socratic seminar discussion for 12–15 year olds: an interesting ethical dilemma in AI, environment, or social media, 5 open-ended questions to explore, and vocabulary for thoughtful discussion',
        'Create a Lincoln-Douglas debate prompt for middle schoolers on a values-based topic: define the value premise and criterion for each side, give key evidence, and provide a flow structure',
        'Present both sides of a current tech or society debate (e.g., AI in schools, social media age limits, automation and jobs, electric vehicles) in a balanced, evidence-based way for a teen audience',
        'Create a "devil\'s advocate" exercise: take a position most students would agree with and argue powerfully against it — teach the skill of steelmanning the opposing view',
      ], 'debate', '⚖️', 'challenge')
    },
  },

  // ══════════════════════════════ LEADERSHIP ═══════════════════════════════════

  {
    id: 'greater-good-leadership',
    name: 'Greater Good Science Center',
    category: 'leadership',
    url: 'https://greatergood.berkeley.edu/feeds/articles',
    type: 'rss',
    description: 'Science-based insights on happiness, leadership, and human connection from UC Berkeley',
    async pull() {
      const items = await fetchRss('https://greatergood.berkeley.edu/feeds/articles', ITEMS_PER_SOURCE)
      return rssToItems(items, 'leadership', '🌟', 'article', ['leadership', 'psychology', 'wellbeing'])
    },
  },
  {
    id: 'ai-leadership',
    name: 'AI Leadership Lesson',
    category: 'leadership',
    url: '',
    type: 'ai',
    description: 'Leadership principles, real stories, and challenges for young leaders',
    async pull() {
      return aiGenerateThree([
        'Share a leadership lesson from a historical or modern innovator (scientist, activist, entrepreneur, athlete) with a real story/example, the principle illustrated, and a reflection question for a 12–15 year old',
        'Teach one key leadership skill (active listening, decision-making under uncertainty, giving feedback, conflict resolution) with a realistic school or team scenario exercise for middle school students',
        'Share an inspiring story of youth leadership — someone aged 12–20 who made a meaningful difference — with 3 concrete leadership lessons and how any student can apply them this week',
        'Explain the difference between leadership styles (autocratic, democratic, servant leadership, transformational) with a scenario showing when each works best — for a teen learning about teams',
        'Design a leadership challenge for a middle schooler: a real-world problem they can try to solve in their school or community, with a planning framework and success metrics',
      ], 'leadership', '🌟', 'tip')
    },
  },

  // ══════════════════════════════ GROWTH MINDSET ═══════════════════════════════

  {
    id: 'mindful-growth',
    name: 'Mindful.org — Wellbeing',
    category: 'growth-mindset',
    url: 'https://www.mindful.org/feed/',
    type: 'rss',
    description: 'Science-based mindfulness and growth habits from Mindful.org',
    async pull() {
      const items = await fetchRss('https://www.mindful.org/feed/', ITEMS_PER_SOURCE)
      return rssToItems(items, 'growth-mindset', '🌱', 'article', ['mindfulness', 'growth', 'psychology'])
    },
  },
  {
    id: 'ai-growth-mindset',
    name: 'AI Growth Mindset Lesson',
    category: 'growth-mindset',
    url: '',
    type: 'ai',
    description: 'Growth mindset lessons backed by neuroscience and psychology research',
    async pull() {
      return aiGenerateThree([
        'Share a growth mindset lesson based on Carol Dweck\'s research with a real student scenario showing fixed vs. growth mindset thinking, why the brain changes with effort, and one daily habit to build more resilience',
        'Explain the neuroscience of deliberate practice and neuroplasticity for a middle schooler — make it exciting and motivating, show how learning literally reshapes the brain, and end with a 7-day challenge',
        'Share a powerful story about overcoming failure (a real person who succeeded after major setbacks) with 3 actionable strategies a young student facing academic or social challenges can use right now',
        'Teach the concept of "productive struggle" — why being confused is a sign you\'re learning, how to sit with discomfort, and strategies to push through hard problems without giving up',
        'Explain how sleep, exercise, and nutrition directly affect learning and memory — with the actual science and 3 small habits a teen can start today to study more effectively',
      ], 'growth-mindset', '🌱', 'tip')
    },
  },

  // ══════════════════════════════ CURRENT EVENTS ════════════════════════════════

  {
    id: 'npr-science-tech',
    name: 'NPR Science & Technology',
    category: 'current-events',
    url: 'https://feeds.npr.org/1007/rss.xml',
    type: 'rss',
    description: 'NPR science and technology news — trusted, accessible journalism',
    async pull() {
      const items = await fetchRss('https://feeds.npr.org/1007/rss.xml', ITEMS_PER_SOURCE)
      return rssToItems(items, 'current-events', '📰', 'article', ['npr', 'science', 'technology', 'news'])
    },
  },
  {
    id: 'hacker-news-current',
    name: 'Hacker News — New Stories',
    category: 'current-events',
    url: 'https://hacker-news.firebaseio.com/v0/newstories.json',
    type: 'api',
    description: 'Latest technology and science news from Hacker News community',
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
          .filter((s): s is PromiseFulfilledResult<Record<string, unknown>> =>
            s.status === 'fulfilled' && !!s.value?.url && !!s.value?.title
          )
          .slice(0, ITEMS_PER_SOURCE)
          .map((s) => ({
            title: truncate(String(s.value['title']), 120),
            summary: `Latest on Hacker News${s.value['score'] ? ` · ${s.value['score']} pts` : ''}`,
            url: String(s.value['url']),
            tags: ['news', 'technology', 'current-events'],
            difficulty: 'medium' as const,
            estimatedMinutes: 4,
            contentType: 'article',
            publishedAt: s.value['time'] ? new Date((s.value['time'] as number) * 1000) : undefined,
            isAiGenerated: false,
            emoji: '📰',
          }))
      } catch {
        return []
      }
    },
  },
  {
    id: 'sciencedaily-current',
    name: 'Science Daily — Top Science',
    category: 'current-events',
    url: 'https://www.sciencedaily.com/rss/top/science.xml',
    type: 'rss',
    description: 'Breaking science news from top research institutions',
    async pull() {
      const items = await fetchRss('https://www.sciencedaily.com/rss/top/science.xml', ITEMS_PER_SOURCE)
      return rssToItems(items, 'current-events', '🔬', 'article', ['science', 'research', 'discovery'])
    },
  },
  {
    id: 'ai-current-events',
    name: 'AI Current Events Briefing',
    category: 'current-events',
    url: '',
    type: 'ai',
    description: 'AI-curated current events briefings for teen critical thinkers',
    async pull() {
      return aiGenerateThree([
        'Describe a significant recent development (2024–2025) in artificial intelligence, robotics, or computing that would fascinate an honors middle school student — include what happened, why it matters, and a discussion question',
        'Explain a current global topic in climate, space exploration, or biotechnology in a balanced, factual way for a 12–15 year old — present the state of the science and what it means for the future',
        'Summarize a recent breakthrough or controversy in science, technology, or society that has both optimistic and concerning sides — help a teen think through both perspectives critically',
        'Describe how a current world event connects to something students learn in school (science, history, math, economics) — make the classroom-to-real-world link explicit for a teen reader',
        'Explain a current technological trend (AI, quantum computing, biotech, renewable energy, space commercialization) that will affect a teen\'s career and life — what is it, where is it going, and how can they prepare?',
      ], 'current-events', '📰', 'article')
    },
  },

  // ══════════════════════════════ PROJECTS ══════════════════════════════════════

  {
    id: 'github-trending',
    name: 'GitHub Trending Repositories',
    category: 'projects',
    url: 'https://api.github.com/search/repositories',
    type: 'api',
    description: 'Trending open-source projects — what the coding world is building right now',
    async pull() {
      try {
        const since = new Date()
        since.setMonth(since.getMonth() - 2)
        const dateStr = since.toISOString().slice(0, 10)
        const res = await fetch(
          `https://api.github.com/search/repositories?q=stars:%3E50+created:%3E${dateStr}+topic:education+OR+topic:students+OR+topic:beginner&sort=stars&order=desc&per_page=6`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'CogniBloom-FeedBot/1.0',
            },
            signal: AbortSignal.timeout(10_000),
          }
        )
        if (!res.ok) {
          // Fallback: general trending
          const fallback = await fetch(
            `https://api.github.com/search/repositories?q=stars:%3E100+created:%3E${dateStr}&sort=stars&order=desc&per_page=6`,
            { headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'CogniBloom-FeedBot/1.0' }, signal: AbortSignal.timeout(10_000) }
          )
          if (!fallback.ok) return []
          const fb = await fallback.json() as Record<string, unknown>
          const repos = (fb['items'] as Record<string, unknown>[]) ?? []
          return repos.slice(0, ITEMS_PER_SOURCE).map(repoToItem)
        }
        const data = await res.json() as Record<string, unknown>
        const repos = (data['items'] as Record<string, unknown>[]) ?? []
        return repos.slice(0, ITEMS_PER_SOURCE).map(repoToItem)
      } catch {
        return []
      }
    },
  },
  {
    id: 'freecodecamp-projects',
    name: 'freeCodeCamp — Project Tutorials',
    category: 'projects',
    url: 'https://www.freecodecamp.org/news/rss/',
    type: 'rss',
    description: 'Step-by-step project tutorials from freeCodeCamp for all skill levels',
    async pull() {
      const items = await fetchRss('https://www.freecodecamp.org/news/rss/', ITEMS_PER_SOURCE + 2)
      // Filter for project/tutorial-style content
      const filtered = items.filter((i) =>
        /project|build|create|tutorial|how to|make/i.test(i.title)
      ).slice(0, ITEMS_PER_SOURCE)
      const base = rssToItems(filtered.length >= ITEMS_PER_SOURCE ? filtered : items, 'projects', '🚀', 'tutorial', ['project', 'build', 'hands-on'])
      return base.slice(0, ITEMS_PER_SOURCE)
    },
  },
  {
    id: 'ai-projects',
    name: 'AI Project Idea Generator',
    category: 'projects',
    url: '',
    type: 'ai',
    description: 'AI-generated hands-on STEAM project ideas for curious students',
    async pull() {
      return aiGenerateThree([
        'Design a fun beginner coding project for a 12–15 year old to build in Python: describe what it does, the step-by-step plan with pseudocode, skills learned, and 3 extension ideas to make it more impressive',
        'Create a science + engineering maker project that a middle school student can build at home or school with common materials — include materials list, steps, the STEM concept it demonstrates, and how to present it',
        'Suggest a creative project combining AI tools and a student\'s existing skill or interest (art, music, writing, math) — describe what they\'d build, which free tools to use, and how to share it with the world',
        'Design a data science mini-project for a teen: a real-world dataset to explore, 3 questions to answer with it, simple tools to use (spreadsheet, Python pandas), and what insights they might discover',
        'Create a beginner electronics/microcontroller project using Arduino or Raspberry Pi Pico: components list, circuit diagram description, code snippet, and what concept it teaches about computing and physical systems',
      ], 'projects', '🚀', 'challenge')
    },
  },

  // ══════════════════════════════ ROBOTICS ══════════════════════════════════════

  {
    id: 'ieee-spectrum-robotics',
    name: 'IEEE Spectrum — Robotics',
    category: 'robotics',
    url: 'https://spectrum.ieee.org/feeds/feed.rss',
    type: 'rss',
    description: 'Cutting-edge robotics and automation news from IEEE Spectrum',
    async pull() {
      const items = await fetchRss('https://spectrum.ieee.org/feeds/feed.rss', ITEMS_PER_SOURCE + 2)
      const filtered = items.filter((i) =>
        /robot|automat|drone|AI|machine|sensor|actuator/i.test(i.title)
      ).slice(0, ITEMS_PER_SOURCE)
      return rssToItems(
        filtered.length >= 2 ? filtered : items,
        'robotics', '🤖', 'article', ['ieee', 'robotics', 'engineering']
      ).slice(0, ITEMS_PER_SOURCE)
    },
  },
  {
    id: 'sciencedaily-robotics',
    name: 'Science Daily — Robotics',
    category: 'robotics',
    url: 'https://www.sciencedaily.com/rss/robots/robotics.xml',
    type: 'rss',
    description: 'Latest robotics research and applications from Science Daily',
    async pull() {
      const items = await fetchRss('https://www.sciencedaily.com/rss/robots/robotics.xml', ITEMS_PER_SOURCE)
      return rssToItems(items, 'robotics', '🦾', 'article', ['robotics', 'research', 'automation'])
    },
  },
  {
    id: 'arduino-blog',
    name: 'Arduino Official Blog',
    category: 'robotics',
    url: 'https://blog.arduino.cc/feed/',
    type: 'rss',
    description: 'Project ideas and tutorials from the Arduino maker community',
    async pull() {
      const items = await fetchRss('https://blog.arduino.cc/feed/', ITEMS_PER_SOURCE)
      return rssToItems(items, 'robotics', '⚙️', 'article', ['arduino', 'hardware', 'maker', 'electronics'])
    },
  },
  {
    id: 'ai-robotics',
    name: 'AI Robotics & Automation Lesson',
    category: 'robotics',
    url: '',
    type: 'ai',
    description: 'AI-generated robotics concepts, future tech, and project ideas for teens',
    async pull() {
      return aiGenerateThree([
        'Explain a key robotics concept (sensors, PID control, path planning, computer vision, inverse kinematics) for a middle school student interested in FIRST Robotics or VEX competitions, with a simple experiment to demonstrate it',
        'Describe a cutting-edge real-world robotics application (surgical robots, autonomous vehicles, warehouse automation, space robots, exoskeletons) and the engineering principles behind it — aimed at an inspired 12–15 year old',
        'Explain how automation and AI are changing a specific industry (manufacturing, agriculture, healthcare, transportation) — what jobs change, what new jobs emerge, and what skills a teen should develop for this future',
        'Create a beginner robotics project using Arduino Uno or Raspberry Pi Pico: components, circuit description, code walkthrough, and what it teaches about real-world engineering and automation',
        'Explain what machine learning means for physical robots — how robots learn from experience, what reinforcement learning is, and a real example where a robot taught itself to do something surprising',
      ], 'robotics', '🤖', 'challenge')
    },
  },

  // ══════════════════════════════ WIKI ══════════════════════════════════════════

  {
    id: 'wikipedia-featured',
    name: "Wikipedia Today's Featured Article",
    category: 'wiki',
    url: 'https://en.wikipedia.org/api/rest_v1/feed/featured/{date}',
    type: 'api',
    description: "Wikipedia's daily featured article — the site's best, most thorough content",
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
    description: 'Historical events that happened on this day — curated by Wikipedia',
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
        return events.slice(0, ITEMS_PER_SOURCE).map((e) => {
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
  {
    id: 'ai-wiki-concept',
    name: 'AI Deep Dive Concept',
    category: 'wiki',
    url: '',
    type: 'ai',
    description: 'AI-explained fascinating concepts, inventions, and ideas from human knowledge',
    async pull() {
      return aiGenerateThree([
        'Explain a fascinating concept from science, mathematics, history, or philosophy that every educated person should know — written as an engaging encyclopedia-style entry for a curious 12–15 year old',
        'Tell the surprising origin story of a common everyday thing (a technology, a word, a custom, a food) that most people take for granted — include the key people, timeline, and unexpected twists',
        'Explain a major historical turning point (an invention, discovery, or event) and show how the world would be fundamentally different if it had happened differently — for a teen who loves history and ideas',
        'Introduce a remarkable person from history who changed the world but is often overlooked in school: their background, their contribution, and why their work still matters today',
        'Explain a philosophical thought experiment (Trolley Problem, Ship of Theseus, Brain in a Vat, Prisoner\'s Dilemma) in an accessible, engaging way — include its real-world applications for a middle schooler',
      ], 'wiki', '📚', 'article')
    },
  },

  // ══════════════════════════════ AI (category) ═════════════════════════════════

  {
    id: 'mit-news-ai',
    name: 'MIT News — Artificial Intelligence',
    category: 'ai',
    url: 'https://news.mit.edu/rss/topic/artificial-intelligence2',
    type: 'rss',
    description: 'AI research news and breakthroughs from MIT — one of the world\'s top AI labs',
    async pull() {
      const items = await fetchRss('https://news.mit.edu/rss/topic/artificial-intelligence2', ITEMS_PER_SOURCE)
      return rssToItems(items, 'ai', '🧠', 'article', ['mit', 'ai', 'machine-learning', 'research'])
    },
  },
  {
    id: 'sciencedaily-ai',
    name: 'Science Daily — AI & Machine Learning',
    category: 'ai',
    url: 'https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml',
    type: 'rss',
    description: 'Latest AI and machine learning research from top institutions worldwide',
    async pull() {
      const items = await fetchRss(
        'https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml',
        ITEMS_PER_SOURCE
      )
      return rssToItems(items, 'ai', '🤖', 'article', ['ai', 'machine-learning', 'research', 'neural-networks'])
    },
  },
  {
    id: 'arxiv-ai',
    name: 'arXiv — AI Research',
    category: 'ai',
    url: 'https://export.arxiv.org/rss/cs.AI',
    type: 'rss',
    description: 'Frontier AI research papers from arXiv — where AI breakthroughs appear first',
    async pull() {
      const items = await fetchRss('https://export.arxiv.org/rss/cs.AI', ITEMS_PER_SOURCE)
      return rssToItems(items, 'ai', '🔬', 'article', ['arxiv', 'ai', 'research', 'paper'])
    },
  },
  {
    id: 'ai-ai-concept',
    name: 'AI Concept of the Day',
    category: 'ai',
    url: '',
    type: 'ai',
    description: 'AI-explained concepts in artificial intelligence for curious young minds',
    async pull() {
      return aiGenerateThree([
        'Explain a key AI or machine learning concept (neural networks, transformers, diffusion models, reinforcement learning, large language models) for a curious 12–15 year old — use a clear analogy, avoid jargon, and include a simple demonstration idea',
        'Describe a real-world AI application that impacts daily life right now (recommendation algorithms, image recognition, voice assistants, self-driving cars, medical AI) and explain the technology behind it for a teen who wants to understand how it really works',
        'Explain an AI ethics challenge (algorithmic bias, deepfakes, data privacy, AI in warfare, job displacement) in a balanced, thoughtful way — present multiple perspectives and end with a discussion question for a 12–15 year old',
        'Describe one of the biggest open problems in AI research (AGI, AI safety, interpretability, multimodal understanding) — why it\'s hard, what progress has been made, and why a teen interested in AI should care about it',
        'Explain how a specific AI model or technology works: pick one real system (GPT-style LLM, AlphaFold, DALL-E, AlphaGo, autonomous driving) and explain it step-by-step in a way a middle schooler can understand and be excited by',
      ], 'ai', '🧠', 'article')
    },
  },
]

// ─── Helper: map GitHub repo to RawItem ──────────────────────────────────────

function repoToItem(r: Record<string, unknown>): RawItem {
  const lang = String(r['language'] ?? 'code').toLowerCase()
  return {
    title: `${String(r['name'])} by ${String((r['owner'] as Record<string, unknown>)?.['login'] ?? '')}`,
    summary: truncate(String(r['description'] ?? 'Open-source project on GitHub'), 400),
    url: String(r['html_url'] ?? ''),
    tags: ['github', 'open-source', 'project', lang].filter(Boolean),
    difficulty: 'medium' as const,
    estimatedMinutes: 5,
    contentType: 'article',
    isAiGenerated: false,
    emoji: '🚀',
  }
}

// ─── Category metadata ────────────────────────────────────────────────────────

export interface CategoryMeta {
  slug: Category
  label: string
  emoji: string
  description: string
  color: string
}

export const CATEGORY_META: CategoryMeta[] = [
  { slug: 'math',            label: 'Math',            emoji: '🧮', description: 'Puzzles, AMC prep, and mathematical thinking',               color: 'blue'   },
  { slug: 'coding',          label: 'Coding',          emoji: '💻', description: 'Programming challenges and computer science',                color: 'violet' },
  { slug: 'science',         label: 'Science',         emoji: '🔬', description: 'Physics, biology, chemistry, and space exploration',        color: 'green'  },
  { slug: 'writing',         label: 'Writing',         emoji: '✍️', description: 'Creative writing, essays, and storytelling',               color: 'amber'  },
  { slug: 'vocabulary',      label: 'Vocabulary',      emoji: '📖', description: 'Words, etymology, and language mastery',                   color: 'pink'   },
  { slug: 'public-speaking', label: 'Public Speaking', emoji: '🎤', description: 'Speeches, presentations, and confident communication',     color: 'orange' },
  { slug: 'debate',          label: 'Debate',          emoji: '⚖️', description: 'Critical arguments, logic, and persuasion',               color: 'red'    },
  { slug: 'leadership',      label: 'Leadership',      emoji: '🌟', description: 'Leadership skills, stories, and principles',               color: 'yellow' },
  { slug: 'growth-mindset',  label: 'Growth Mindset',  emoji: '🌱', description: 'Resilience, neuroplasticity, and self-development',        color: 'emerald'},
  { slug: 'current-events',  label: 'Current Events',  emoji: '📰', description: 'Tech, science, AI, and world news',                       color: 'cyan'   },
  { slug: 'projects',        label: 'Projects',        emoji: '🚀', description: 'Maker projects, open-source, and building things',         color: 'indigo' },
  { slug: 'robotics',        label: 'Robotics',        emoji: '🤖', description: 'Automation, AI robotics, and engineering',                 color: 'teal'   },
  { slug: 'wiki',            label: 'Wiki',            emoji: '📚', description: 'Deep dives into science, history, and ideas',              color: 'slate'  },
  { slug: 'ai',              label: 'AI',              emoji: '🧠', description: 'Artificial intelligence — concepts, research, and ethics', color: 'purple' },
]

export const ALL_CATEGORIES = CATEGORY_META.map((c) => c.slug)

/** Get sources for a specific category */
export function getSourcesForCategory(category: Category): SourceDef[] {
  return FEED_SOURCES.filter((s) => s.category === category && s.type !== 'ai')
    .concat(FEED_SOURCES.filter((s) => s.category === category && s.type === 'ai'))
}
