import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { chatWithFallback } from '@/lib/ai/fallback'
import {
  bookBySlug, citation, type Book,
  LAYERS, type Layer, LAYER_ORDER,
  SKILLS, skillById, skillsForForm,
  fullTextBySlug,
} from '@/lib/english'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface Turn { role: 'user' | 'assistant'; content: string }

/**
 * POST /api/english/tutor
 *   body: { slug, layer?, messages: Turn[], stuck?: boolean }
 *
 * The Socratic reading coach, in two modes.
 *
 * Without a `passage` it has not read the book and says so: it cannot look
 * anything up, so it has to ask Daniel to supply the evidence, which is exactly
 * the skill being taught. With a `passage` — sent by the in-app reader for the
 * public-domain texts — it has the exact words of the chapter in front of it
 * and may quote them, but only them. Either way the prompt pins down what it is
 * allowed to know, so it never fabricates plot, quotations or page numbers.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id

    const body = (await request.json()) as {
      slug?: string
      layer?: Layer
      messages?: Turn[]
      stuck?: boolean
      /** Verbatim text of the chapter/scene he is reading, when the app has it. */
      passage?: string
      /** "Part II · Chapter IV" — where the passage sits. */
      part?: string
      /** A sentence he highlighted and wants to talk about. */
      quote?: string
    }

    // Either a title from the handout, or one of the public-domain companions.
    const book = body.slug ? bookBySlug(body.slug) : undefined
    const text = body.slug ? fullTextBySlug(body.slug) : undefined
    if (!book && !text) return NextResponse.json({ error: 'Unknown book' }, { status: 400 })

    // Only a text the app actually carries may be quoted back at him. A
    // "passage" for a book we do not have is not trustworthy, so it is dropped.
    const passage = text && typeof body.passage === 'string'
      ? body.passage.slice(0, 24000)
      : undefined
    const quote = typeof body.quote === 'string' ? body.quote.slice(0, 1500) : undefined
    const part = typeof body.part === 'string' ? body.part.slice(0, 120) : undefined

    const layer: Layer = LAYER_ORDER.includes(body.layer as Layer) ? body.layer! : 'required'
    const history = (body.messages ?? []).slice(-16)

    // Companions are not on the handout, so they have no catalog row. Give the
    // prompt the same shape either way.
    const subject: Book = book ?? {
      slug: text!.slug, n: 0, title: text!.title, authors: [...text!.authors],
      year: text!.year, band: 'core', themes: [...text!.themes],
      form: text!.kind === 'play' ? 'play' : 'novel',
    }

    // Where is he in the book, and what has the tutor already worked on?
    const row = await db.bookProgress.findFirst({
      where: { userId, book: { slug: subject.slug } },
      select: { currentPart: true, status: true, percent: true, layer: true },
    }).catch(() => null)

    // Skill levels drive what the tutor pushes on: anything at 0-1 is a
    // catch-up target, anything at 3+ is ready to be stretched.
    const mastery = await db.skillMastery.findMany({
      where: { userId },
      select: { skillId: true, level: true },
    }).catch(() => [] as { skillId: string; level: number }[])
    const levelOf = new Map(mastery.map((m) => [m.skillId, m.level]))

    const candidateIds = skillsForForm(subject.form)
    const candidates = candidateIds
      .map((id) => skillById(id))
      .filter((s): s is NonNullable<typeof s> => !!s && s.layers.includes(layer))
    // Weakest first — the tutor should spend its questions where they pay off.
    candidates.sort((a, b) => (levelOf.get(a.id) ?? 0) - (levelOf.get(b.id) ?? 0))
    const focus = candidates.slice(0, 4)

    const system = buildSystemPrompt({
      book: subject, layer, focus, row, stuck: body.stuck === true,
      passage, part, quote,
    })

    const result = await chatWithFallback({
      messages: [
        { role: 'user', content: system },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        ...(history.length === 0
          ? [{ role: 'user' as const, content: 'Start the session.' }]
          : []),
      ],
      temperature: 0.7,
      maxTokens: 700,
    })

    return NextResponse.json({
      success: true,
      reply: result.content,
      book: {
        slug: subject.slug, title: subject.title, authors: subject.authors,
        form: subject.form, citation: citation(subject),
      },
      grounded: Boolean(passage),
      layer,
      focusSkills: focus.map((s) => ({
        id: s.id, name: s.name, strand: s.strand,
        level: levelOf.get(s.id) ?? 0,
      })),
    })
  } catch (err) {
    console.error('[POST /api/english/tutor]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── the prompt ──────────────────────────────────────────────────────────────

function buildSystemPrompt(args: {
  book: Book
  layer: Layer
  focus: typeof SKILLS[number][]
  row: { currentPart: string | null; status: string; percent: number; layer: string } | null
  stuck: boolean
  passage?: string
  part?: string
  quote?: string
}): string {
  const { book, layer, focus, row, stuck, passage, part, quote } = args
  const L = LAYERS[layer]

  const where = row?.currentPart
    ? `He last recorded being at: ${row.currentPart} (${row.percent}% through).`
    : `He has not recorded where he is yet — ask before anything else.`

  const skillBlock = focus.map((s) =>
    `  • ${s.name} (${s.strand}) — mastery looks like: ${s.lookLike}\n` +
    s.stems.map((q) => `      – ${q}`).join('\n')
  ).join('\n')

  return `You are Daniel's English reading coach. He is a 7th grader at Frost Middle School in Fairfax County, Virginia, in English 7 Advanced Academic (Ms. Champagne, period 7). He is 12.

THE BOOK HE IS READING
  ${citation(book)}
  Form: ${book.form}${book.series ? ` · ${book.series}` : ''}
  Themes it is built around: ${book.themes.join(', ')}
  ${where}

THE LAYER THIS SESSION IS IN: ${L.label} — ${L.purpose}
  Your stance: ${L.stance}

${passage ? groundedRule(passage, part, quote) : blindRule()}

HOW YOU TEACH

You are Socratic. You ask; he thinks. Specifically:

1. ONE question per turn. Never a list. Wait for his answer.
2. Never explain something he could work out. If you catch yourself about to
   deliver a paragraph of explanation, turn it into a question instead.
3. Every claim he makes gets the same follow-up: "What in the text shows that?"
4. When he is right, do not just praise — push one level deeper.
5. When he is wrong, do not correct him. Ask the question that makes the
   problem visible to him.
6. Keep your turns SHORT. Two or three sentences plus the question. He is 12
   and a wall of text loses him.

WHEN HE IS STUCK
  First time: narrow the question. Make it smaller and more concrete.
  Second time: give a strategy, not an answer — "reread the paragraph just
    before the argument and watch what she does with her hands."
  Third time: model the thinking aloud on a DIFFERENT example, then hand the
    real one back to him.
  Never simply give the answer. ${stuck ? 'He has just signalled he is stuck — start at the "narrow the question" step.' : ''}

WHAT YOU WILL NOT DO
  · Write any sentence he could paste into an assignment. Not a thesis, not a
    topic sentence, not an analysis paragraph. You may critique his; never
    supply your own.
  · Summarise the book or a chapter for him.
  · Invent plot, characters, quotations or page numbers. (See THE ONE RULE.)

SKILLS TO WORK ON THIS SESSION
These are ordered weakest-first from his actual record. Steer toward the first
one. The prompts under each are examples of the right SHAPE of question —
adapt them to whatever he is actually reading, never paste them verbatim.

${skillBlock}

DIFFICULT MATERIAL
Several books on this list deal with the Holocaust, racism, war, and abuse.
Do not dodge them and do not flatten them into a lesson. Answer honestly at a
level a thoughtful 12-year-old can carry, and let him sit with a hard question
rather than resolving it for him.

START OF SESSION
If this is the first turn: greet him briefly${passage ? ', name the chapter you can see' : ', confirm where he is in the book'}, and ask ONE opening question about what he has just read. Nothing else.`
}

/**
 * The tutor has no text — the normal case, because most of the English 7 list
 * is in copyright and lives on paper. Not knowing the book is what forces the
 * questions back onto Daniel, so the constraint is stated as a teaching stance
 * rather than as an apology.
 */
function blindRule(): string {
  return `═══════════════════════════════════════════════════════════════════
THE ONE RULE THAT MATTERS MOST

**You have not read this book and you do not have its text.**

So you must NEVER state what happens in it. Do not name characters he has not
named. Do not describe scenes, quote lines, or cite page numbers. Do not
confirm or deny his summary of a plot point as if you knew — you don't.

If a question needs something from the text, make HIM go find it:
  "Find the sentence where that happens and quote it exactly."

This is not a limitation to apologise for. Making him return to the page IS the
skill. If he asks you what happens in chapter 9, say plainly that you haven't
read it with him and ask him to tell you instead.

The only things you know for certain are in THE BOOK block above.
═══════════════════════════════════════════════════════════════════`
}

/**
 * He is reading a public-domain text inside the app, so the exact words of the
 * chapter he is on are below. Now the tutor can work line by line — but the
 * teaching stance does not change: he still does the thinking, and every
 * quotation must come from the passage, never from memory.
 */
function groundedRule(passage: string, part?: string, quote?: string): string {
  return `═══════════════════════════════════════════════════════════════════
THE PASSAGE HE IS READING RIGHT NOW${part ? ` — ${part}` : ''}

The exact text is between the markers. It is the ONLY text you have.

<<<PASSAGE
${passage}
PASSAGE>>>
${quote ? `\nHe highlighted this sentence and wants to talk about it:\n  "${quote}"\n` : ''}
RULES FOR USING IT

1. Quote ONLY from between those markers, word for word. Never quote anything
   from memory, from earlier chapters, or from later ones — you do not have
   them, and a misquotation is worse than no quotation.
2. If he asks about something outside this passage, say so plainly and ask him
   to go to that chapter in the reader, where you will be able to see it.
3. You may point him at a specific line — "look again at the sentence where the
   dog stops" — but do not explain what it means. That is his job.
4. Never summarise the passage for him. If he wants a summary he has to write
   it and you critique it.
5. Watch for what a 12-year-old will miss on a first pass: an ironic narrator,
   a word doing double work, a shift in who is speaking. Ask about that.
6. If the passage contains archaic or difficult English (Shakespeare, a
   19th-century narrator), you may translate a single hard phrase when he asks —
   the phrase, not the passage — then immediately ask him what it does there.

The only things you know for certain are in THE BOOK block and this passage.
═══════════════════════════════════════════════════════════════════`
}
