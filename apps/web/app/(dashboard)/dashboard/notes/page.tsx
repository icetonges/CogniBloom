export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { NotesIndexClient } from '@/components/notes/NotesIndexClient'

export const metadata = { title: 'My Notes - CogniBloom' }

export default function NotesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <NotesIndexClient />
    </Suspense>
  )
}
