/**
 * The shelf — every book Daniel can read end-to-end inside CogniBloom.
 *
 * Two of them are on Ms. Champagne's handout. The rest are public-domain books
 * chosen because they argue with something on that list: read White Fang and
 * The Call of the Wild together and London's two answers to the same question
 * are impossible to miss.
 */

import Link from 'next/link'
import { ArrowLeft, BookOpen, Clock, Library } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { FULL_TEXTS, TOTAL_FULL_TEXT_WORDS, bookBySlug } from '@/lib/english'

export const metadata = { title: 'Full texts · English 7' }

export default function ReadShelfPage() {
  const onList = FULL_TEXTS.filter((t) => t.onList)
  const companions = FULL_TEXTS.filter((t) => !t.onList)

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <Link
        href="/dashboard/english"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> English 7
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">Read the whole thing</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
        {FULL_TEXTS.length} books, {TOTAL_FULL_TEXT_WORDS.toLocaleString()} words of real text —
        every chapter, every line, nothing summarised. Highlight any sentence to save it as a
        note or hand it to the tutor, who can read the page you are on.
      </p>

      <Section
        title="On your English 7 list"
        note="These two are old enough to be out of copyright, so the whole text is here."
        texts={onList}
      />
      <Section
        title="Read alongside"
        note="Public-domain books that pair with a title on the list. Each card says which one and why."
        texts={companions}
      />

      <p className="mt-12 border-t border-white/10 pt-6 text-xs leading-relaxed text-neutral-600">
        Everything else on the handout is still in copyright, so the text cannot live here.
        Open that book&rsquo;s page instead: it has the chapter workshop, the borrowing links for
        Fairfax County Public Library, and the tutor.
      </p>
    </div>
  )
}

function Section({
  title, note, texts,
}: { title: string; note: string; texts: typeof FULL_TEXTS }) {
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Library className="h-4 w-4 text-orange-300" /> {title}
      </h2>
      <p className="mt-1 text-xs text-neutral-500">{note}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {texts.map((t) => {
          const pairs = t.pairsWith
            .map((s) => bookBySlug(s)?.title)
            .filter(Boolean) as string[]
          return (
            <Link key={t.slug} href={`/dashboard/english/read/${t.slug}`}>
              <Card className="flex h-full flex-col border-white/10 bg-[#050505] p-5 transition hover:border-orange-400/40">
                <p className="text-base font-semibold leading-snug">{t.title}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {t.authors.join(', ')} · {t.year}
                </p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-neutral-400">{t.hook}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" /> {t.units} {t.unitNoun}s
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> ~{Math.round(t.minutes / 60)} h
                  </span>
                  <span>{t.words.toLocaleString()} words</span>
                </div>
                {pairs.length > 0 && (
                  <p className="mt-3 border-t border-white/5 pt-3 text-[11px] text-neutral-600">
                    Pairs with <span className="text-neutral-400">{pairs.join(', ')}</span>
                  </p>
                )}
              </Card>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
