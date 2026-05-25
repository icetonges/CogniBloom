/**
 * Pure category metadata — safe to import in client components.
 *
 * Deliberately has NO server-side imports (no AI, no fetch, no DB).
 * Use this file in 'use client' pages instead of importing from sources.ts.
 */

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

export interface CategoryMeta {
  slug: Category
  label: string
  emoji: string
  description: string
  color: string
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

export const ALL_CATEGORY_SLUGS = CATEGORY_META.map((c) => c.slug)
