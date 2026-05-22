'use client'

import { useState } from 'react'
import { NotesList } from './NotesList'
import { NoteEditor } from './NoteEditor'
import type { Note } from '@/hooks/useNotes'

export function NotesPage() {
  const [showEditor, setShowEditor] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)

  const handleNewNote = () => {
    setEditingNote(null)
    setShowEditor(true)
  }

  const handleEditNote = (note: Note) => {
    setEditingNote(note)
    setShowEditor(true)
  }

  const handleCloseEditor = () => {
    setShowEditor(false)
    setEditingNote(null)
  }

  const handleSaveNote = () => {
    handleCloseEditor()
  }

  return (
    <div>
      {showEditor ? (
        <NoteEditor
          note={editingNote}
          onClose={handleCloseEditor}
          onSave={handleSaveNote}
        />
      ) : (
        <NotesList
          onNewNote={handleNewNote}
          onEditNote={handleEditNote}
        />
      )}
    </div>
  )
}
