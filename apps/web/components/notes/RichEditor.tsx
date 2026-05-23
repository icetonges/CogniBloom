'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight } from 'lowlight'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import { useCallback, useRef } from 'react'
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered,
  Code, Image as ImageIcon, Minus, Undo, Redo,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const lowlight = createLowlight()
lowlight.register('javascript', javascript)
lowlight.register('python', python)
lowlight.register('typescript', typescript)

interface RichEditorProps {
  content: string
  onChange: (html: string) => void
  disabled?: boolean
  placeholder?: string
  noteId?: string // if provided, images upload linked to note
}

export function RichEditor({ content, onChange, disabled, placeholder, noteId }: RichEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadingRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // replaced by CodeBlockLowlight
      }),
      CodeBlockLowlight.configure({ lowlight }),
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Start writing your note… paste or drag images directly in.',
      }),
    ],
    content: content || '',
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm prose-invert max-w-none focus:outline-none min-h-[260px] px-4 py-3',
      },
      handleDrop: (_view: unknown, event: DragEvent) => {
        const files = Array.from(event.dataTransfer?.files ?? []) as File[]
        const imageFiles = files.filter((f: File) => f.type.startsWith('image/'))
        if (imageFiles.length === 0) return false
        event.preventDefault()
        imageFiles.forEach((file: File) => uploadImage(file))
        return true
      },
      handlePaste: (_view: unknown, event: ClipboardEvent) => {
        const items = Array.from(event.clipboardData?.items ?? []) as DataTransferItem[]
        const imageItems = items.filter((i: DataTransferItem) => i.type.startsWith('image/'))
        if (imageItems.length === 0) return false
        imageItems.forEach((item: DataTransferItem) => {
          const file = item.getAsFile()
          if (file) uploadImage(file)
        })
        return true
      },
    },
  })

  const uploadImage = useCallback(async (file: File) => {
    if (uploadingRef.current) return
    uploadingRef.current = true
    try {
      const formData = new FormData()
      formData.append('image', file)
      if (noteId) formData.append('noteId', noteId)

      const res = await fetch('/api/notes/upload-image', { method: 'POST', body: formData })
      const json = await res.json() as { url?: string; error?: string }
      if (json.url && editor) {
        editor.chain().focus().setImage({ src: json.url, alt: file.name }).run()
      }
    } catch {
      // silent — image upload failed, user sees nothing inserted
    } finally {
      uploadingRef.current = false
    }
  }, [editor, noteId])

  if (!editor) return null

  const ToolbarBtn = ({
    onClick, active, title, children,
  }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-primary/20 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]',
        disabled && 'opacity-40 pointer-events-none'
      )}
    >
      {children}
    </button>
  )

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
      >
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <Bold className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <Italic className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />

        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />

        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          <List className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />

        <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">
          <Code className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
          <Minus className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* Image upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) uploadImage(file)
            e.target.value = ''
          }}
        />
        <ToolbarBtn onClick={() => fileInputRef.current?.click()} title="Insert image">
          <ImageIcon className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 mx-1 ml-auto" style={{ background: 'rgba(255,255,255,0.1)' }} />

        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo className="w-3.5 h-3.5" />
        </ToolbarBtn>
      </div>

      {/* Editor body */}
      <EditorContent editor={editor} />

      {/* Drop hint */}
      {!disabled && (
        <p className="px-4 pb-2 text-[10px] text-muted-foreground/50">
          Drag & drop or paste images directly into the editor
        </p>
      )}
    </div>
  )
}
