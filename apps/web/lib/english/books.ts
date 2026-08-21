/**
 * English 7 AA — the full-length texts Daniel's class may use in 2026-27.
 *
 * Transcribed from the FCPS handout ("Your child's class may include the
 * following full-length texts this year"), then every citation verified
 * against publisher, award-body and library records. **The handout contains
 * 15 errors** — misspelled authors, missing co-authors, wrong titles. Each is
 * recorded in `handoutSays` / `correction` rather than silently fixed, so the
 * sheet can still be matched line-by-line against this file.
 *
 * The catalog lives in code (versioned, reviewable, diffable) and is ingested
 * into the `EnglishBook` table by /api/english/ingest — same pattern as the
 * school calendar. Progress and tutoring history live only in the database.
 */

export type BookForm =
  | 'novel'
  | 'novel-in-verse'
  | 'graphic-novel'
  | 'memoir'
  | 'verse-memoir'
  | 'biography'
  | 'autobiography'
  | 'nonfiction'
  | 'play'
  | 'diary'

/**
 * Rough reading demand relative to a 7th-grade Advanced Academic reader.
 * Deliberately a three-way band rather than a Lexile number — publisher Lexiles
 * are inconsistent across editions and inventing them would be worse than
 * useless for placing a real student.
 */
export type Band = 'accessible' | 'core' | 'stretch'

export interface Book {
  /** URL-safe id, also the folder name under content/english/. */
  slug: string
  /** Position on the printed handout (1-43), for line-by-line checking. */
  n: number
  title: string
  subtitle?: string
  authors: string[]
  year: number
  form: BookForm
  band: Band
  themes: string[]
  /** Verbatim from the handout, when it differs from the verified citation. */
  handoutSays?: string
  /** What was wrong and how it was corrected. */
  correction?: string
  /** Needs a decision from the teacher before buying/borrowing. */
  ambiguity?: string
  /** Slugs of thematically paired titles — drives the "level up" ladder. */
  pairsWith?: string[]
  /** Series context, where the title alone is misleading. */
  series?: string
}

export const BOOKS: readonly Book[] = [
  // ── Left column of the handout ──
  {
    slug: 'the-giver', n: 1, title: 'The Giver', authors: ['Lois Lowry'], year: 1993,
    form: 'novel', band: 'core',
    themes: ['dystopia', 'memory', 'conformity', 'free will', 'coming of age'],
    pairsWith: ['legend', 'surviving-antarctica'],
  },
  {
    slug: 'touching-spirit-bear', n: 2, title: 'Touching Spirit Bear', authors: ['Ben Mikaelsen'], year: 2001,
    form: 'novel', band: 'core',
    themes: ['restorative justice', 'anger', 'healing', 'nature', 'accountability'],
    pairsWith: ['the-journey-back', 'red-kayak'],
  },
  {
    slug: 'red-kayak', n: 3, title: 'Red Kayak', authors: ['Priscilla Cummings'], year: 2004,
    form: 'novel', band: 'core',
    themes: ['moral responsibility', 'guilt', 'friendship', 'consequences'],
    pairsWith: ['the-journey-back', 'touching-spirit-bear'],
  },
  {
    slug: 'the-journey-back', n: 4, title: 'The Journey Back', authors: ['Priscilla Cummings'], year: 2012,
    form: 'novel', band: 'core',
    themes: ['juvenile justice', 'redemption', 'family', 'second chances'],
    pairsWith: ['red-kayak', 'touching-spirit-bear'],
  },
  {
    slug: 'surviving-antarctica', n: 5, title: 'Surviving Antarctica', subtitle: 'Reality TV 2083',
    authors: ['Andrea White'], year: 2005, form: 'novel', band: 'core',
    themes: ['survival', 'media manipulation', 'class', 'courage', 'dystopia'],
    handoutSays: 'Surviving Antarctica by Andrea White',
    correction: 'Handout omits the subtitle “Reality TV 2083”.',
    pairsWith: ['the-giver', 'legend'],
  },
  {
    slug: 'anne-frank-diary', n: 6, title: 'Anne Frank: The Diary of a Young Girl',
    authors: ['Anne Frank'], year: 1947, form: 'diary', band: 'stretch',
    themes: ['the Holocaust', 'hope', 'adolescence', 'persecution', 'identity'],
    handoutSays: 'Anne Frank: Diary of a Young Girl',
    correction: 'Canonical title includes “The”. Handout names no author. First published in Dutch as Het Achterhuis (1947); first English edition 1952.',
    pairsWith: ['the-diary-of-anne-frank-play', 'the-children-of-willesden-lane'],
  },
  {
    slug: 'stargirl', n: 7, title: 'Stargirl', authors: ['Jerry Spinelli'], year: 2000,
    form: 'novel', band: 'accessible',
    themes: ['nonconformity', 'individuality', 'peer pressure', 'kindness'],
    pairsWith: ['gracefully-grayson', 'brave'],
  },
  {
    slug: 'walk-two-moons', n: 8, title: 'Walk Two Moons', authors: ['Sharon Creech'], year: 1994,
    form: 'novel', band: 'core',
    themes: ['grief', 'journey', 'storytelling', 'empathy', 'nested narrative'],
    pairsWith: ['the-crossover', 'fish-in-a-tree'],
  },
  {
    slug: 'under-a-war-torn-sky', n: 9, title: 'Under a War-Torn Sky', authors: ['L. M. Elliott'], year: 2001,
    form: 'novel', band: 'core',
    themes: ['World War II', 'courage', 'the Resistance', 'survival'],
    handoutSays: 'Under a War Torn Sky by L.M. Elliot',
    correction: 'Title hyphenates “War-Torn”. Author surname is Elliott with two t’s.',
    pairsWith: ['under-the-blood-red-sun', 'code-talker'],
  },
  {
    slug: 'under-the-blood-red-sun', n: 10, title: 'Under the Blood-Red Sun',
    authors: ['Graham Salisbury'], year: 1994, form: 'novel', band: 'core',
    themes: ['World War II', 'Japanese American incarceration', 'prejudice', 'loyalty', 'family'],
    handoutSays: 'Under a Blood Red Sun by Graham Salisbury',
    correction: 'Title is “Under THE Blood-Red Sun”, not “a”, and hyphenates “Blood-Red”.',
    pairsWith: ['code-talker', 'under-a-war-torn-sky'],
  },
  {
    slug: 'bud-not-buddy', n: 11, title: 'Bud, Not Buddy', authors: ['Christopher Paul Curtis'], year: 1999,
    form: 'novel', band: 'accessible',
    themes: ['the Great Depression', 'family', 'resilience', 'humor', 'searching'],
    pairsWith: ['the-watsons-go-to-birmingham', 'brown-girl-dreaming'],
  },
  {
    slug: 'i-will-always-write-back', n: 12, title: 'I Will Always Write Back',
    subtitle: 'How One Letter Changed Two Lives',
    authors: ['Caitlin Alifirenka', 'Martin Ganda', 'Liz Welch'], year: 2015,
    form: 'memoir', band: 'core',
    themes: ['friendship across distance', 'poverty', 'Zimbabwe', 'education', 'privilege'],
    handoutSays: 'I Will Always Write Back by Caitlin Alifirenka and Martin Ganda',
    correction: 'Handout omits the subtitle and the third credited author, Liz Welch.',
    pairsWith: ['amal-unbound', 'when-stars-are-scattered'],
  },
  {
    slug: 'middle-school-is-worse-than-meatloaf', n: 13, title: 'Middle School Is Worse Than Meatloaf',
    subtitle: 'A Year Told Through Stuff',
    authors: ['Jennifer L. Holm', 'Elicia Castaldi'], year: 2007, form: 'novel', band: 'accessible',
    themes: ['middle school', 'family', 'humor', 'documentary form'],
    handoutSays: 'Middle School is Worse Than Meatloaf by Jennifer L. Holm',
    correction: 'Canonical title capitalizes “Is”. Handout omits the subtitle and illustrator Elicia Castaldi, whose artwork carries the “told through stuff” format.',
    pairsWith: ['smile', 'brave'],
  },
  {
    slug: 'the-diary-of-anne-frank-play', n: 14, title: 'The Diary of Anne Frank',
    authors: ['Frances Goodrich', 'Albert Hackett'], year: 1955, form: 'play', band: 'core',
    themes: ['the Holocaust', 'dramatic adaptation', 'staging', 'hope'],
    handoutSays: 'The Diary of Anne Frank (play version)',
    correction: 'Handout names no authors. Dramatized by Frances Goodrich and Albert Hackett; 1956 Pulitzer Prize for Drama.',
    ambiguity: 'A widely staged 1997 revision by Wendy Kesselman also exists. Ask which script the class uses.',
    pairsWith: ['anne-frank-diary'],
  },
  {
    slug: 'the-watsons-go-to-birmingham', n: 15, title: 'The Watsons Go to Birmingham—1963',
    authors: ['Christopher Paul Curtis'], year: 1995, form: 'novel', band: 'core',
    themes: ['the Civil Rights Movement', 'family', 'the 16th Street bombing', 'humor and tragedy'],
    handoutSays: 'The Watsons Go to Birmingham, 1963 by Christoper Paul Curtis',
    correction: 'Author misspelled — Christopher. Canonical title uses an em dash, not a comma.',
    pairsWith: ['march', 'bud-not-buddy'],
  },
  {
    slug: 'code-talker', n: 16, title: 'Code Talker',
    subtitle: 'A Novel About the Navajo Marines of World War Two',
    authors: ['Joseph Bruchac'], year: 2005, form: 'novel', band: 'stretch',
    themes: ['Navajo language', 'World War II', 'cultural identity', 'boarding schools', 'service'],
    handoutSays: 'Code Talker by Joseph Bruchac',
    correction: 'Handout omits the subtitle.',
    pairsWith: ['jim-thorpe', 'under-the-blood-red-sun'],
  },
  {
    slug: 'hoot', n: 17, title: 'Hoot', authors: ['Carl Hiaasen'], year: 2002,
    form: 'novel', band: 'accessible',
    themes: ['environmental activism', 'standing up', 'humor', 'community'],
    pairsWith: ['the-epic-fail-of-arturo-zamora'],
  },
  {
    slug: 'ghost', n: 18, title: 'Ghost', authors: ['Jason Reynolds'], year: 2016,
    form: 'novel', band: 'accessible', series: 'Track, Book 1',
    themes: ['running', 'trauma', 'self-worth', 'mentorship', 'second chances'],
    pairsWith: ['the-crossover', 'miles-morales-spider-man'],
  },
  {
    slug: 'the-taming-of-the-shrew', n: 19, title: 'The Taming of the Shrew',
    authors: ['William Shakespeare'], year: 1623, form: 'play', band: 'stretch',
    themes: ['Shakespearean comedy', 'gender and power', 'marriage', 'disguise', 'verse drama'],
    handoutSays: 'Taming of the Shrew by William Shakespeare',
    correction: 'Canonical title begins with “The”. Written c. 1590-94; 1623 is first publication (First Folio), not first performance.',
    pairsWith: [],
  },
  {
    slug: 'the-crossover', n: 20, title: 'The Crossover', authors: ['Kwame Alexander'], year: 2014,
    form: 'novel-in-verse', band: 'accessible',
    themes: ['basketball', 'brotherhood', 'grief', 'fathers and sons', 'poetic form'],
    handoutSays: 'Crossover by Kwame Alexander',
    correction: 'Canonical title begins with “The”. 2015 Newbery Medal.',
    pairsWith: ['ghost', 'brown-girl-dreaming', 'inside-out-and-back-again'],
  },
  {
    slug: 'fish-in-a-tree', n: 21, title: 'Fish in a Tree', authors: ['Lynda Mullaly Hunt'], year: 2015,
    form: 'novel', band: 'accessible',
    themes: ['dyslexia', 'self-worth', 'teachers who see you', 'hidden ability'],
    pairsWith: ['el-deafo', 'the-lightning-thief'],
  },
  {
    slug: 'legend', n: 22, title: 'Legend', authors: ['Marie Lu'], year: 2011,
    form: 'novel', band: 'core',
    themes: ['dystopia', 'class division', 'rebellion', 'dual narration'],
    pairsWith: ['the-giver', 'surviving-antarctica'],
  },

  // ── Right column of the handout ──
  {
    slug: 'white-fang', n: 23, title: 'White Fang', authors: ['Jack London'], year: 1906,
    form: 'novel', band: 'stretch',
    themes: ['nature and civilization', 'survival', 'naturalism', 'animal perspective'],
    pairsWith: ['touching-spirit-bear'],
  },
  {
    slug: 'the-epic-fail-of-arturo-zamora', n: 24, title: 'The Epic Fail of Arturo Zamora',
    authors: ['Pablo Cartaya'], year: 2017, form: 'novel', band: 'core',
    themes: ['community', 'gentrification', 'Cuban American identity', 'family business', 'first love'],
    handoutSays: 'Epic Fail of Arturo Zamora by Pablo Cartaya',
    correction: 'Canonical title begins with “The”.',
    pairsWith: ['hoot', 'new-kid'],
  },
  {
    slug: 'the-war-that-saved-my-life', n: 25, title: 'The War That Saved My Life',
    authors: ['Kimberly Brubaker Bradley'], year: 2015, form: 'novel', band: 'core',
    themes: ['World War II evacuation', 'disability', 'abuse and rescue', 'belonging'],
    pairsWith: ['the-children-of-willesden-lane', 'under-a-war-torn-sky'],
  },
  {
    slug: 'amal-unbound', n: 26, title: 'Amal Unbound', authors: ['Aisha Saeed'], year: 2018,
    form: 'novel', band: 'core',
    themes: ['Pakistan', 'girls’ education', 'indentured servitude', 'courage', 'literacy'],
    pairsWith: ['i-am-malala', 'i-will-always-write-back'],
  },
  {
    slug: 'discovering-wes-moore', n: 27, title: 'Discovering Wes Moore',
    subtitle: 'The Young Adult Adaptation', authors: ['Wes Moore'], year: 2012,
    form: 'memoir', band: 'core',
    themes: ['two fates', 'choices and circumstance', 'Baltimore', 'mentorship', 'parallel lives'],
    handoutSays: 'Discovering Wes Moore by Wes Moore',
    correction: 'This is the young-adult adaptation of Moore’s 2010 adult book The Other Wes Moore: One Name, Two Fates — a distinct edition, not a reprint.',
    pairsWith: ['march', 'ghost'],
  },
  {
    slug: 'jim-thorpe', n: 28, title: 'Jim Thorpe, Original All-American',
    authors: ['Joseph Bruchac'], year: 2006, form: 'biography', band: 'core',
    themes: ['Native American identity', 'athletics', 'Indian boarding schools', 'prejudice', 'fame'],
    handoutSays: 'Jim Thorpe:Original All American Joseph Bruchac',
    correction: 'Canonical title uses a comma, not a colon, and hyphenates “All-American”. Handout omits “by”.',
    ambiguity: 'A fictionalized biography told in Thorpe’s first-person voice — some catalogs shelve it as a novel.',
    pairsWith: ['code-talker', 'reaching-for-the-moon'],
  },
  {
    slug: 'i-am-malala', n: 29, title: 'I Am Malala',
    subtitle: 'How One Girl Stood Up for Education and Changed the World',
    authors: ['Malala Yousafzai', 'Patricia McCormick'], year: 2014, form: 'memoir', band: 'core',
    themes: ['girls’ education', 'activism', 'the Taliban', 'courage', 'Pakistan'],
    handoutSays: 'I am Malala by Malala Yousafzai',
    correction: 'Capitalize “Am”. Handout omits the subtitle and co-author.',
    ambiguity: 'TWO editions exist. The adult original (2013) is co-written with Christina Lamb; the Young Readers Edition (2014) with Patricia McCormick. A grade-7 list almost certainly means the Young Readers Edition — listed here — but confirm before buying.',
    pairsWith: ['amal-unbound', 'when-stars-are-scattered'],
  },
  {
    slug: 'brown-girl-dreaming', n: 30, title: 'Brown Girl Dreaming',
    authors: ['Jacqueline Woodson'], year: 2014, form: 'verse-memoir', band: 'core',
    themes: ['becoming a writer', 'the Civil Rights era', 'family', 'North and South', 'memory'],
    handoutSays: 'Brown Girl Dreaming by Jaqueline Woodson',
    correction: 'Author misspelled — Jacqueline. Form is a memoir in free verse, not a prose novel. 2014 National Book Award.',
    pairsWith: ['the-crossover', 'inside-out-and-back-again', 'march'],
  },
  {
    slug: 'gracefully-grayson', n: 31, title: 'Gracefully Grayson', authors: ['Ami Polonsky'], year: 2014,
    form: 'novel', band: 'core',
    themes: ['gender identity', 'self-expression', 'acceptance', 'theater'],
    pairsWith: ['stargirl', 'brave'],
  },
  {
    slug: 'el-deafo', n: 32, title: 'El Deafo', authors: ['Cece Bell'], year: 2014,
    form: 'graphic-novel', band: 'accessible',
    themes: ['deafness', 'disability', 'friendship', 'imagination', 'graphic memoir'],
    pairsWith: ['smile', 'fish-in-a-tree'],
  },
  {
    slug: 'brave', n: 33, title: 'Brave', authors: ['Svetlana Chmakova'], year: 2017,
    form: 'graphic-novel', band: 'accessible', series: 'Berrybrook Middle School, Book 2',
    themes: ['bullying', 'self-advocacy', 'middle school social life', 'friendship'],
    pairsWith: ['new-kid', 'smile'],
  },
  {
    slug: 'new-kid', n: 34, title: 'New Kid', authors: ['Jerry Craft'], year: 2019,
    form: 'graphic-novel', band: 'accessible',
    themes: ['race and belonging', 'code-switching', 'private school', 'microaggressions', 'friendship'],
    pairsWith: ['brave', 'miles-morales-spider-man', 'the-epic-fail-of-arturo-zamora'],
  },
  {
    slug: 'miles-morales-spider-man', n: 35, title: 'Miles Morales: Spider-Man',
    authors: ['Jason Reynolds'], year: 2017, form: 'novel', band: 'core',
    themes: ['identity and heritage', 'heroism', 'systemic racism', 'history repeating'],
    handoutSays: 'Miles Morales Spiderman by Jason Reynolds',
    correction: 'Canonical title takes a colon and hyphenates “Spider-Man”.',
    pairsWith: ['ghost', 'new-kid'],
  },
  {
    slug: 'smile', n: 36, title: 'Smile', authors: ['Raina Telgemeier'], year: 2010,
    form: 'graphic-novel', band: 'accessible',
    themes: ['adolescence', 'friendship that isn’t', 'body image', 'graphic memoir'],
    pairsWith: ['el-deafo', 'brave'],
  },
  {
    slug: 'inside-out-and-back-again', n: 37, title: 'Inside Out & Back Again',
    authors: ['Thanhhà Lại'], year: 2011, form: 'novel-in-verse', band: 'core',
    themes: ['refugee experience', 'the fall of Saigon', 'immigration', 'language loss', 'verse form'],
    handoutSays: 'Inside Out and Back Again by Thanhha Lai',
    correction: 'Author’s name carries Vietnamese diacritics: Thanhhà Lại. First edition uses an ampersand. 2011 National Book Award.',
    pairsWith: ['when-stars-are-scattered', 'the-crossover', 'brown-girl-dreaming'],
  },
  {
    slug: 'witness', n: 38, title: 'Witness', authors: ['Karen Hesse'], year: 2001,
    form: 'novel-in-verse', band: 'stretch',
    themes: ['the Klan in Vermont', 'multiple voices', 'antisemitism and racism', 'small-town silence'],
    pairsWith: ['march', 'the-watsons-go-to-birmingham'],
  },
  {
    slug: 'when-stars-are-scattered', n: 39, title: 'When Stars Are Scattered',
    authors: ['Victoria Jamieson', 'Omar Mohamed'], year: 2020, form: 'graphic-novel', band: 'accessible',
    themes: ['refugee camps', 'brotherhood', 'education as escape', 'Somalia', 'waiting'],
    handoutSays: 'When Stars are Scattered by Victoria Jamieson',
    correction: 'Handout omits co-author OMAR MOHAMED, whose true story this is and who is credited on the cover. Capitalize “Are”.',
    pairsWith: ['inside-out-and-back-again', 'amal-unbound', 'i-am-malala'],
  },
  {
    slug: 'march', n: 40, title: 'March: Book One',
    authors: ['John Lewis', 'Andrew Aydin', 'Nate Powell'], year: 2013,
    form: 'graphic-novel', band: 'stretch', series: 'March trilogy (Books One–Three)',
    themes: ['the Civil Rights Movement', 'nonviolent resistance', 'John Lewis', 'primary witness'],
    handoutSays: 'March by John Lewis',
    correction: 'THREE creators, not one: Lewis and Andrew Aydin co-wrote; Nate Powell drew it. All three are credited on the cover.',
    ambiguity: 'A trilogy — Book One (2013), Two (2015), Three (2016). Confirm which volume(s) the class assigns.',
    pairsWith: ['the-watsons-go-to-birmingham', 'brown-girl-dreaming', 'witness'],
  },
  {
    slug: 'the-lightning-thief', n: 41, title: 'The Lightning Thief',
    authors: ['Rick Riordan'], year: 2005, form: 'novel', band: 'accessible',
    series: 'Percy Jackson and the Olympians, Book 1',
    themes: ['Greek mythology', 'ADHD and dyslexia reframed', 'heroism', 'quest structure'],
    handoutSays: 'Percy Jackson: The Lightning Thief by Rick Riordan',
    correction: 'Canonical title is “The Lightning Thief”; “Percy Jackson and the Olympians” is the series, not the title.',
    pairsWith: ['fish-in-a-tree'],
  },
  {
    slug: 'the-children-of-willesden-lane', n: 42, title: 'The Children of Willesden Lane',
    subtitle: 'Beyond the Kindertransport — A Memoir of Music, Love, and Survival',
    authors: ['Mona Golabek', 'Lee Cohen'], year: 2002, form: 'memoir', band: 'core',
    themes: ['the Kindertransport', 'music as survival', 'the Holocaust', 'separation from family'],
    handoutSays: 'The Children of Willesden Lane by Monda Golabek and Lee Cohen',
    correction: 'Author misspelled — Mona Golabek. Handout omits the subtitle.',
    ambiguity: 'A young-readers adaptation (2017) also exists. Confirm which edition is assigned.',
    pairsWith: ['anne-frank-diary', 'the-war-that-saved-my-life'],
  },
  {
    slug: 'reaching-for-the-moon', n: 43, title: 'Reaching for the Moon',
    subtitle: 'The Autobiography of NASA Mathematician Katherine Johnson',
    authors: ['Katherine Johnson'], year: 2019, form: 'autobiography', band: 'core',
    themes: ['segregation', 'mathematics', 'NASA', 'perseverance', 'being first'],
    handoutSays: 'Reaching for the Moon by Katherine Johnson',
    correction: 'Handout omits the subtitle. This is the young-readers autobiography.',
    pairsWith: ['jim-thorpe', 'brown-girl-dreaming'],
  },
] as const

// ── Reference links printed on the handout ─────────────────────────────────

export const HANDOUT_RESOURCES: readonly { label: string; url: string }[] = [
  { label: 'Fairfax County Public Library', url: 'https://www.fairfaxcounty.gov/library/' },
  { label: 'School Library Journal', url: 'https://www.slj.com' },
  { label: 'Booklist', url: 'https://www.booklistonline.com' },
  { label: 'Bartleby.com', url: 'https://www.bartleby.com' },
  { label: 'Book Reporter', url: 'https://www.bookreporter.com' },
  { label: 'Book Spot', url: 'https://www.bookspot.com/' },
  { label: 'Teen Reads', url: 'https://www.teenreads.com' },
] as const

/** The policy paragraphs from the handout, kept verbatim for reference. */
export const HANDOUT_POLICY = {
  additions:
    'If there are any additions to this list, you will be notified at least two weeks before the additional novel will be used.',
  maturity:
    'Some of these texts may contain mature content and/or controversial material. More information about these books — including academic reviews — can be found on the sites listed above.',
  optOut:
    'Parents/guardians may contact the teacher if they do not want their child to read the selected book, and teachers can help find an alternative book that fits the same theme.',
  review:
    'If you would like to review any of these texts or request an alternate reading assignment, or if you have any questions or concerns, please feel free to contact your child’s English teacher.',
} as const

// ── Lookups ────────────────────────────────────────────────────────────────

const BY_SLUG = new Map(BOOKS.map((b) => [b.slug, b]))

export function bookBySlug(slug: string): Book | undefined {
  return BY_SLUG.get(slug)
}

export function bookByNumber(n: number): Book | undefined {
  return BOOKS.find((b) => b.n === n)
}

/** Every book whose citation the handout got wrong. */
export const CORRECTED_BOOKS: readonly Book[] = BOOKS.filter((b) => !!b.correction)

/** Books needing a teacher decision (edition, volume, script). */
export const AMBIGUOUS_BOOKS: readonly Book[] = BOOKS.filter((b) => !!b.ambiguity)

export function booksByForm(form: BookForm): Book[] {
  return BOOKS.filter((b) => b.form === form)
}

export function booksByBand(band: Band): Book[] {
  return BOOKS.filter((b) => b.band === band)
}

export function booksByTheme(theme: string): Book[] {
  const t = theme.toLowerCase()
  return BOOKS.filter((b) => b.themes.some((x) => x.toLowerCase().includes(t)))
}

/** Every distinct theme across the list, most common first. */
export function allThemes(): { theme: string; count: number }[] {
  const m = new Map<string, number>()
  for (const b of BOOKS) for (const t of b.themes) m.set(t, (m.get(t) ?? 0) + 1)
  return Array.from(m, ([theme, count]) => ({ theme, count })).sort((a, b) => b.count - a.count)
}

export function searchBooks(q: string, limit = 12): Book[] {
  const s = q.trim().toLowerCase()
  if (!s) return []
  return BOOKS.filter((b) =>
    `${b.title} ${b.subtitle ?? ''} ${b.authors.join(' ')} ${b.themes.join(' ')} ${b.form}`
      .toLowerCase()
      .includes(s)
  ).slice(0, limit)
}

/** Citation as it should be written in an essay or works-cited entry. */
export function citation(b: Book): string {
  const authors =
    b.authors.length === 1 ? b.authors[0]
    : b.authors.length === 2 ? `${b.authors[0]} and ${b.authors[1]}`
    : `${b.authors.slice(0, -1).join(', ')}, and ${b.authors[b.authors.length - 1]}`
  const title = b.subtitle ? `${b.title}: ${b.subtitle}` : b.title
  return `${authors}. ${title}. ${b.year}.`
}
