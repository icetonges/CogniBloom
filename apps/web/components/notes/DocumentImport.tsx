'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, FileImage, X, Loader2, CheckCircle2, AlertCircle, FilePlus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImportedDoc {
  id: string
  name: string
  type: 'pdf' | 'docx' | 'txt' | 'image'
  size: number
  status: 'pending' | 'processing' | 'done' | 'error'
  error?: string
  html?: string
  suggestedTitle?: string
}

interface DocumentImportProps {
  /** Called when content is ready to be inserted into the editor */
  onImport: (html: string, suggestedTitle?: string, mode?: 'append' | 'replace') => void
  /** Optional: show a compact trigger button instead of the full panel */
  compact?: boolean
}

const ACCEPTED = '.pdf,.docx,.doc,.txt,image/png,image/jpeg,image/webp,image/gif'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function docType(name: string, mime: string): ImportedDoc['type'] {
  if (mime.startsWith('image/')) return 'image'
  const lower = name.toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'docx'
  return 'txt'
}

export function DocumentImport({ onImport, compact = false }: DocumentImportProps) {
  const [open, setOpen] = useState(false)
  const [docs, setDocs] = useState<ImportedDoc[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [insertMode, setInsertMode] = useState<'append' | 'replace'>('append')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const updateDoc = useCallback((id: string, patch: Partial<ImportedDoc>) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }, [])

  const processFile = useCallback(
    async (file: File) => {
      const id = Math.random().toString(36).slice(2)
      const type = docType(file.name, file.type)

      const doc: ImportedDoc = {
        id,
        name: file.name,
        type,
        size: file.size,
        status: 'processing',
      }
      setDocs((prev) => [...prev, doc])

      try {
        if (type === 'image') {
          // Upload image and get URL
          const form = new FormData()
          form.append('image', file)
          const res = await fetch('/api/notes/upload-image', { method: 'POST', body: form })
          let json: { url?: string; error?: string } = {}
          try { json = await res.json() as typeof json } catch { /* non-JSON response */ }
          if (!json.url) throw new Error(json.error ?? 'Upload failed')
          const alt = file.name.replace(/\.[^.]+$/, '')
          updateDoc(id, { status: 'done', html: `<img src="${json.url}" alt="${alt}" />`, suggestedTitle: alt })
        } else if (type === 'txt') {
          // Read locally — no server needed
          const text = await file.text()
          const html = text
            .split(/\n{2,}/)
            .filter((p) => p.trim())
            .map((para) => `<p>${para.replace(/\n/g, '<br>').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
            .join('')
          const title = file.name.replace(/\.txt$/i, '').replace(/[-_]/g, ' ')
          updateDoc(id, { status: 'done', html, suggestedTitle: title })
        } else {
          // PDF / DOCX — server-side
          const form = new FormData()
          form.append('file', file)
          const res = await fetch('/api/notes/import-document', { method: 'POST', body: form })
          // Guard: server may return HTML on a crash — parse JSON safely
          let json: { success?: boolean; html?: string; title?: string; error?: string } = {}
          try {
            json = await res.json() as typeof json
          } catch {
            throw new Error(`Server error (HTTP ${res.status}) — please try again`)
          }
          if (!res.ok || !json.html) throw new Error(json.error ?? 'Processing failed')
          updateDoc(id, { status: 'done', html: json.html, suggestedTitle: json.title })
        }
      } catch (err) {
        updateDoc(id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to process file',
        })
      }
    },
    [updateDoc]
  )

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach(processFile)
    },
    [processFile]
  )

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  const handleInsert = (doc: ImportedDoc) => {
    if (!doc.html) return
    onImport(doc.html, doc.suggestedTitle, insertMode)
    setDocs((prev) => prev.filter((d) => d.id !== doc.id))
    if (docs.length <= 1) setOpen(false)
  }

  const handleInsertAll = () => {
    const ready = docs.filter((d) => d.status === 'done' && d.html)
    if (ready.length === 0) return
    const combined = ready.map((d) => d.html).join('<hr>')
    onImport(combined, ready[0].suggestedTitle, insertMode)
    setDocs([])
    setOpen(false)
  }

  const removeDoc = (id: string) => setDocs((prev) => prev.filter((d) => d.id !== id))

  const TypeIcon = ({ type }: { type: ImportedDoc['type'] }) => {
    if (type === 'image') return <FileImage className="w-4 h-4" />
    return <FileText className="w-4 h-4" />
  }

  const typeLabel: Record<ImportedDoc['type'], string> = {
    pdf: 'PDF', docx: 'Word', txt: 'Text', image: 'Image',
  }

  if (compact && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Import from file (PDF, DOCX, TXT, Image)"
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors text-muted-foreground hover:text-foreground"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Upload className="w-3.5 h-3.5" /> Import File
      </button>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
      >
        <div className="flex items-center gap-2">
          <FilePlus className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">Import from File</span>
          <span className="text-xs text-muted-foreground">PDF · DOCX · TXT · Image</span>
        </div>
        {compact && (
          <button onClick={() => setOpen(false)} className="p-1 rounded text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-8 cursor-pointer transition-all',
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
          )}
        >
          <Upload className={cn('w-8 h-8', isDragging ? 'text-primary' : 'text-muted-foreground')} />
          <p className="text-sm font-semibold">
            {isDragging ? 'Drop files here' : 'Drag & drop or click to browse'}
          </p>
          <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, PNG, JPG · Max 25 MB each</p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) { handleFiles(e.target.files); e.target.value = '' } }}
          />
        </div>

        {/* File list */}
        {docs.length > 0 && (
          <div className="space-y-2">
            {/* Insert mode toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Insert as:</span>
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                {(['append', 'replace'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setInsertMode(mode)}
                    className={cn(
                      'text-xs font-semibold px-3 py-1 transition-colors capitalize',
                      insertMode === mode ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                    )}
                    style={insertMode === mode ? { background: 'rgba(99,102,241,0.3)' } : {}}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {insertMode === 'append' ? '(add to end)' : '(replace all content)'}
              </span>
            </div>

            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className={cn(
                  'flex-shrink-0',
                  doc.status === 'done' ? 'text-emerald-400' :
                  doc.status === 'error' ? 'text-red-400' :
                  doc.status === 'processing' ? 'text-primary' :
                  'text-muted-foreground'
                )}>
                  {doc.status === 'processing' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : doc.status === 'done' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : doc.status === 'error' ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    <TypeIcon type={doc.type} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{doc.name}</p>
                  {doc.status === 'error' ? (
                    <p className="text-[10px] text-red-400 truncate">{doc.error}</p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">
                      {typeLabel[doc.type]} · {formatBytes(doc.size)}
                      {doc.status === 'done' && doc.suggestedTitle && ` · "${doc.suggestedTitle}"`}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {doc.status === 'done' && (
                    <button
                      onClick={() => handleInsert(doc)}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg text-white transition-colors"
                      style={{ background: 'rgba(99,102,241,0.4)', border: '1px solid rgba(99,102,241,0.3)' }}
                    >
                      Insert
                    </button>
                  )}
                  <button
                    onClick={() => removeDoc(doc.id)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            {/* Insert all button */}
            {docs.filter((d) => d.status === 'done').length > 1 && (
              <button
                onClick={handleInsertAll}
                className="w-full text-xs font-bold py-2 rounded-xl text-white transition-all hover:scale-[1.01]"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                }}
              >
                Insert All ({docs.filter((d) => d.status === 'done').length} files)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
