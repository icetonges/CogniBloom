import { Node, mergeAttributes } from '@tiptap/core'

type NodeAttrs = Record<string, unknown>
type NodeViewArgs = { node: { attrs: NodeAttrs }; getPos: (() => number | undefined) | boolean }
type RenderArgs = { node: { attrs: NodeAttrs }; HTMLAttributes: NodeAttrs }

/**
 * Block math node — renders a KaTeX formula as a standalone block.
 * Click to edit via MathDialog (fired via DOM custom event).
 */
export const MathExtension = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      latex: { default: '' },
      display: { default: true },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-math-block]' }]
  },

  renderHTML({ node, HTMLAttributes }: RenderArgs) {
    return [
      'div',
      mergeAttributes(HTMLAttributes as Record<string, string>, {
        'data-math-block': '',
        'data-latex': String(node.attrs['latex']),
        class: 'math-block-node',
      }),
    ]
  },

  addNodeView() {
    return ({ node, getPos }: NodeViewArgs) => {
      const dom = document.createElement('div')
      dom.className = 'math-node-wrapper'
      dom.style.cssText = [
        'display:block',
        'cursor:pointer',
        'margin:8px 0',
        'padding:10px 16px',
        'border-radius:8px',
        'background:rgba(99,102,241,0.07)',
        'border:1px solid rgba(99,102,241,0.22)',
        'text-align:center',
        'position:relative',
        'min-height:40px',
      ].join(';')

      const hint = document.createElement('span')
      hint.textContent = '✎ click to edit'
      hint.style.cssText = [
        'position:absolute',
        'top:3px',
        'right:8px',
        'font-size:9px',
        'color:rgba(165,180,252,0.5)',
        'font-family:system-ui,sans-serif',
        'pointer-events:none',
      ].join(';')
      dom.appendChild(hint)

      const renderKatex = async () => {
        try {
          const katex = (await import('katex')).default
          const inner = document.createElement('div')
          inner.style.display = 'inline-block'
          katex.render(String(node.attrs['latex'] || '\\text{Click to enter formula}'), inner, {
            displayMode: Boolean(node.attrs['display']),
            throwOnError: false,
            errorColor: '#ef4444',
          })
          dom.querySelectorAll('div').forEach((el) => el.remove())
          dom.appendChild(inner)
        } catch {
          const fallback = document.createElement('div')
          fallback.textContent = String(node.attrs['latex'])
          dom.appendChild(fallback)
        }
      }

      renderKatex()

      dom.addEventListener('click', () => {
        const pos = typeof getPos === 'function' ? getPos() : undefined
        document.dispatchEvent(
          new CustomEvent('tiptap:math-click', {
            detail: {
              latex: node.attrs['latex'],
              display: node.attrs['display'],
              pos,
            },
          })
        )
      })

      return { dom }
    }
  },
})

/**
 * Inline math node — renders KaTeX inline within text.
 */
export const MathInlineExtension = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-math-inline]' }]
  },

  renderHTML({ node, HTMLAttributes }: RenderArgs) {
    return [
      'span',
      mergeAttributes(HTMLAttributes as Record<string, string>, {
        'data-math-inline': '',
        'data-latex': String(node.attrs['latex']),
        class: 'math-inline-node',
      }),
    ]
  },

  addNodeView() {
    return ({ node, getPos }: NodeViewArgs) => {
      const dom = document.createElement('span')
      dom.style.cssText = [
        'display:inline-block',
        'cursor:pointer',
        'padding:1px 5px',
        'border-radius:4px',
        'background:rgba(99,102,241,0.07)',
        'border:1px solid rgba(99,102,241,0.2)',
        'vertical-align:middle',
      ].join(';')

      const renderKatex = async () => {
        try {
          const katex = (await import('katex')).default
          katex.render(String(node.attrs['latex'] || ''), dom, {
            displayMode: false,
            throwOnError: false,
            errorColor: '#ef4444',
          })
        } catch {
          dom.textContent = String(node.attrs['latex'])
        }
      }

      renderKatex()

      dom.addEventListener('click', () => {
        const pos = typeof getPos === 'function' ? getPos() : undefined
        document.dispatchEvent(
          new CustomEvent('tiptap:math-click', {
            detail: {
              latex: node.attrs['latex'],
              display: false,
              pos,
            },
          })
        )
      })

      return { dom }
    }
  },
})
