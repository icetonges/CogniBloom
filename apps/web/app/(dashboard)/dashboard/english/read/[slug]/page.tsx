import { notFound } from 'next/navigation'
import Reader from '@/components/english/reader'
import { FULL_TEXTS, fullTextBySlug } from '@/lib/english'

export function generateStaticParams() {
  return FULL_TEXTS.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const t = fullTextBySlug(slug)
  return { title: t ? `${t.title} · Read` : 'Read' }
}

export default async function ReadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const meta = fullTextBySlug(slug)
  if (!meta) notFound()
  return <Reader meta={meta} />
}
