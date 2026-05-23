export const dynamic = 'force-dynamic'

import { NoteDetailClient } from '@/components/notes/NoteDetailClient'

export default async function NoteSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <NoteDetailClient slug={slug} />
}
