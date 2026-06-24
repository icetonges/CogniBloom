'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2, Plus, Trash2, Trophy, Star, Flame, Zap,
  BookOpen, Medal, Award, GraduationCap, X, Check,
  ZoomIn, ChevronLeft, ChevronRight, FileText, Sparkles,
  Upload,
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
  date: string           // ISO string
  fileData?: string      // base64 data URL (images) or 'pdf:too-large'
  fileName?: string
  fileType?: string      // 'image' | 'pdf'
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_TITLES: Record<number, string> = {
  1: 'Seedling', 2: 'Sprout', 3: 'Sapling', 4: 'Branch',
  5: 'Rising Star', 6: 'Learner', 7: 'Scholar', 8: 'Expert',
  9: 'Mentor', 10: 'Star Student', 15: 'Prodigy', 20: 'Sage',
}
const AWARD_EMOJIS = ['🏆','🥇','🎖️','🌟','⭐','🎓','🏅','💡','🚀','🔥','💎','🎯','📚','✍️','🧠','🎤']
const STORAGE_KEY = 'cognibloom_award_wall'
const MAX_PREVIEW_BYTES = 3 * 1024 * 1024  // 3 MB — store as data URL; above this show icon only

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
  catch { alert('Storage full — try removing some older awards to make room.') }
}
function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

// ─── PDF / Image Viewer (Lightbox) ────────────────────────────────────────────

function FileViewer({ award, onClose }: { award: CustomAward; onClose: () => void }) {
  const isPdf = award.fileType === 'pdf'
  const hasData = award.fileData && award.fileData !== 'pdf:too-large'

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm" onClick={onClose}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 shrink-0" onClick={e => e.stopPropagation()}>
        <div className="text-white">
          <p className="font-bold text-sm">{award.emoji} {award.title}</p>
          {award.description && <p className="text-xs text-white/60 mt-0.5">{award.description}</p>}
          {award.fileName && <p className="text-[10px] text-white/40 mt-0.5">📎 {award.fileName}</p>}
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
        {!hasData ? (
          /* No preview — file was too large or not stored */
          <div className="text-center text-white/60 space-y-3">
            <FileText className="w-16 h-16 mx-auto opacity-40" />
            <p className="font-semibold">{award.fileName}</p>
            <p className="text-sm opacity-70">
              {isPdf ? 'PDF preview not stored (file too large).' : 'No preview available.'}
            </p>
            <p className="text-xs opacity-50">The certificate details are saved above.</p>
          </div>
        ) : isPdf ? (
          /* PDF embed */
          <iframe
            src={award.fileData}
            title={award.title}
            className="w-full h-full rounded-lg border border-white/10 bg-white"
            style={{ maxWidth: '900px', maxHeight: '80vh' }}
          />
        ) : (
          /* Image */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={award.fileData}
            alt={award.title}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-white/10"
            style={{ maxHeight: '80vh' }}
          />
        )}
      </div>
    </div>
  )
}

// ─── Award Card ───────────────────────────────────────────────────────────────

function CustomAwardCard({ award, onDelete, onView }: {
  award: CustomAward; onDelete: () => void; onView: () => void
}) {
  const hasFile = !!award.fileData
  const isPdf = award.fileType === 'pdf'
  const hasPreview = hasFile && award.fileData !== 'pdf:too-large'

  return (
    <div className="group flex flex-col rounded-2xl overflow-hidden border border-primary/20 hover:border-primary/50 transition-all bg-gradient-to-br from-primary/5 to-secondary/5">
      {/* Preview area */}
      <button
        onClick={hasFile ? onView : undefined}
        className={cn(
          'relative w-full overflow-hidden bg-muted/20 transition-colors',
          hasFile && 'hover:bg-muted/30 cursor-pointer',
          !hasFile && 'cursor-default'
        )}
        style={{ aspectRatio: '4/3' }}
        disabled={!hasFile}
        title={hasFile ? 'View document' : undefined}
      >
        {hasPreview && !isPdf && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={award.fileData} alt={award.title} className="w-full h-full object-contain p-2" />
        )}
        {isPdf && hasPreview && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
            <FileText className="w-12 h-12 text-primary/60" />
            <p className="text-xs font-semibold text-muted-foreground text-center truncate w-full px-2">{award.fileName}</p>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">PDF</span>
          </div>
        )}
        {isPdf && !hasPreview && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <FileText className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-[10px] text-muted-foreground/60">Large PDF — click to see details</p>
          </div>
        )}
        {!hasFile && (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-6xl">{award.emoji}</span>
          </div>
        )}

        {/* Hover zoom */}
        {hasFile && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
          </div>
        )}

        {/* File type ribbon */}
        {hasFile && (
          <div className={cn(
            'absolute top-2 left-2 flex items-center gap-1 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow',
            isPdf ? 'bg-red-500' : 'bg-amber-500'
          )}>
            <FileText className="w-2.5 h-2.5" />
            {isPdf ? 'PDF' : 'Certificate'}
          </div>
        )}
      </button>

      {/* Info */}
      <div className="flex items-start gap-3 p-4">
        {!hasFile && <span className="text-2xl shrink-0">{award.emoji}</span>}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight">
            {hasFile && <span className="mr-1">{award.emoji}</span>}
            {award.title}
          </p>
          {award.description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{award.description}</p>
          )}
          <p className="text-[10px] text-primary/70 mt-1">{formatDate(award.date)}</p>
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-500/10 hover:text-red-500 text-muted-foreground shrink-0"
          title="Remove"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ icon, value, label, color }: {
  icon: React.ReactNode; value: string | number; label: string; color: string
}) {
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
        {badge.earnedAt && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium">{formatDate(badge.earnedAt)}</p>
        )}
      </div>
    </div>
  )
}

function MilestoneBadge({ milestone, earned }: { milestone: typeof MILESTONE_BADGES[0]; earned: boolean }) {
  return (
    <div className={cn(
      'flex flex-col items-center gap-2 p-3 rounded-xl border transition-all',
      earned ? 'bg-primary/10 border-primary/40' : 'bg-muted/30 border-border opacity-50'
    )}>
      <span className="text-3xl">{milestone.emoji}</span>
      <p className="text-xs font-bold text-center leading-tight">{milestone.label}</p>
      <p className="text-[10px] text-muted-foreground text-center">{milestone.desc}</p>
    </div>
  )
}

// ─── Add Award Modal ──────────────────────────────────────────────────────────

function AddAwardModal({ onAdd, onClose }: {
  onAdd: (award: Omit<CustomAward, 'id'>) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('🏆')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [fileData, setFileData] = useState<string | undefined>()
  const [fileName, setFileName] = useState<string | undefined>()
  const [fileType, setFileType] = useState<'image' | 'pdf' | undefined>()

  const [uploadState, setUploadState] = useState<'idle' | 'loading' | 'extracting' | 'done' | 'error'>('idle')
  const [uploadMsg, setUploadMsg] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isPdf = file.type === 'application/pdf'
    const isImage = file.type.startsWith('image/')
    if (!isPdf && !isImage) {
      setUploadMsg('Please upload a PDF or image file')
      setUploadState('error')
      return
    }

    setUploadState('loading')
    setUploadMsg('Reading file…')
    setFileName(file.name)
    setFileType(isPdf ? 'pdf' : 'image')

    // Store file data (base64) if small enough
    let storedData: string | undefined
    if (file.size <= MAX_PREVIEW_BYTES) {
      try {
        storedData = await fileToBase64(file)
        setFileData(storedData)
      } catch {
        storedData = undefined
      }
    } else if (isPdf) {
      setFileData('pdf:too-large')
    }

    // Extract certificate info via AI
    setUploadState('extracting')
    setUploadMsg('Extracting certificate info with AI…')

    try {
      const fd = new FormData()
      fd.append('file', file)
      const result = await extractCertificateInfo(fd)

      if (result.error) {
        setUploadMsg(`Could not auto-fill: ${result.error}`)
        setUploadState('error')
      } else {
        if (result.title) setTitle(result.title)
        if (result.description) setDescription(result.description)
        if (result.date) setDate(result.date.slice(0, 10))
        setUploadMsg('Fields auto-filled from document ✓')
        setUploadState('done')
      }
    } catch {
      setUploadMsg('Extraction failed — fill in fields manually')
      setUploadState('error')
    }
  }, [])

  const handleSubmit = () => {
    if (!title.trim()) return
    onAdd({
      title: title.trim(),
      description: description.trim(),
      emoji,
      date: new Date(date).toISOString(),
      fileData,
      fileName,
      fileType,
    })
    onClose()
  }

  const removeFile = () => {
    setFileData(undefined)
    setFileName(undefined)
    setFileType(undefined)
    setUploadState('idle')
    setUploadMsg('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const isLoading = uploadState === 'loading' || uploadState === 'extracting'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-5 my-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" /> Add Accomplishment
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── File upload zone ── */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
            Certificate / Document
            <span className="ml-1 font-normal opacity-70">(PDF or image — fields auto-filled by AI)</span>
          </label>

          {fileName ? (
            /* File chosen */
            <div className={cn(
              'rounded-xl border p-4 space-y-2',
              uploadState === 'done' ? 'border-green-500/40 bg-green-500/5'
                : uploadState === 'error' ? 'border-amber-500/40 bg-amber-500/5'
                : 'border-primary/30 bg-primary/5'
            )}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isLoading
                    ? <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                    : fileType === 'pdf'
                      ? <FileText className="w-4 h-4 text-red-500 shrink-0" />
                      : <span className="text-lg shrink-0">🖼️</span>
                  }
                  <span className="text-sm font-medium truncate">{fileName}</span>
                </div>
                {!isLoading && (
                  <button onClick={removeFile} className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {uploadMsg && (
                <div className={cn(
                  'flex items-center gap-1.5 text-xs',
                  uploadState === 'done' ? 'text-green-600 dark:text-green-400'
                    : uploadState === 'error' ? 'text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground'
                )}>
                  {isLoading && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
                  {uploadState === 'done' && <Sparkles className="w-3 h-3 shrink-0" />}
                  {uploadMsg}
                </div>
              )}

              {/* Image preview */}
              {fileData && fileData !== 'pdf:too-large' && fileType === 'image' && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileData} alt="Preview" className="w-full max-h-40 object-contain rounded-lg border border-border mt-1" />
              )}
            </div>
          ) : (
            /* Drop zone */
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isLoading}
              className="w-full border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 flex flex-col items-center gap-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Upload className="w-8 h-8 opacity-50" />
              <div className="text-center">
                <p className="text-sm font-semibold">Click to upload certificate</p>
                <p className="text-xs opacity-60 mt-0.5">PDF, JPG, PNG, WEBP · max 10 MB</p>
              </div>
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={handleFile}
          />
        </div>

        {/* ── Emoji ── */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Icon</label>
          <div className="flex flex-wrap gap-2">
            {AWARD_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={cn(
                  'text-xl w-9 h-9 rounded-lg transition-all flex items-center justify-center',
                  emoji === e
                    ? 'bg-primary/20 border-2 border-primary scale-110'
                    : 'bg-muted hover:bg-muted/70 border border-transparent'
                )}
              >
                {e}
              </button>
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
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="e.g. Introduction to Python Programming"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            maxLength={120}
          />
        </div>

        {/* ── Description ── */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Description <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Completed with distinction — University of Cape Town"
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
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || isLoading} className="flex-1 gap-2">
            <Check className="w-3.5 h-3.5" /> Add to Wall
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AwardWallPage() {
  const [data, setData] = useState<GamificationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [customAwards, setCustomAwards] = useState<CustomAward[]>([])
  const [showModal, setShowModal] = useState(false)
  const [viewingAward, setViewingAward] = useState<CustomAward | null>(null)

  useEffect(() => {
    fetch('/api/gamification')
      .then((r) => r.json())
      .then(({ data: d }) => setData(d))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { setCustomAwards(loadCustomAwards()) }, [])

  const addAward = useCallback((award: Omit<CustomAward, 'id'>) => {
    const newAward: CustomAward = { ...award, id: Date.now().toString() }
    const updated = [newAward, ...customAwards]
    setCustomAwards(updated)
    saveCustomAwards(updated)
  }, [customAwards])

  const deleteAward = useCallback((id: string) => {
    const updated = customAwards.filter((a) => a.id !== id)
    setCustomAwards(updated)
    saveCustomAwards(updated)
  }, [customAwards])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const levelTitle = data ? getLevelTitle(data.level) : 'Seedling'
  const earnedMilestones = MILESTONE_BADGES.filter((m) => (data?.xp ?? 0) >= m.xp)

  return (
    <div className="space-y-8 pb-10">
      {showModal && <AddAwardModal onAdd={addAward} onClose={() => setShowModal(false)} />}
      {viewingAward && <FileViewer award={viewingAward} onClose={() => setViewingAward(null)} />}

      {/* ── Hero Banner ── */}
      <div className="relative rounded-3xl overflow-hidden p-8"
        style={{
          background: 'linear-gradient(135deg,rgba(99,102,241,.15) 0%,rgba(139,92,246,.12) 50%,rgba(236,72,153,.08) 100%)',
          border: '1px solid rgba(99,102,241,.25)',
        }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle,#8b5cf6,transparent)', transform: 'translate(30%,-30%)' }} />

        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-white font-black text-4xl shadow-2xl"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 40px rgba(99,102,241,.5)' }}>
              D
            </div>
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
            {customAwards.length > 0 && (
              <span className="text-sm text-muted-foreground">{customAwards.length} award{customAwards.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <Button size="sm" onClick={() => setShowModal(true)} className="gap-2">
            <Plus className="w-3.5 h-3.5" /> Add Award
          </Button>
        </div>

        {customAwards.length === 0 ? (
          <Card className="p-8 text-center space-y-3 border-dashed">
            <p className="text-5xl">🏅</p>
            <div>
              <p className="font-semibold">Your award wall is empty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload a PDF or photo of any certificate — AI will auto-fill the title, description, and date for you.
              </p>
            </div>
            <Button variant="outline" onClick={() => setShowModal(true)} className="gap-2">
              <Plus className="w-3.5 h-3.5" /> Add Your First Award
            </Button>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customAwards.map((award) => (
              <CustomAwardCard
                key={award.id}
                award={award}
                onDelete={() => deleteAward(award.id)}
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
            {data.earnedBadges.map((badge) => <BadgeTrophy key={badge.id} badge={badge} />)}
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
          {MILESTONE_BADGES.map((m) => (
            <MilestoneBadge key={m.xp} milestone={m} earned={(data?.xp ?? 0) >= m.xp} />
          ))}
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
