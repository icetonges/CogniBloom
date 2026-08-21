/**
 * English 7 curriculum spine — the skills the tutor actually teaches, and the
 * four layers a given piece of work belongs to.
 *
 * ── A note on Virginia SOL codes ────────────────────────────────────────────
 * Virginia adopted revised English Standards of Learning in 2024. The strand
 * NAMES below are confirmed against VDOE/IXL listings for grade 7 (Reading
 * Literary Text, Reading Informational Text, Reading and Vocabulary, Writing,
 * Research, Language Usage, plus the overarching 7.DSR "developing skilled
 * readers and communicators" strand).
 *
 * The per-skill `solCode` is left NULL wherever the exact 2024 numbering could
 * not be verified from a primary source. Codes are deliberately not invented —
 * a wrong standard code on a student's work is worse than no code. Fill them in
 * from the official grade-7 PDF at doe.virginia.gov and the tutor will start
 * citing them automatically.
 */

export type Strand =
  | 'Reading Literary Text'
  | 'Reading Informational Text'
  | 'Reading and Vocabulary'
  | 'Writing'
  | 'Research'
  | 'Language Usage'
  | 'Communication and Multimodal Literacy'

/**
 * The four layers every piece of English work is filed under. This is the
 * organising idea of the whole module: the same book can appear in more than
 * one layer, with different demands.
 */
export type Layer = 'catch_up' | 'required' | 'recommended' | 'level_up'

export const LAYERS: Record<Layer, {
  label: string
  short: string
  purpose: string
  /** How the tutor should pitch itself when working in this layer. */
  stance: string
  accent: string
  emoji: string
}> = {
  catch_up: {
    label: 'Catch Up',
    short: 'Fix the gap',
    purpose: 'Skills below grade level that are blocking everything above them. Worked on until they stop being a problem, then retired.',
    stance: 'Patient and concrete. Smaller texts, one skill at a time, lots of modelling. Never make him feel behind — frame it as clearing a blockage.',
    accent: '#f59e0b', emoji: '🔧',
  },
  required: {
    label: 'School Requirement',
    short: 'What is assigned',
    purpose: 'The texts and standards the class is actually graded on — the 43 titles on the FCPS list plus grade-7 SOL skills.',
    stance: 'Rigorous and standards-anchored. Every answer needs text evidence. This is the layer that protects the grade.',
    accent: '#6366f1', emoji: '🎓',
  },
  recommended: {
    label: 'School Recommended',
    short: 'Go wider',
    purpose: 'Titles and practice the school suggests but does not grade — thematic pairings, independent reading, the handout’s review sites.',
    stance: 'Curious and low-stakes. Follow what interests him. No grade attached, so risk is cheap.',
    accent: '#22d3ee', emoji: '📚',
  },
  level_up: {
    label: 'Level Up',
    short: 'Past the ceiling',
    purpose: 'Advanced Academic depth and beyond — high-school-level literary analysis, original research, writing for a real audience or contest.',
    stance: 'Demanding. Treat him as a young critic, not a student completing a worksheet. Push for original claims and let him defend them.',
    accent: '#a78bfa', emoji: '🚀',
  },
}

export const LAYER_ORDER: readonly Layer[] = ['catch_up', 'required', 'recommended', 'level_up']

// ── Skills ─────────────────────────────────────────────────────────────────

export interface Skill {
  id: string
  name: string
  strand: Strand
  /** What mastery of this looks like, in plain language. */
  lookLike: string
  /**
   * Socratic prompts. The tutor asks these instead of explaining — they are
   * open, they cannot be answered yes/no, and every one of them sends the
   * student back into the text.
   */
  stems: string[]
  /** Verified 2024 VA SOL code, or null when not yet confirmed. See header. */
  solCode: string | null
  /** Which layers this skill is normally worked in. */
  layers: Layer[]
}

export const SKILLS: readonly Skill[] = [
  // ── Reading Literary Text ──
  {
    id: 'theme', name: 'Theme', strand: 'Reading Literary Text', solCode: null,
    lookLike: 'States a theme as a full sentence about life — not a one-word topic — and traces it across at least three moments in the text.',
    layers: ['required', 'level_up'],
    stems: [
      'You said the theme is “{topic}”. That’s a topic, not yet a theme. What is the book SAYING about {topic}? Say it as a full sentence.',
      'Find the moment where that idea is under the most pressure — where the book almost argues against itself. What happens there?',
      'If the ending had gone the other way, would the theme change? Why?',
      'Which character disagrees with that theme? What does the book do with them?',
    ],
  },
  {
    id: 'character', name: 'Character & motivation', strand: 'Reading Literary Text', solCode: null,
    lookLike: 'Explains WHY a character acts, using something the character does or says rather than what the reader assumes.',
    layers: ['catch_up', 'required'],
    stems: [
      'What does {character} want in this chapter? What is stopping them?',
      'Point to one line that shows that want. Quote it exactly.',
      'Is that what they SAY they want, or what they actually do? Are those different?',
      'What is the biggest thing {character} does that you did not expect? What made it possible?',
    ],
  },
  {
    id: 'evidence', name: 'Text evidence', strand: 'Reading Literary Text', solCode: null,
    lookLike: 'Quotes accurately, keeps the quote short, and follows it with their own explanation rather than letting it stand alone.',
    layers: ['catch_up', 'required', 'level_up'],
    stems: [
      'Good claim. Now find the sentence in the book that proves it — copy it exactly, with the page number.',
      'You quoted it. Now explain in your own words why that quote proves your point. Two sentences.',
      'Is there a shorter piece of that quote that does the same work? Trim it.',
      'What is the strongest piece of evidence AGAINST your claim? Deal with it.',
    ],
  },
  {
    id: 'inference', name: 'Inference', strand: 'Reading Literary Text', solCode: null,
    lookLike: 'Draws a conclusion the text implies but never states, and can name the clues that led there.',
    layers: ['catch_up', 'required'],
    stems: [
      'The book never says that outright. What made you think it?',
      'What does the author expect you to already know for that scene to land?',
      'What is left out of this scene? Why might the author have left it out?',
    ],
  },
  {
    id: 'point-of-view', name: 'Point of view & narrator', strand: 'Reading Literary Text', solCode: null,
    lookLike: 'Identifies who is telling the story and how that shapes — or limits — what the reader is allowed to know.',
    layers: ['required', 'level_up'],
    stems: [
      'Who is telling this? What can they NOT know?',
      'Retell this scene from {otherCharacter}’s side. What changes?',
      'Is the narrator being straight with you here? What makes you doubt them?',
    ],
  },
  {
    id: 'structure', name: 'Text structure', strand: 'Reading Literary Text', solCode: null,
    lookLike: 'Notices how the text is built — chapters, verse, panels, flashbacks — and why that shape suits the story.',
    layers: ['required', 'level_up'],
    stems: [
      'Why is this told in {form} instead of ordinary prose? What does the form let the author do?',
      'Where does time jump? What did the author skip, and why?',
      'Why does the chapter end exactly there?',
    ],
  },
  {
    id: 'figurative', name: 'Figurative language', strand: 'Reading Literary Text', solCode: null,
    lookLike: 'Finds a metaphor, simile or symbol and explains its effect — not just its label.',
    layers: ['catch_up', 'required'],
    stems: [
      'You named it a metaphor. What is being compared to what, and what does the comparison make you feel?',
      'What image comes back more than once in this book? What does it start to stand for?',
      'Rewrite that line in plain language. What is lost?',
    ],
  },

  // ── Reading Informational Text ──
  {
    id: 'main-idea', name: 'Main idea & details', strand: 'Reading Informational Text', solCode: null,
    lookLike: 'States the central idea in one sentence and picks the two or three details that carry it.',
    layers: ['catch_up', 'required'],
    stems: [
      'Say the main idea in one sentence, without using the title.',
      'Which detail could you delete without losing the main idea? Which could you not?',
    ],
  },
  {
    id: 'purpose-bias', name: 'Author’s purpose & bias', strand: 'Reading Informational Text', solCode: null,
    lookLike: 'Names why the text was written and whose interest it serves.',
    layers: ['required', 'level_up'],
    stems: [
      'Why did this person write this? Who were they hoping would read it?',
      'Whose side of this story is missing?',
      'Find a word choice that is doing persuading rather than reporting.',
    ],
  },

  // ── Reading and Vocabulary ──
  {
    id: 'context-clues', name: 'Words in context', strand: 'Reading and Vocabulary', solCode: null,
    lookLike: 'Works out an unfamiliar word from the sentence around it before reaching for a dictionary.',
    layers: ['catch_up', 'required'],
    stems: [
      'Don’t look it up yet. From the sentence alone, what do you think “{word}” means?',
      'What in the sentence gave you that? Now check it — how close were you?',
      'Use “{word}” in a sentence about something in your own week.',
    ],
  },
  {
    id: 'roots', name: 'Roots & affixes', strand: 'Reading and Vocabulary', solCode: null,
    lookLike: 'Breaks an unfamiliar word into parts and uses them to predict meaning.',
    layers: ['catch_up', 'level_up'],
    stems: [
      'Break “{word}” into pieces. What do you recognise?',
      'What other words share that root? What do they have in common?',
    ],
  },
  {
    id: 'connotation', name: 'Connotation', strand: 'Reading and Vocabulary', solCode: null,
    lookLike: 'Explains why an author chose one word over a near-synonym.',
    layers: ['required', 'level_up'],
    stems: [
      'The author wrote “{word}” instead of “{synonym}”. What is the difference in feeling?',
      'Swap in the plainer word. How does the sentence change?',
    ],
  },

  // ── Writing ──
  {
    id: 'thesis', name: 'Thesis', strand: 'Writing', solCode: null,
    lookLike: 'Writes one arguable sentence that a reasonable person could disagree with.',
    layers: ['required', 'level_up'],
    stems: [
      'Could someone argue the opposite of your thesis? If not, it is a fact, not a thesis. Sharpen it.',
      'Which three pieces of evidence will you use? If you cannot name them, the thesis is not ready.',
      'Say your thesis without the words “shows”, “interesting”, or “a lot of”.',
    ],
  },
  {
    id: 'elaboration', name: 'Evidence & elaboration', strand: 'Writing', solCode: null,
    lookLike: 'Every quotation is set up, quoted, then explained in the writer’s own words.',
    layers: ['catch_up', 'required'],
    stems: [
      'You dropped that quote in with no landing. Add a sentence before it and two after.',
      'Your explanation repeats the quote. Say something the quote does not already say.',
    ],
  },
  {
    id: 'organization', name: 'Organization', strand: 'Writing', solCode: null,
    lookLike: 'Paragraphs are ordered because of an argument, not the order things happened in the book.',
    layers: ['required'],
    stems: [
      'Why is that paragraph second and not last?',
      'Read only your first sentences in order. Do they tell the argument on their own?',
    ],
  },
  {
    id: 'revision', name: 'Revision', strand: 'Writing', solCode: null,
    lookLike: 'A second draft that changes structure or argument — not just spelling.',
    layers: ['required', 'level_up'],
    stems: [
      'What is the weakest paragraph? Do not fix it yet — say why it is weakest.',
      'Cut your longest sentence in half. Is anything actually lost?',
      'If you had to delete one paragraph entirely, which one, and what would you need to fix?',
    ],
  },

  // ── Research ──
  {
    id: 'source-eval', name: 'Evaluating sources', strand: 'Research', solCode: null,
    lookLike: 'Asks who made a source and why before using it.',
    layers: ['required', 'level_up'],
    stems: [
      'Who published this, and what do they want from you?',
      'What would a source that disagrees look like? Go find one.',
    ],
  },
  {
    id: 'citation', name: 'Citation', strand: 'Research', solCode: null,
    lookLike: 'Credits every borrowed idea, not just direct quotations.',
    layers: ['required', 'level_up'],
    stems: [
      'That idea is not yours. Where did it come from?',
      'Write the works-cited line for this book from memory, then check it.',
    ],
  },

  // ── Language Usage ──
  {
    id: 'sentence-variety', name: 'Sentence structure', strand: 'Language Usage', solCode: null,
    lookLike: 'Mixes sentence lengths on purpose; can fix a run-on or a fragment on sight.',
    layers: ['catch_up', 'required'],
    stems: [
      'Read that paragraph aloud. Where did you run out of breath?',
      'Turn those two short sentences into one. Now turn the long one into two. Which reads better here?',
    ],
  },
] as const

// ── Lookups ────────────────────────────────────────────────────────────────

const SKILL_BY_ID = new Map(SKILLS.map((s) => [s.id, s]))

export function skillById(id: string): Skill | undefined {
  return SKILL_BY_ID.get(id)
}

export function skillsInLayer(layer: Layer): Skill[] {
  return SKILLS.filter((s) => s.layers.includes(layer))
}

export function skillsInStrand(strand: Strand): Skill[] {
  return SKILLS.filter((s) => s.strand === strand)
}

export const STRANDS: readonly Strand[] = Array.from(new Set(SKILLS.map((s) => s.strand)))

/**
 * Which skills a given book is best suited to teach. Form drives a lot of this:
 * a verse novel is the natural place to work on structure, a memoir on purpose
 * and bias, a play on point of view.
 */
export function skillsForForm(form: string): string[] {
  const base = ['theme', 'character', 'evidence', 'inference', 'context-clues']
  switch (form) {
    case 'novel-in-verse':
    case 'verse-memoir':
      return [...base, 'structure', 'figurative', 'connotation']
    case 'graphic-novel':
      return [...base, 'structure', 'point-of-view']
    case 'memoir':
    case 'autobiography':
    case 'biography':
    case 'diary':
      return [...base, 'purpose-bias', 'main-idea', 'point-of-view']
    case 'nonfiction':
      return ['main-idea', 'purpose-bias', 'evidence', 'source-eval', 'context-clues']
    case 'play':
      return [...base, 'point-of-view', 'structure', 'figurative']
    default:
      return [...base, 'point-of-view', 'figurative']
  }
}
