import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { ReflectionTutorTrigger, addUnderEntry, type TutorAsk } from '@/lib/tiptap/reflection-tutor-extension'

const DOC = `
<h2>6. Why I Got Them Wrong</h2><ul><li><p>Rushed the diagram</p></li></ul>
<h2>7. Concepts I Still Don't Fully Understand</h2>
<blockquote><p>Be specific.</p></blockquote>
<ul><li><p>I still do not understand why light travels faster than sound.</p></li></ul>
<h2>9. Questions I Want to Ask Later</h2>
<ul><li><p>Why light travel faster than sound?</p></li></ul>`

function setup() {
  const asks: TutorAsk[] = []
  const editor = new Editor({
    extensions: [StarterKit, ReflectionTutorTrigger.configure({ onAsk: (a) => asks.push(a) })],
    content: DOC,
  })
  return { editor, asks }
}

/** Put the caret at the end of the first paragraph whose text includes `needle`. */
function caretAtEnd(editor: Editor, needle: string) {
  let at = -1
  editor.state.doc.descendants((n, pos) => {
    if (at === -1 && n.type.name === 'paragraph' && n.textContent.includes(needle)) at = pos + n.nodeSize - 1
  })
  editor.commands.setTextSelection(at)
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('ReflectionTutorTrigger', () => {
  beforeAll(() => {
    // ProseMirror asks for layout info jsdom doesn't have.
    document.createRange = () => {
      const range = new Range()
      range.getBoundingClientRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) })
      range.getClientRects = () => ({ item: () => null, length: 0, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
      return range
    }
  })

  it('opens the tutor on Enter at the end of a section 7 entry, and still adds a new bullet', async () => {
    const { editor, asks } = setup()
    caretAtEnd(editor, 'light travels faster')
    editor.commands.keyboardShortcut('Enter')
    await flush()
    expect(asks).toHaveLength(1)
    expect(asks[0]).toMatchObject({ question: 'I still do not understand why light travels faster than sound.', section: 'concept' })
    // Normal Enter behaviour: the section now has two bullets.
    expect(editor.getHTML()).toMatch(/faster than sound\.<\/p><\/li><li><p><\/p><\/li>/)
  })

  it('uses the "later" section for section 9', async () => {
    const { editor, asks } = setup()
    caretAtEnd(editor, 'Why light travel')
    editor.commands.keyboardShortcut('Enter')
    await flush()
    expect(asks[0]?.section).toBe('later')
  })

  it('ignores other sections and Enter in the middle of a line', async () => {
    const { editor, asks } = setup()
    caretAtEnd(editor, 'Rushed the diagram')
    editor.commands.keyboardShortcut('Enter')
    let mid = -1
    editor.state.doc.descendants((n, pos) => {
      if (mid === -1 && n.type.name === 'paragraph' && n.textContent.startsWith('Why light')) mid = pos + 4
    })
    editor.commands.setTextSelection(mid)
    editor.commands.keyboardShortcut('Enter')
    await flush()
    expect(asks).toHaveLength(0)
  })

  it('adds the takeaway under the matching entry, then appends to it', async () => {
    const { editor, asks } = setup()
    caretAtEnd(editor, 'light travels faster')
    editor.commands.keyboardShortcut('Enter')
    await flush()
    expect(asks[0].addUnderEntry('💡 Light does not need air.')).toBe(true)
    expect(editor.getHTML()).toContain('faster than sound.</p><ul><li><p>💡 Light does not need air.</p></li></ul></li>')
    expect(addUnderEntry(editor, asks[0].question, '💡 Sound needs air.')).toBe(true)
    expect(editor.getHTML()).toContain('<ul><li><p>💡 Light does not need air.</p></li><li><p>💡 Sound needs air.</p></li></ul>')
    expect(addUnderEntry(editor, 'not in the note', 'x')).toBe(false)
  })
})
