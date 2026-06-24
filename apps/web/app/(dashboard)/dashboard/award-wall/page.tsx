'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2, Plus, Trash2, Trophy, Star, Flame, Zap,
  BookOpen, Medal, Award, GraduationCap, X, Check,
  ZoomIn, FileText, Sparkles, Upload, Pencil, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { extractCertificateInfo } from './actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BadgeItem {
  id: string; name: string; emoji: string; description: string
  category: string; earned: boolean; earnedAt: string | null
}

interface GamificationData {
  xp: number; level: number; xpInLevel: number; xpNeeded: number
  progressPct: number; streak: number; longestStreak: number
  earnedBadges: BadgeItem[]; totalBadges: number
}

interface CustomAward {
  id: string
  title: string
  description: string
  emoji: string
  date: string
  fileData?: string       // base64 data URL (full file — images / small PDFs)
  fileThumbnail?: string  // base64 PNG rendered from first page
  fileName?: string
  fileType?: 'image' | 'pdf'
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_TITLES: Record<number, string> = {
  1: 'Seedling', 2: 'Sprout', 3: 'Sapling', 4: 'Branch',
  5: 'Rising Star', 6: 'Learner', 7: 'Scholar', 8: 'Expert',
  9: 'Mentor', 10: 'Star Student', 15: 'Prodigy', 20: 'Sage',
}
const AWARD_EMOJIS = ['🏆','🥇','🎖️','🌟','⭐','🎓','🏅','💡','🚀','🔥','💎','🎯','📚','✍️','🧠','🎤']
const STORAGE_KEY = 'cognibloom_award_wall'
const MAX_FULL_BYTES = 3 * 1024 * 1024  // store full file only if ≤ 3 MB

const MILESTONE_BADGES = [
  { xp: 100,   emoji: '🌱', label: 'First 100 XP',     desc: 'Earned your first 100 XP' },
  { xp: 500,   emoji: '⚡', label: '500 XP Club',       desc: 'Reached 500 total XP' },
  { xp: 1000,  emoji: '🌟', label: '1K XP Scholar',     desc: 'Crossed 1,000 XP milestone' },
  { xp: 2500,  emoji: '🏆', label: '2,500 XP Champion', desc: 'Mastered 2,500 XP earned' },
  { xp: 5000,  emoji: '💎', label: 'Diamond Learner',   desc: '5,000 XP — elite territory' },
  { xp: 10000, emoji: '👑', label: 'Legendary Scholar', desc: '10,000 XP — legendary status' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLevelTitle(level: number): string {
  const keys = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => b - a)
  for (const k of keys) { if (level >= k) return LEVEL_TITLES[k] ?? 'Seedling' }
  return 'Seedling'
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function loadCustomAwards(): CustomAward[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as CustomAward[] } catch { return [] }
}
function saveCustomAwards(awards: CustomAward[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(awards)) }
  catch { alert('Storage full — try removing older awards to make room.') }
}
function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file)
  })
}

// ─── File processor (shared between Add and Edit) ──────────────────────────────

interface ProcessedFile {
  fileData?: string
  fileThumbnail?: string
  fileName: string
  fileType: 'image' | 'pdf'
  extractedTitle?: string
  extractedDescription?: string
  extractedDate?: string
}

async function processUploadedFile(
  file: File,
  onProgress: (msg: string) => void
): Promise<ProcessedFile> {
  const isPdf = file.type === 'application/pdf'
  const isImage = file.type.startsWith('image/')
  if (!isPdf && !isImage) throw new Error('Upload a PDF or image file')
  if (file.size > MAX_FULL_BYTES + 1024 * 1024) {
    // > 4 MB — Vercel will reject the thumbnail request with 413
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 4 MB — try compressing the PDF.`)
  }

  const result: ProcessedFile = {
    fileName: file.name,
    fileType: isPdf ? 'pdf' : 'image',
  }

  if (isImage) {
    onProgress('Reading image…')
    result.fileData = await fileToBase64(file)
    result.fileThumbnail = result.fileData
  } else {
    // Generate thumbnail via server (renders actual page 1)
    onProgress('Rendering certificate preview…')
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/award-wall/thumbnail', { method: 'POST', body: fd })
      if (res.ok) {
        const { thumbnail } = await res.json() as { thumbnail: string }
        result.fileThumbnail = thumbnail
      }
    } catch { /* continue without thumbnail */ }

    // Store full PDF only if small enough
    if (file.size <= MAX_FULL_BYTES) {
      result.fileData = await fileToBase64(file)
    }
  }

  // AI extraction
  onProgress('Extracting certificate info with AI…')
  const fd2 = new FormData(); fd2.append('file', file)
  const extracted = await extractCertificateInfo(fd2)
  if (!extracted.error) {
    result.extractedTitle = extracted.title
    result.extractedDescription = extracted.description
    result.extractedDate = extracted.date
  }

  return result
}

// ─── Award Modal (Add + Edit) ─────────────────────────────────────────────────

function AwardModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: CustomAward
  onSave: (award: Omit<CustomAward, 'id'>) => void
  onClose: () => void
}) {
  const isEdit = !!initial

  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🏆')
  const [date, setDate] = useState(initial?.date ? initial.date.slice(0, 10) : new Date().toISOString().slice(0, 10))

  const [fileThumbnail, setFileThumbnail] = useState<string | undefined>(initial?.fileThumbnail)
  const [fileData, setFileData] = useState<string | undefined>(initial?.fileData)
  const [fileName, setFileName] = useState<string | undefined>(initial?.fileName)
  const [fileType, setFileType] = useState<'image' | 'pdf' | undefined>(initial?.fileType)

  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Set name/type immediately so the processing UI renders before async work starts
    setFileName(file.name)
    setFileType(file.type.startsWith('image/') ? 'image' : 'pdf')
    setStatus('processing')
    setStatusMsg('Reading file…')
    try {
      const processed = await processUploadedFile(file, setStatusMsg)
      setFileThumbnail(processed.fileThumbnail)
      setFileData(processed.fileData)
      setFileName(processed.fileName)
      setFileType(processed.fileType)
      // Auto-fill only if fields are empty (don't overwrite manual edits)
      if (processed.extractedTitle && !title) setTitle(processed.extractedTitle)
      if (processed.extractedDescription && !description) setDescription(processed.extractedDescription)
      if (processed.extractedDate && date === new Date().toISOString().slice(0, 10))
        setDate(processed.extractedDate.slice(0, 10))
      setStatus('done')
      setStatusMsg('Certificate info extracted ✓')
    } catch (err) {
      setStatus('error')
      setStatusMsg(String(err))
    }
  }, [title, description, date])

  const clearFile = () => {
    setFileThumbnail(undefined); setFileData(undefined)
    setFileName(undefined); setFileType(undefined)
    setStatus('idle'); setStatusMsg('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      description: description.trim(),
      emoji,
      date: new Date(date).toISOString(),
      fileData,
      fileThumbnail,
      fileName,
      fileType,
    })
    onClose()
  }

  const busy = status === 'processing'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-5 my-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            {isEdit
              ? <><Pencil className="w-5 h-5 text-primary" /> Edit Award</>
              : <><Award className="w-5 h-5 text-primary" /> Add Accomplishment</>
            }
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {/* ── File / certificate upload ── */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
            Certificate / Document
            <span className="ml-1 font-normal opacity-70">(PDF or image — AI auto-fills fields)</span>
          </label>

          {fileThumbnail ? (
            /* Show rendered preview */
            <div className="relative rounded-xl overflow-hidden border border-border bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileThumbnail} alt="Certificate preview" className="w-full max-h-64 object-contain" />
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="p-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors"
                  title="Replace file"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={clearFile}
                  className="p-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors"
                  title="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {fileName && <p className="text-[10px] text-muted-foreground px-3 py-1.5 truncate">📎 {fileName}</p>}
            </div>
          ) : fileName ? (
            /* File selected but no thumbnail yet */
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                {busy
                  ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  : <FileText className="w-4 h-4 text-red-500" />
                }
                <span className="text-sm font-medium truncate flex-1">{fileName}</span>
                {!busy && <button onClick={clearFile} className="p-1 hover:bg-muted rounded"><X className="w-3.5 h-3.5" /></button>}
              </div>
              {statusMsg && (
                <p className={cn('text-xs flex items-center gap-1.5',
                  status === 'done' ? 'text-green-500' : status === 'error' ? 'text-amber-500' : 'text-muted-foreground'
                )}>
                  {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                  {status === 'done' && <Sparkles className="w-3 h-3" />}
                  {statusMsg}
                </p>
              )}
            </div>
          ) : (
            /* Drop zone */
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="w-full border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 flex flex-col items-center gap-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Upload className="w-8 h-8 opacity-50" />
              <div className="text-center">
                <p className="text-sm font-semibold">Click to upload certificate</p>
                <p className="text-xs opacity-60 mt-0.5">PDF, JPG, PNG · max 4 MB</p>
              </div>
            </button>
          )}
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFile} />
        </div>

        {/* Status message (when no file selected but processing) */}
        {statusMsg && !fileName && (
          <p className="text-xs text-muted-foreground">{statusMsg}</p>
        )}

        {/* ── Emoji ── */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Icon</label>
          <div className="flex flex-wrap gap-2">
            {AWARD_EMOJIS.map((e) => (
              <button key={e} onClick={() => setEmoji(e)} className={cn(
                'text-xl w-9 h-9 rounded-lg transition-all flex items-center justify-center',
                emoji === e ? 'bg-primary/20 border-2 border-primary scale-110' : 'bg-muted hover:bg-muted/70 border border-transparent'
              )}>{e}</button>
            ))}
          </div>
        </div>

        {/* ── Title ── */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            ref={inputRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="e.g. Introduction to Python Programming"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            maxLength={120}
          />
        </div>

        {/* ── Description ── */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Description <span className="font-normal text-muted-foreground/70">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Completed with distinction — CodeWizards"
            rows={2}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            maxLength={300}
          />
        </div>

        {/* ── Date ── */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim() || busy} className="flex-1 gap-2">
            <Check className="w-3.5 h-3.5" />
            {isEdit ? 'Save Changes' : 'Add to Wall'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── File Viewer (lightbox) ───────────────────────────────────────────────────

function FileViewer({ award, onClose }: { award: CustomAward; onClose: () => void }) {
  const hasFullData = award.fileData && award.fileData !== 'pdf:too-large'
  const displaySrc = award.fileThumbnail ?? (hasFullData ? award.fileData : undefined)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 shrink-0" onClick={e => e.stopPropagation()}>
        <div>
          <p className="font-bold text-white text-sm">{award.emoji} {award.title}</p>
          {award.description && <p className="text-xs text-white/60 mt-0.5">{award.description}</p>}
          {award.fileName && <p className="text-[10px] text-white/40 mt-0.5">📎 {award.fileName}</p>}
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
        {displaySrc ? (
          award.fileType === 'pdf' && hasFullData ? (
            <iframe src={award.fileData!} title={award.title}
              className="w-full rounded-lg border border-white/10 bg-white"
              style={{ maxWidth: '900px', height: '80vh' }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displaySrc} alt={award.title}
              className="max-w-full object-contain rounded-xl shadow-2xl bg-white"
              style={{ maxHeight: '80vh' }} />
          )
        ) : (
          <div className="text-center text-white/60 space-y-3">
            <FileText className="w-16 h-16 mx-auto opacity-40" />
            <p className="font-semibold">{award.fileName ?? 'No file'}</p>
            <p className="text-sm opacity-70">No preview — re-upload the file to generate one.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Award Card ───────────────────────────────────────────────────────────────

/** Fixed pixel height for every card's preview pane — keeps the grid uniform */
const CARD_PREVIEW_H = 220

function AwardCard({ award, onDelete, onEdit, onView }: {
  award: CustomAward
  onDelete: () => void
  onEdit: () => void
  onView: () => void
}) {
  const isPdf   = award.fileType === 'pdf'
  const isImage = award.fileType === 'image'

  // Best available preview source:
  //   1. fileThumbnail  — rendered PNG of page 1 (always prefer)
  //   2. fileData       — for image awards: the raw base64 data URL works directly as <img> src
  const hasFullData = !!award.fileData && award.fileData !== 'pdf:too-large'
  const imgSrc = award.fileThumbnail ?? (isImage && hasFullData ? award.fileData : undefined)

  // Old small-PDF awards may have full PDF base64 stored — render scaled-down iframe
  const showPdfInline = !imgSrc && isPdf && hasFullData


  return (
    <div className="group flex flex-col rounded-2xl overflow-hidden border border-primary/20 hover:border-primary/40 transition-all">
      {/* ── Fixed-height preview pane ── */}
      <div
        className="relative overflow-hidden bg-white"
        style={{ height: CARD_PREVIEW_H }}
      >
        {imgSrc ? (
          /* ── Rendered thumbnail or image ── */
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc}
              alt={award.title}
              className="absolute inset-0 w-full h-full object-contain"
            />
            <button
              onClick={onView}
              className="absolute inset-0 w-full h-full cursor-pointer"
              aria-label="View certificate"
            >
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            </button>
          </>
        ) : showPdfInline ? (
          /* ── Scale a full-size PDF iframe down to fit the card ── */
          <>
            <div className="absolute inset-0 overflow-hidden" style={{ pointerEvents: 'none' }}>
              {/* Render iframe at 3× the box height/width, then shrink with transform */}
              <iframe
                src={award.fileData}
                title={award.title}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '300%',
                  height: '300%',
                  border: 'none',
                  transformOrigin: 'top left',
                  transform: 'scale(0.333)',
                }}
              />
            </div>
            <button
              onClick={onView}
              className="absolute inset-0 w-full h-full cursor-pointer"
              aria-label="View certificate"
            >
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            </button>
          </>
        ) : (
          /* ── No visual — prompt to re-upload ── */
          <button
            onClick={onEdit}
            className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-2 bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer"
          >
            <span className="text-4xl">{award.emoji}</span>
            <div className="text-center px-4">
              <p className="text-xs font-semibold text-muted-foreground">No preview</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5 flex items-center justify-center gap-1">
                <Upload className="w-3 h-3" /> Click Edit to attach certificate
              </p>
            </div>
          </button>
        )}

        {/* Ribbon — PDF badge */}
        {isPdf && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow pointer-events-none z-10">
            <FileText className="w-2.5 h-2.5" /> PDF
          </div>
        )}

        {/* Edit / Delete buttons */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="p-1.5 rounded-lg bg-black/60 hover:bg-primary text-white transition-colors"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-lg bg-black/60 hover:bg-red-500 text-white transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Info row ── */}
      <div className="p-4 bg-card">
        <p className="font-bold text-sm leading-tight">
          <span className="mr-1">{award.emoji}</span>
          {award.title}
        </p>
        {award.description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{award.description}</p>
        )}
        <p className="text-[10px] text-primary/70 mt-1.5">{formatDate(award.date)}</p>
      </div>
    </div>
  )
}

// ─── Stat pill + badge components ────────────────────────────────────────────

function StatPill({ icon, value, label, color }: { icon: React.ReactNode; value: string | number; label: string; color: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-1 rounded-2xl px-5 py-4 border', color)}>
      <div className="text-2xl">{icon}</div>
      <div className="text-2xl font-black leading-none">{value}</div>
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
    </div>
  )
}

function BadgeTrophy({ badge }: { badge: BadgeItem }) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-b from-amber-500/10 to-amber-500/5 border border-amber-500/30 hover:border-amber-500/60 transition-all group">
      <div className="text-4xl group-hover:scale-110 transition-transform">{badge.emoji}</div>
      <div className="text-center">
        <p className="text-sm font-bold leading-tight">{badge.name}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{badge.description}</p>
        {badge.earnedAt && <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium">{formatDate(badge.earnedAt)}</p>}
      </div>
    </div>
  )
}

function MilestoneBadge({ milestone, earned }: { milestone: typeof MILESTONE_BADGES[0]; earned: boolean }) {
  return (
    <div className={cn('flex flex-col items-center gap-2 p-3 rounded-xl border transition-all',
      earned ? 'bg-primary/10 border-primary/40' : 'bg-muted/30 border-border opacity-50'
    )}>
      <span className="text-3xl">{milestone.emoji}</span>
      <p className="text-xs font-bold text-center leading-tight">{milestone.label}</p>
      <p className="text-[10px] text-muted-foreground text-center">{milestone.desc}</p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AwardWallPage() {
  const [data, setData] = useState<GamificationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [awards, setAwards] = useState<CustomAward[]>([])
  const [modal, setModal] = useState<{ mode: 'add' } | { mode: 'edit'; award: CustomAward } | null>(null)
  const [viewingAward, setViewingAward] = useState<CustomAward | null>(null)

  useEffect(() => {
    fetch('/api/gamification').then(r => r.json()).then(({ data: d }) => setData(d)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { setAwards(loadCustomAwards()) }, [])

  const addAward = useCallback((award: Omit<CustomAward, 'id'>) => {
    const updated = [{ ...award, id: Date.now().toString() }, ...awards]
    setAwards(updated); saveCustomAwards(updated)
  }, [awards])

  const updateAward = useCallback((id: string, updates: Omit<CustomAward, 'id'>) => {
    const updated = awards.map(a => a.id === id ? { ...updates, id } : a)
    setAwards(updated); saveCustomAwards(updated)
    // If currently viewing the edited award, refresh it
    setViewingAward(prev => prev?.id === id ? { ...updates, id } : prev)
  }, [awards])

  const deleteAward = useCallback((id: string) => {
    const updated = awards.filter(a => a.id !== id)
    setAwards(updated); saveCustomAwards(updated)
  }, [awards])

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )

  const levelTitle = data ? getLevelTitle(data.level) : 'Seedling'
  const earnedMilestones = MILESTONE_BADGES.filter(m => (data?.xp ?? 0) >= m.xp)

  return (
    <div className="space-y-8 pb-10">
      {/* Modals */}
      {modal?.mode === 'add' && (
        <AwardModal onSave={addAward} onClose={() => setModal(null)} />
      )}
      {modal?.mode === 'edit' && (
        <AwardModal
          initial={modal.award}
          onSave={updates => updateAward(modal.award.id, updates)}
          onClose={() => setModal(null)}
        />
      )}
      {viewingAward && <FileViewer award={viewingAward} onClose={() => setViewingAward(null)} />}

      {/* ── Hero Banner ── */}
      <div className="relative rounded-3xl overflow-hidden p-8" style={{
        background: 'linear-gradient(135deg,rgba(99,102,241,.15) 0%,rgba(139,92,246,.12) 50%,rgba(236,72,153,.08) 100%)',
        border: '1px solid rgba(99,102,241,.25)',
      }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle,#8b5cf6,transparent)', transform: 'translate(30%,-30%)' }} />
        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-white font-black text-4xl shadow-2xl"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 40px rgba(99,102,241,.5)' }}>D</div>
            {data && (
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white text-sm font-black border-2 border-card shadow">
                {data.level}
              </div>
            )}
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-4xl font-black tracking-tight">Daniel&apos;s Award Wall</h1>
            <p className="text-primary font-bold text-lg mt-0.5">{levelTitle}</p>
            <p className="text-muted-foreground text-sm mt-1">Every badge earned, every milestone reached — all in one place.</p>
          </div>
          {data && (
            <div className="sm:ml-auto flex gap-3 shrink-0 flex-wrap justify-center">
              <StatPill icon={<Zap className="w-5 h-5 text-primary" />} value={data.xp.toLocaleString()} label="Total XP" color="border-primary/20 bg-primary/5" />
              <StatPill icon={<Flame className="w-5 h-5 text-amber-500" />} value={`🔥 ${data.streak}`} label="Day Streak" color="border-amber-500/20 bg-amber-500/5" />
              <StatPill icon={<Trophy className="w-5 h-5 text-amber-400" />} value={`${data.earnedBadges.length}/${data.totalBadges}`} label="Badges" color="border-amber-400/20 bg-amber-400/5" />
            </div>
          )}
        </div>
        {data && (
          <div className="relative mt-6">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Level {data.level}</span>
              <span>{data.xpInLevel.toLocaleString()} / {data.xpNeeded.toLocaleString()} XP to Level {data.level + 1}</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${data.progressPct}%`, background: 'linear-gradient(90deg,#6366f1,#a78bfa)', boxShadow: '0 0 10px rgba(99,102,241,.6)' }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Certificates & Accomplishments ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-5 h-5 text-secondary" />
            <h2 className="text-xl font-bold">Certificates &amp; Accomplishments</h2>
            {awards.length > 0 && (
              <span className="text-sm text-muted-foreground">{awards.length} award{awards.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <Button size="sm" onClick={() => setModal({ mode: 'add' })} className="gap-2">
            <Plus className="w-3.5 h-3.5" /> Add Award
          </Button>
        </div>

        {awards.length === 0 ? (
          <Card className="p-8 text-center space-y-3 border-dashed">
            <p className="text-5xl">🏅</p>
            <div>
              <p className="font-semibold">Your award wall is empty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload any certificate PDF or photo — AI reads it and fills in the details automatically.
              </p>
            </div>
            <Button variant="outline" onClick={() => setModal({ mode: 'add' })} className="gap-2">
              <Plus className="w-3.5 h-3.5" /> Add Your First Award
            </Button>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {awards.map(award => (
              <AwardCard
                key={award.id}
                award={award}
                onDelete={() => deleteAward(award.id)}
                onEdit={() => setModal({ mode: 'edit', award })}
                onView={() => setViewingAward(award)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Trophy Case ── */}
      {data && data.earnedBadges.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-bold">Trophy Case</h2>
            <span className="text-sm text-muted-foreground">{data.earnedBadges.length} earned</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {data.earnedBadges.map(badge => <BadgeTrophy key={badge.id} badge={badge} />)}
          </div>
        </section>
      )}

      {data && data.earnedBadges.length === 0 && (
        <Card className="p-8 text-center space-y-2">
          <p className="text-4xl">🔒</p>
          <p className="font-semibold">No app badges yet</p>
          <p className="text-sm text-muted-foreground">Complete quizzes, take notes, and keep your streak to earn badges!</p>
        </Card>
      )}

      {/* ── XP Milestones ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Star className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">XP Milestones</h2>
          <span className="text-sm text-muted-foreground">{earnedMilestones.length}/{MILESTONE_BADGES.length} reached</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {MILESTONE_BADGES.map(m => <MilestoneBadge key={m.xp} milestone={m} earned={(data?.xp ?? 0) >= m.xp} />)}
        </div>
      </section>

      {/* ── Locked badges ── */}
      {data && data.totalBadges - data.earnedBadges.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <Medal className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-muted-foreground">
              {data.totalBadges - data.earnedBadges.length} more badges to unlock
            </h2>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.location.href = '/dashboard/achievements'}>
            <BookOpen className="w-3.5 h-3.5 mr-2" /> View All Badges
          </Button>
        </section>
      )}
    </div>
  )
}
