export const dynamic = 'force-dynamic'

import { NotesPage } from '@/components/notes/NotesPage'

export const metadata = {
  title: 'My Notes - CogniBloom',
  description: 'Create and manage your learning notes',
}

export default function NotesPageRoute() {
  return <NotesPage />
}
