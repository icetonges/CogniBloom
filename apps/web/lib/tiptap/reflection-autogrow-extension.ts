import { Extension } from '@tiptap/core'

// Heading titles (exact match, trimmed) for the Daily Reflection template
// sections whose bullet lists should grow automatically. Sections 1–2, the
// Self-Check Quiz (13, a Q&A ordered list), and Progress Summary (14, fixed
// labeled fields) are intentionally excluded — only 3–12 are open-ended
// "one bullet per thought" lists that benefit from growing as you write.
const GROWABLE_HEADINGS = new Set([
  '3. What I Learned Today',
  '4. Important Knowledge Points',
  '5. Questions I Got Wrong or Mistaken Made',
  '6. Why I Got Them Wrong',
  "7. Concepts I Still Don't Fully Understand",
  '8. Improvement Notes',
  '9. Questions I Want to Ask Later',
  '10. Connections to Things I Learned Before',
  '11. One Small Win Today 🎉',
  '12. What I Should Review Tomorrow',
])

/**
 * Auto-grows specific bullet lists in the Daily Reflection template.
 *
 * The template ships with a small starter number of blank <li> items per
 * section (e.g. 3 lines under "Questions I Got Wrong"). Rather than capping
 * the section at that number, this extension watches every update: as soon
 * as the *last* item in one of the matched sections is filled in, a fresh
 * empty item is appended right after it — so there's always exactly one
 * blank line ready to write in, and the list keeps extending for as long as
 * the person keeps writing.
 *
 * Detection is heading-text based (not tied to note type), so it only ever
 * fires inside a list that directly follows one of the exact section
 * headings above — regular notes and the Investment template are unaffected.
 */
export const ReflectionAutoGrow = Extension.create({
  name: 'reflectionAutoGrow',

  onUpdate() {
    const { editor } = this
    if (!editor || editor.isDestroyed) return

    const { doc } = editor.state
    let inGrowableSection = false
    const insertPositions: number[] = []

    doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && node.attrs['level'] === 2) {
        inGrowableSection = GROWABLE_HEADINGS.has(node.textContent.trim())
        return true
      }
      if (node.type.name === 'bulletList' && inGrowableSection) {
        const lastItem = node.lastChild
        if (lastItem && lastItem.type.name === 'listItem' && lastItem.textContent.trim().length > 0) {
          // End of this list's content — where a new last child gets inserted.
          insertPositions.push(pos + node.nodeSize - 1)
        }
        return false // no need to descend into list items themselves
      }
      return true
    })

    if (insertPositions.length === 0) return

    // Insert from the bottom of the doc upward so earlier positions in this
    // batch stay valid as each insertion shifts everything after it.
    insertPositions.sort((a, b) => b - a)
    let chain = editor.chain()
    for (const pos of insertPositions) {
      // updateSelection: false — keep the caret exactly where the person is
      // typing instead of jumping them into the newly appended blank item.
      chain = chain.insertContentAt(
        pos,
        { type: 'listItem', content: [{ type: 'paragraph' }] },
        { updateSelection: false }
      )
    }
    chain.run()
  },
})
