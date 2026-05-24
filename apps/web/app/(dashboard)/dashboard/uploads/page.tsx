'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { FileUpload } from '@/components/uploads/FileUpload'
import { Loader2, File, CheckCircle2, Clock, AlertCircle, Trophy, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

interface Upload {
  id: string
  filename: string
  fileType: string
  fileSize: number
  status: string
  createdAt: string
  noteId: string | null
  _count: { chunks: number }
}

function formatBytes(b: number) {
  return b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`
}

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'ready') return <CheckCircle2 className="w-4 h-4 text-green-500" />
  if (status === 'processing') return <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
  return <AlertCircle className="w-4 h-4 text-red-500" />
}

function filenameToTopic(filename: string) {
  return filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
}

export default function UploadsPage() {
  const router = useRouter()
  const [uploads, setUploads] = useState<Upload[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const refresh = () => {
    fetch('/api/uploads')
      .then((r) => r.json())
      .then(({ data }) => { if (Array.isArray(data)) setUploads(data as Upload[]) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this upload and all its embedded chunks?')) return
    setDeleting(id)
    try {
      await fetch(`/api/uploads?id=${id}`, { method: 'DELETE' })
      setUploads((prev) => prev.filter((u) => u.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const handleQuiz = (upload: Upload) => {
    const topic = filenameToTopic(upload.filename)
    router.push(`/dashboard/quiz?topic=${encodeURIComponent(topic)}`)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">File Uploads 📁</h1>
        <p className="text-muted-foreground mt-1">
          Upload textbooks, worksheets, or notes — they get added to your AI knowledge base automatically.
        </p>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-4">Upload a new file</h2>
        <FileUpload onComplete={() => { setTimeout(refresh, 2000) }} />
      </Card>

      <div>
        <h2 className="font-semibold mb-3">Your uploads</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : uploads.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-sm">
            No uploads yet — drop a PDF or text file above to get started.
          </Card>
        ) : (
          <div className="space-y-2">
            {uploads.map((u) => (
              <Card key={u.id} className="p-3 flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <File className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(u.fileSize)} · {u._count.chunks} chunk{u._count.chunks !== 1 ? 's' : ''} ·{' '}
                    {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <StatusIcon status={u.status} />
                  {u.status === 'ready' && (
                    <button
                      onClick={() => handleQuiz(u)}
                      title="Quiz me on this document"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors ml-1"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(u.id)}
                    disabled={deleting === u.id}
                    title="Delete this upload"
                    className={cn(
                      'p-1.5 rounded-md transition-colors',
                      deleting === u.id
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                    )}
                  >
                    {deleting === u.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card className="p-4 bg-primary/5 border-primary/20 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">How it works</p>
        <p>1. Upload a PDF, TXT, or Markdown file (max 10 MB)</p>
        <p>2. Text is extracted and split into sentence-window chunks for precise retrieval</p>
        <p>3. Each chunk is embedded with Google&apos;s text-embedding-004 (document-optimised task type)</p>
        <p>4. At query time, HyDE + hybrid search finds the most relevant passages from your uploads</p>
        <p>5. The AI tutor automatically draws on your uploads when answering questions</p>
        <p>6. Once ready, click <Trophy className="w-3 h-3 inline" /> to generate a quiz from the document</p>
      </Card>
    </div>
  )
}
