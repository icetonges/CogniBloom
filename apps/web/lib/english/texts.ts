/**
 * Full texts Daniel can actually read inside CogniBloom.
 *
 * Only works that are in the public domain in the United States are carried
 * here, and each one names the exact digital edition it came from so a
 * quotation can be checked against a real source. Everything else on the
 * English 7 list is still in copyright: those books are read from a physical
 * or library copy, and the app gives him the chapter workshop instead of the
 * text.
 *
 * The text itself lives under `public/english/texts/<slug>.json` so the reader
 * fetches one book at a time instead of shipping 640,000 words in the bundle.
 */

export type TextKind = 'prose' | 'play'

/** One paragraph of prose. Verse keeps its own line breaks. */
export interface TextPara {
  kind: 'p' | 'verse'
  text: string
}

export interface ProseChapter {
  id: string
  /** "Chapter IV", "Stave II", "Story 3" */
  label: string
  /** May be empty — several editions number chapters without titling them. */
  title: string
  /** "Part II" / "Part Three — The Sea Cook", where the book has parts. */
  part?: string
  paras: TextPara[]
}

export interface PlayLine {
  /** "1.2.34" — act.scene.line, as printed in the source edition. */
  n: string | null
  text?: string
  stage?: string
}
export interface PlaySpeech {
  who: string
  lines: PlayLine[]
}
export interface PlayScene {
  /** "Induction", "Act I" … */
  act: string
  /** "SCENE II. Padua. A public place." */
  head: string
  stage: string | null
  speeches: PlaySpeech[]
}

/** What the reader loads: prose books are ProseChapter[], plays are PlayScene[]. */
export type BookText = ProseChapter[] | PlayScene[]

export interface FullText {
  slug: string
  kind: TextKind
  title: string
  authors: string[]
  /** Year of first publication, not of this digital edition. */
  year: number
  /** True when this title is on the FCPS English 7 handout. */
  onList: boolean
  /** Slugs from the handout this pairs with — drives "read this next". */
  pairsWith: string[]
  /** One line telling Daniel why this is worth his time. */
  hook: string
  themes: string[]
  /** The digital edition, named precisely enough to be checked. */
  edition: string
  sourceName: string
  sourceUrl: string
  /** Why it is legal to render the whole thing here. */
  rights: string
  /** Roughly how long the whole book runs at ~200 wpm. */
  minutes: number
  words: number
  units: number
  /** What a "chapter" is called in this book. */
  unitNoun: string
}

const PG = (id: number) => ({
  sourceName: `Project Gutenberg eBook #${id}`,
  sourceUrl: `https://www.gutenberg.org/ebooks/${id}`,
  rights: 'Published before 1930 — public domain in the United States. Project Gutenberg boilerplate removed; the text itself is unaltered.',
})

export const FULL_TEXTS: readonly FullText[] = [
  // ── On the English 7 handout ──────────────────────────────────────────────
  {
    slug: 'white-fang', kind: 'prose', title: 'White Fang', authors: ['Jack London'],
    year: 1906, onList: true, pairsWith: ['touching-spirit-bear', 'the-journey-back'],
    hook: 'A wolf-dog learns the law of the wild, then has to unlearn it. London writes the whole first two chapters from outside any human head.',
    themes: ['nature vs. nurture', 'survival', 'cruelty and kindness', 'instinct', 'point of view'],
    edition: 'Transcribed by David Price from the 1915 Methuen & Co. edition',
    ...PG(910), minutes: 360, words: 71944, units: 25, unitNoun: 'chapter',
  },
  {
    slug: 'the-taming-of-the-shrew', kind: 'play', title: 'The Taming of the Shrew',
    authors: ['William Shakespeare'], year: 1623, onList: true,
    pairsWith: ['stargirl', 'brave'],
    hook: 'A comedy that stopped being funny somewhere in the last four hundred years — which is exactly what makes it worth arguing about.',
    themes: ['gender', 'disguise', 'obedience', 'performance', 'marriage'],
    edition: 'The Complete Moby™ Shakespeare, as published by MIT — act, scene and line numbers preserved',
    sourceName: 'shakespeare.mit.edu',
    sourceUrl: 'http://shakespeare.mit.edu/taming_shrew/full.html',
    rights: 'Written c. 1590-92, first printed in the 1623 First Folio. The play and this electronic edition are both in the public domain.',
    minutes: 105, words: 20837, units: 14, unitNoun: 'scene',
  },

  // ── Companions: public-domain books that argue with the ones on the list ──
  {
    slug: 'call-of-the-wild', kind: 'prose', title: 'The Call of the Wild', authors: ['Jack London'],
    year: 1903, onList: false, pairsWith: ['white-fang', 'touching-spirit-bear'],
    hook: 'White Fang run backwards: a comfortable dog dragged into the wild instead of a wild one dragged into a house. Read them as a pair and you can see London arguing with himself.',
    themes: ['the wild', 'survival', 'transformation', 'loyalty', 'civilisation'],
    edition: 'Project Gutenberg plain-text edition',
    ...PG(215), minutes: 160, words: 31721, units: 7, unitNoun: 'chapter',
  },
  {
    slug: 'the-time-machine', kind: 'prose', title: 'The Time Machine', authors: ['H. G. Wells'],
    year: 1895, onList: false, pairsWith: ['the-giver', 'legend', 'surviving-antarctica'],
    hook: 'The first great dystopia. Wells builds a future that looks like paradise for about thirty pages — which is the same trick The Giver plays.',
    themes: ['dystopia', 'class', 'progress', 'time', 'the unreliable narrator'],
    edition: 'Project Gutenberg plain-text edition',
    ...PG(35), minutes: 160, words: 32285, units: 13, unitNoun: 'chapter',
  },
  {
    slug: 'narrative-douglass', kind: 'prose',
    title: 'Narrative of the Life of Frederick Douglass, an American Slave',
    authors: ['Frederick Douglass'], year: 1845, onList: false,
    pairsWith: ['bud-not-buddy', 'the-watsons-go-to-birmingham', 'march', 'discovering-wes-moore'],
    hook: 'Douglass teaches himself to read and understands immediately why he was forbidden to. Chapter VII is one of the most important things ever written about literacy.',
    themes: ['slavery', 'literacy as freedom', 'resistance', 'testimony', 'rhetoric'],
    edition: 'Project Gutenberg plain-text edition of the 1845 Boston Anti-Slavery Office printing',
    ...PG(23), minutes: 180, words: 36168, units: 11, unitNoun: 'chapter',
  },
  {
    slug: 'the-secret-garden', kind: 'prose', title: 'The Secret Garden',
    authors: ['Frances Hodgson Burnett'], year: 1911, onList: false,
    pairsWith: ['the-war-that-saved-my-life', 'fish-in-a-tree'],
    hook: 'Two sour, sickly, unloved children and a locked garden. The closest ancestor of The War That Saved My Life.',
    themes: ['healing', 'neglect', 'growth', 'friendship', 'setting as character'],
    edition: 'Project Gutenberg plain-text edition',
    ...PG(113), minutes: 400, words: 80372, units: 27, unitNoun: 'chapter',
  },
  {
    slug: 'a-christmas-carol', kind: 'prose', title: 'A Christmas Carol',
    authors: ['Charles Dickens'], year: 1843, onList: false,
    pairsWith: ['the-giver', 'walk-two-moons'],
    hook: 'Short enough to read in two sittings, and the cleanest example anywhere of a character actually changing. Watch what Dickens does with weather.',
    themes: ['redemption', 'poverty', 'memory', 'compassion', 'time'],
    edition: 'Project Gutenberg plain-text edition',
    ...PG(46), minutes: 140, words: 28402, units: 5, unitNoun: 'stave',
  },
  {
    slug: 'tom-sawyer', kind: 'prose', title: 'The Adventures of Tom Sawyer',
    authors: ['Mark Twain'], year: 1876, onList: false,
    pairsWith: ['middle-school-is-worse-than-meatloaf', 'hoot', 'the-lightning-thief'],
    hook: 'The original troublemaker narrator. Twain is doing something sly: the funny voice keeps telling you about a town that is not funny at all.',
    themes: ['boyhood', 'freedom', 'superstition', 'satire', 'voice'],
    edition: 'Project Gutenberg plain-text edition',
    ...PG(74), minutes: 350, words: 69789, units: 35, unitNoun: 'chapter',
  },
  {
    slug: 'anne-of-green-gables', kind: 'prose', title: 'Anne of Green Gables',
    authors: ['L. M. Montgomery'], year: 1908, onList: false,
    pairsWith: ['stargirl', 'walk-two-moons', 'the-epic-fail-of-arturo-zamora'],
    hook: 'An orphan who will not stop talking arrives at a farm that wanted a boy. Stargirl a hundred years early.',
    themes: ['imagination', 'belonging', 'nonconformity', 'family you choose', 'ambition'],
    edition: 'Project Gutenberg plain-text edition',
    ...PG(45), minutes: 510, words: 101982, units: 38, unitNoun: 'chapter',
  },
  {
    slug: 'treasure-island', kind: 'prose', title: 'Treasure Island',
    authors: ['Robert Louis Stevenson'], year: 1883, onList: false,
    pairsWith: ['the-lightning-thief', 'miles-morales-spider-man'],
    hook: 'Every pirate you have ever seen is a copy of Long John Silver, and Silver is interesting because you can never decide whose side he is on.',
    themes: ['adventure', 'greed', 'loyalty', 'coming of age', 'the ambiguous villain'],
    edition: 'Project Gutenberg plain-text edition',
    ...PG(120), minutes: 340, words: 67654, units: 34, unitNoun: 'chapter',
  },
  {
    slug: 'the-jungle-book', kind: 'prose', title: 'The Jungle Book',
    authors: ['Rudyard Kipling'], year: 1894, onList: false,
    pairsWith: ['white-fang', 'call-of-the-wild'],
    hook: 'Seven stories, not a novel. "Rikki-Tikki-Tavi" is twenty minutes and is still the best-built short story on this shelf.',
    themes: ['law', 'belonging', 'the animal world', 'empire', 'the short story'],
    edition: 'Project Gutenberg plain-text edition',
    ...PG(236), minutes: 255, words: 50771, units: 7, unitNoun: 'story',
  },
]

const BY_SLUG = new Map(FULL_TEXTS.map((t) => [t.slug, t]))

export function fullTextBySlug(slug: string): FullText | undefined {
  return BY_SLUG.get(slug)
}

/** Does the handout title `slug` have a readable full text in the app? */
export function hasFullText(slug: string): boolean {
  return BY_SLUG.has(slug)
}

/** Public-domain companions suggested for a handout title. */
export function companionsFor(slug: string): FullText[] {
  return FULL_TEXTS.filter((t) => !t.onList && t.pairsWith.includes(slug))
}

export const TOTAL_FULL_TEXT_WORDS = FULL_TEXTS.reduce((n, t) => n + t.words, 0)

/** Where the reader fetches a book's text from. */
export function textUrl(slug: string): string {
  return `/english/texts/${slug}.json`
}
