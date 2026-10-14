import { Extension, type Editor } from '@tiptap/core'

// ProseMirror's Node type, taken from the editor so no extra dependency is needed.
type PMNode = Editor['state']['doc']
import { TUTOR_HEADINGS, type TutorSection } from '@/lib/tutor/reflection-tutor'

export interface TutorAsk {
  question: string
  section: TutorSection
  /** Add a nested line under the student's entry (e.g. the takeaway). */
  addUnderEntry: (text: string) => boolean
}

export interface ReflectionTutorOptions {
  onAsk: ((ask: TutorAsk) => void) | null
}

/** The h2 section a top-level block belongs to, by walking back to the last h2. */
function sectionAt(doc: PMNode, topIndex: number): TutorSection | null {
  for (let i = topIndex; i >= 0; i--) {
    const n = doc.child(i)
    if (n.type.name === 'heading' && n.attrs['level'] === 2) return TUTOR_HEADINGS[n.textContent.trim()] ?? null
  }
  return null
}

/** First paragraph's text of a list item (ignores nested lists such as takeaways). */
function entryText(item: PMNode): string {
  const first = item.firstChild
  return first && first.type.name === 'paragraph' ? first.textContent.trim() : ''
}

/** Find the list item in a tutor section whose entry text matches, and append a nested bullet. */
export function addUnderEntry(editor: Editor, question: string, text: string): boolean {
  const { doc } = editor.state
  let target: { pos: number; node: PMNode } | null = null
  doc.forEach((block, offset, index) => {
    if (target || block.type.name !== 'bulletList' || !sectionAt(doc, index)) return
    block.forEach((item, itemOffset) => {
      if (!target && entryText(item) === question.trim()) target = { pos: offset + 1 + itemOffset, node: item }
    })
  })
  if (!target) return false
  const { pos, node } = target as { pos: number; node: PMNode }
  const line = { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
  const last = node.lastChild
  if (last && last.type.name === 'bulletList' && node.childCount > 1) {
    // Already has nested lines: append inside that list (just before its closing token).
    return editor.chain().insertContentAt(pos + node.nodeSize - 2, line, { updateSelection: false }).run()
  }
  return editor.chain().insertContentAt(pos + node.nodeSize - 1, { type: 'bulletList', content: [line] }, { updateSelection: false }).run()
}

/**
 * Opens the reflection tutor when the student finishes an entry with Enter
 * under "7. Concepts I Still Don't Fully Understand" or "9. Questions I Want
 * to Ask Later". Enter still does its normal job (new bullet); this only
 * notices it. Heading-based like ReflectionAutoGrow, so it works on any note
 * that uses the template, old or new.
 */
export const ReflectionTutorTrigger = Extension.create<ReflectionTutorOptions>({
  name: 'reflectionTutorTrigger',
  // Run before the list item's own Enter (which splits the item and stops there).
  priority: 1000,

  addOptions() {
    return { onAsk: null }
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const onAsk = this.options.onAsk
        if (!onAsk || this.editor.view.composing) return false
        const { state } = this.editor
        const { $from, empty } = state.selection
        if (!empty || $from.depth !== 3) return false
        // Top-level bulletList > listItem > paragraph, caret at the end of the paragraph.
        const list = $from.node(1)
        const item = $from.node(2)
        const para = $from.node(3)
        if (list.type.name !== 'bulletList' || item.type.name !== 'listItem' || para.type.name !== 'paragraph') return false
        if ($from.parentOffset !== para.content.size) return false
        const section = sectionAt(state.doc, $from.index(0))
        if (!section) return false
        const question = para.textContent.trim()
        if (question.length < 6) return false
        const editor = this.editor
        // Let Enter create the next bullet first, then open the tutor.
        setTimeout(() => onAsk({ question, section, addUnderEntry: (text) => addUnderEntry(editor, question, text) }), 0)
        return false
      },
    }
  },
})
