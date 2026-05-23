'use client'

import {
  useEditor, EditorContent,
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import ImageExtension from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Underline from '@tiptap/extension-underline'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Highlight from '@tiptap/extension-highlight'
import { createLowlight } from 'lowlight'
import {
  useCallback, useRef, useEffect, useState,
  forwardRef, useImperativeHandle,
} from 'react'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote,
  Code, Terminal,
  Superscript as SuperscriptIcon, Subscript as SubscriptIcon,
  Image as ImageIcon, Minus,
  Undo, Redo, Highlighter, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MathExtension, MathInlineExtension } from '@/lib/tiptap/math-extension'
import { MathDialog } from '@/components/notes/MathDialog'
import { SymbolPicker } from '@/components/notes/SymbolPicker'

// Load KaTeX CSS once
import 'katex/dist/katex.min.css'

const lowlight = createLowlight()

export interface RichEditorRef {
  setContent: (html: string) => void
  appendContent: (html: string) => void
  getContent: () => string
}

interface RichEditorProps {
  content: string
  onChange: (html: string) => void
  disabled?: boolean
  placeholder?: string
  noteId?: string
  /** When true, expands the editor to fill available height (full-page mode) */
  fullPage?: boolean
}

interface MathEditState {
  open: boolean
  latex: string
  display: boolean
  pos?: number
}

// ── Toolbar button ──────────────────────────────────────────────────────────
function ToolBtn({
  onClick, active, title, disabled: btnDisabled, children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      disabled={btnDisabled}
      className={cn(
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-primary/20 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]',
        btnDisabled && 'opacity-30 pointer-events-none'
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-4 mx-0.5" style={{ background: 'rgba(255,255,255,0.09)' }} />
}

// ── Main component ────────────────────────────────────────────────────────────
export const RichEditor = forwardRef<RichEditorRef, RichEditorProps>(
  ({ content, onChange, disabled, placeholder, noteId, fullPage }, ref) => {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isInsertingImage, setIsInsertingImage] = useState(false)
    const [mathState, setMathState] = useState<MathEditState>({ open: false, latex: '', display: true })

    const editor = useEditor({
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        CodeBlockLowlight.configure({ lowlight }),
        ImageExtension.configure({ inline: false, allowBase64: true }),
        Placeholder.configure({
          placeholder: placeholder ?? 'Start writing… paste or drag images, type LaTeX formulas.',
        }),
        Underline,
        Subscript,
        Superscript,
        Highlight.configure({ multicolor: false }),
        MathExtension,
        MathInlineExtension,
      ],
      content: content || '',
      editable: !disabled,
      onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),

      editorProps: {
        attributes: {
          class: cn(
            'prose prose-sm prose-invert max-w-none focus:outline-none px-5 py-4',
            fullPage ? 'min-h-[calc(100vh-200px)]' : 'min-h-[320px]'
          ),
        },
        handleDrop: (_view, event: DragEvent) => {
          const files = Array.from(event.dataTransfer?.files ?? [])
          const images = files.filter((f) => f.type.startsWith('image/'))
          if (!images.length) return false
          event.preventDefault()
          images.forEach((f) => uploadImage(f))
          return true
        },
        handlePaste: (_view, event: ClipboardEvent) => {
          // 1. Image files in clipboard (screenshot paste, Ctrl+C from an image)
          const items = Array.from(event.clipboardData?.items ?? [])
          const imageItems = items.filter((i) => i.type.startsWith('image/'))
          if (imageItems.length > 0) {
            event.preventDefault()
            imageItems.forEach((item) => {
              const f = item.getAsFile()
              if (f) uploadImage(f)
            })
            return true
          }
          // Let TipTap handle everything else (text, HTML, etc.)
          return false
        },
      },
    })

    // Expose imperative handle
    useImperativeHandle(ref, () => ({
      setContent: (html: string) => {
        editor?.commands.setContent(html, false)
        onChange(html)
      },
      appendContent: (html: string) => {
        editor?.chain().focus().insertContent(html).run()
        onChange(editor?.getHTML() ?? '')
      },
      getContent: () => editor?.getHTML() ?? '',
    }))

    // Listen for math-click events from NodeView
    useEffect(() => {
      const handler = (e: Event) => {
        const { latex, display, pos } = (e as CustomEvent).detail as { latex: string; display: boolean; pos?: number }
        setMathState({ open: true, latex, display, pos })
      }
      document.addEventListener('tiptap:math-click', handler)
      return () => document.removeEventListener('tiptap:math-click', handler)
    }, [])

    // Convert image file → base64 data URL and insert directly into editor.
    // Works on local dev AND Vercel (no filesystem write needed).
    // TipTap already has allowBase64: true.
    const uploadImage = useCallback((file: File) => {
      if (!editor) return
      setIsInsertingImage(true)
      const reader = new FileReader()
      reader.onload = (e) => {
        const src = e.target?.result as string | null
        if (src) {
          editor.chain().focus().setImage({ src, alt: file.name }).run()
        }
        setIsInsertingImage(false)
      }
      reader.onerror = () => setIsInsertingImage(false)
      reader.readAsDataURL(file)
    }, [editor])

    const insertMath = useCallback((latex: string, display: boolean) => {
      if (!editor) return
      if (mathState.pos !== undefined) {
        // Update existing node
        editor.chain()
          .focus()
          .command(({ tr, editor: ed }) => {
            const nodeType = display
              ? ed.schema.nodes['mathBlock']
              : ed.schema.nodes['mathInline']
            if (!nodeType || mathState.pos === undefined) return false
            const newNode = display
              ? nodeType.create({ latex, display })
              : nodeType.create({ latex })
            tr.replaceWith(mathState.pos, mathState.pos + 1, newNode)
            return true
          })
          .run()
      } else {
        // Insert new node
        if (display) {
          editor.chain().focus().insertContent({
            type: 'mathBlock' as string,
            attrs: { latex, display: true },
          }).run()
        } else {
          editor.chain().focus().insertContent({
            type: 'mathInline' as string,
            attrs: { latex },
          }).run()
        }
      }
    }, [editor, mathState.pos])

    const insertSymbol = useCallback((symbol: string) => {
      editor?.chain().focus().insertContent(symbol).run()
    }, [editor])

    if (!editor) return null

    const isDisabled = !!disabled

    return (
      <>
        <div
          className={cn('overflow-hidden', fullPage ? '' : 'rounded-xl')}
          style={fullPage
            ? {}
            : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }}
        >
          {/* ── Toolbar ── */}
          <div
            className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap"
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            {/* Text style */}
            <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)" disabled={isDisabled}>
              <Bold className="w-3.5 h-3.5" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)" disabled={isDisabled}>
              <Italic className="w-3.5 h-3.5" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)" disabled={isDisabled}>
              <UnderlineIcon className="w-3.5 h-3.5" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough" disabled={isDisabled}>
              <Strikethrough className="w-3.5 h-3.5" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight" disabled={isDisabled}>
              <Highlighter className="w-3.5 h-3.5" />
            </ToolBtn>

            <Divider />

            {/* Headings */}
            <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1" disabled={isDisabled}>
              <Heading1 className="w-3.5 h-3.5" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2" disabled={isDisabled}>
              <Heading2 className="w-3.5 h-3.5" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3" disabled={isDisabled}>
              <Heading3 className="w-3.5 h-3.5" />
            </ToolBtn>

            <Divider />

            {/* Lists */}
            <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list" disabled={isDisabled}>
              <List className="w-3.5 h-3.5" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list" disabled={isDisabled}>
              <ListOrdered className="w-3.5 h-3.5" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote" disabled={isDisabled}>
              <Quote className="w-3.5 h-3.5" />
            </ToolBtn>

            <Divider />

            {/* Code */}
            <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code" disabled={isDisabled}>
              <Code className="w-3.5 h-3.5" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block" disabled={isDisabled}>
              <Terminal className="w-3.5 h-3.5" />
            </ToolBtn>

            <Divider />

            {/* Scripts */}
            <ToolBtn onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} title="Subscript (x₂)" disabled={isDisabled}>
              <SubscriptIcon className="w-3.5 h-3.5" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} title="Superscript (x²)" disabled={isDisabled}>
              <SuperscriptIcon className="w-3.5 h-3.5" />
            </ToolBtn>

            <Divider />

            {/* Math formula */}
            {!isDisabled && (
              <ToolBtn
                onClick={() => setMathState({ open: true, latex: '', display: true, pos: undefined })}
                active={false}
                title="Insert math formula (LaTeX)"
                disabled={isDisabled}
              >
                <span className="text-sm font-serif leading-none">∑</span>
              </ToolBtn>
            )}

            {/* Symbol picker */}
            {!isDisabled && (
              <SymbolPicker onInsert={insertSymbol} />
            )}

            <Divider />

            {/* Image */}
            {!isDisabled && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    Array.from(e.target.files ?? []).forEach((f) => uploadImage(f))
                    e.target.value = ''
                  }}
                />
                <ToolBtn
                  onClick={() => fileInputRef.current?.click()}
                  title="Insert image (or paste / drag-drop)"
                  disabled={isDisabled || isInsertingImage}
                >
                  {isInsertingImage
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <ImageIcon className="w-3.5 h-3.5" />
                  }
                </ToolBtn>
              </>
            )}

            <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule" disabled={isDisabled}>
              <Minus className="w-3.5 h-3.5" />
            </ToolBtn>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Undo / Redo */}
            <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={isDisabled || !editor.can().undo()}>
              <Undo className="w-3.5 h-3.5" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={isDisabled || !editor.can().redo()}>
              <Redo className="w-3.5 h-3.5" />
            </ToolBtn>
          </div>

          {/* ── Editor area ── */}
          <EditorContent editor={editor} />

          {/* ── Hints ── */}
          {!isDisabled && (
            <div
              className="flex items-center gap-4 px-5 pb-2 pt-1"
              style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
            >
              <p className="text-[10px] text-muted-foreground/50">
                Paste or drag images directly · ∑ for LaTeX math · Ω for symbols
              </p>
            </div>
          )}
        </div>

        {/* ── Math dialog ── */}
        <MathDialog
          open={mathState.open}
          initialLatex={mathState.latex}
          isBlock={mathState.display}
          onInsert={insertMath}
          onClose={() => setMathState((s) => ({ ...s, open: false }))}
        />
      </>
    )
  }
)

RichEditor.displayName = 'RichEditor'
