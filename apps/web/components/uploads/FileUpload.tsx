'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Upload, File, Loader2, CheckCircle2, X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Vercel serverless body limit — files above this go via Vercel Blob direct upload
const DIRECT_UPLOAD_THRESHOLD = 4 * 1024 * 1024  // 4 MB

interface UploadedFile {
  id: string
  filename: string
  fileSize: number
  charsExtracted: number
  status: string
}

interface FileUploadProps {
  noteId?: string
  onComplete?: (upload: UploadedFile) => void
}

export function FileUpload({ noteId, onComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!['application/pdf', 'text/plain', 'text/markdown'].includes(file.type)) {
      setError('Unsupported file type. Please upload a PDF, TXT, or MD file.')
      return
    }
    // No hard upper limit — we route large files through Vercel Blob.
    // The practical cap is 50 MB (configured in /api/uploads/blob-token).
    if (file.size > 50 * 1024 * 1024) {
      setError('File too large. Maximum is 50 MB.')
      return
    }

    setIsUploading(true)
    setError(null)
    setUploaded(null)

    try {
      let json: { success: boolean; data: UploadedFile; error?: string }

      if (file.size > DIRECT_UPLOAD_THRESHOLD) {
        // ── Large file: upload directly to Vercel Blob, then process ──────
        // Dynamic import so the blob client code is not bundled for small uploads
        const { upload } = await import('@vercel/blob/client')

        let blobUrl: string
        try {
          const blob = await upload(file.name, file, {
            access: 'public',
            handleUploadUrl: '/api/uploads/blob-token',
          })
          blobUrl = blob.url
        } catch (blobErr) {
          // Blob not set up yet — show a clear setup message
          const msg = String(blobErr)
          if (msg.includes('503') || msg.includes('not configured') || msg.includes('BLOB_READ_WRITE_TOKEN')) {
            throw new Error(
              'Large-file upload requires Vercel Blob. ' +
              'Go to vercel.com → your project → Storage → Create a Blob store, ' +
              'then redeploy. For now, use a PDF compressed under 4 MB.'
            )
          }
          throw blobErr
        }

        // Tell the server to download from blob and process
        const res = await fetch('/api/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blobUrl,
            filename: file.name,
            fileSize: file.size,
            mimeType: file.type,
            noteId: noteId ?? undefined,
          }),
        })
        json = await res.json() as typeof json
        if (!res.ok) throw new Error(json.error ?? 'Processing failed')

      } else {
        // ── Small file: standard binary multipart upload ──────────────────
        const formData = new FormData()
        formData.append('file', file)
        if (noteId) formData.append('noteId', noteId)

        const res = await fetch('/api/uploads', { method: 'POST', body: formData })
        // Guard: Vercel returns a plain-text HTML 413 on body-size violation
        try {
          json = await res.json() as typeof json
        } catch {
          if (res.status === 413) throw new Error('File too large — server rejected it. Try compressing the PDF.')
          throw new Error(`Server error (HTTP ${res.status}). Please try again.`)
        }
        if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      }

      setUploaded(json.data)
      onComplete?.(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const formatBytes = (b: number) =>
    b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40',
          isUploading && 'pointer-events-none opacity-60'
        )}
      >
        <input
          ref={inputRef} type="file" className="hidden"
          accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Uploading and extracting text…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop a file here or click to browse</p>
            <p className="text-xs text-muted-foreground">PDF, TXT, or Markdown · up to 50 MB</p>
            <p className="text-xs text-primary">Text is extracted and added to your AI knowledge base</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Success */}
      {uploaded && (
        <Card className="p-3 flex items-center gap-3 border-green-500/30 bg-green-500/5">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{uploaded.filename}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(uploaded.fileSize)} · {uploaded.charsExtracted.toLocaleString()} chars extracted · embedding in progress
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setUploaded(null)}>
            <X className="w-4 h-4" />
          </Button>
        </Card>
      )}
    </div>
  )
}

// Compact button variant for inline use
export function FileUploadButton({ noteId, onComplete }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFile = async (file: File) => {
    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    if (noteId) formData.append('noteId', noteId)
    try {
      const res = await fetch('/api/uploads', { method: 'POST', body: formData })
      const json = await res.json() as { success: boolean; data: UploadedFile }
      if (res.ok && json.success) onComplete?.(json.data)
    } catch { /* silent */ }
    finally { setIsUploading(false) }
  }

  return (
    <>
      <input ref={inputRef} type="file" className="hidden"
        accept=".pdf,.txt,.md"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}
        disabled={isUploading} className="gap-1.5">
        {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <File className="w-3.5 h-3.5" />}
        {isUploading ? 'Uploading…' : 'Upload file'}
      </Button>
    </>
  )
}
