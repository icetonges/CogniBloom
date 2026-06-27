'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2, CalendarDays, CalendarRange, ChevronLeft, ChevronRight,
  Plus, X, Check, Trash2, Tag as TagIcon, Clock, Target, Flag,
  AlignLeft, Pen, Repeat, ListChecks, Sparkles,
  Droplets, Moon, Utensils, Brain, TrendingUp, Flame, ChevronUp, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { HandwritingPad, type HandwritingResult } from '@/components/notes/HandwritingPad'
import { MarkdownRenderer } from '@/components/notes/MarkdownRenderer'

interface Entry {
  id: string
  scope: 'day' | 'month'
  date: string
  title: string
  details: string | null
  tags: string[]
  status: 'pending' | 'done'
  priority: 'low' | 'normal' | 'high'
  startTime: string | null
  color: string | null
  sortOrder: number
}

type View = 'day' | 'month'

// ── local date helpers (calendar-day granularity) ──
const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

// schedule rail: 6 AM → 10 PM
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6)
const hourOf = (t: string) => parseInt(t.split(':')[0] ?? '0', 10)
const fmtHour = (h: number) => { const ampm = h < 12 ? 'AM' : 'PM'; const hr = h % 12 === 0 ? 12 : h % 12; return `${hr} ${ampm}` }
const ROUTINE_EMOJI: Record<string, string> = {
  'Duolingo': '🦉',
  'Workout — set 1': '💪', 'Workout — set 2': '💪', 'Workout — set 3': '💪', 'Workout': '💪',
  'Study Session 1': '📚', 'Study Session 2': '📚',
  '$5 daily investment': '💵',
  'Daily Reflection': '🧘', 'Reflection / mindfulness': '🧘',
  'Daily mind map + Close Out': '🧠', 'Daily mind map': '🧠',
}
const routineEmoji = (title: string) => ROUTINE_EMOJI[title] ?? '✨'
const isRoutine = (e: Entry) => e.tags.includes('routine')

// ── checklist encoding inside the free-text details field ──
const CHECK_RE = /^- \[( |x|X)\] (.*)$/
interface ChecklistItem { text: string; done: boolean }
function parseDetails(raw: string | null): { notes: string; checklist: ChecklistItem[] } {
  const checklist: ChecklistItem[] = []
  const noteLines: string[] = []
  for (const ln of (raw ?? '').split('\n')) {
    const m = CHECK_RE.exec(ln.trim())
    if (m) checklist.push({ text: m[2], done: m[1].toLowerCase() === 'x' })
    else noteLines.push(ln)
  }
  return { notes: noteLines.join('\n').trim(), checklist }
}
function serializeDetails(notes: string, checklist: ChecklistItem[]): string {
  const cl = checklist.filter((c) => c.text.trim()).map((c) => `- [${c.done ? 'x' : ' '}] ${c.text.trim()}`)
  return [notes.trim(), ...cl].filter(Boolean).join('\n')
}

// One-tap starters for the entry editor
interface Template { label: string; title: string; time: string; notes: string; tags: string[]; routine: boolean }
const QUICK_TEMPLATES: Template[] = [
  { label: '💪 Workout',    title: 'Workout — set 1',            time: '07:30', notes: '5 min',   tags: ['fitness'],    routine: true  },
  { label: '🦉 Duolingo',  title: 'Duolingo',                   time: '07:40', notes: '5 min',   tags: ['language'],   routine: true  },
  { label: '📚 Study',     title: 'Study Session 1',             time: '07:45', notes: '40 min',  tags: ['study'],      routine: true  },
  { label: '💵 $5 invest', title: '$5 daily investment',         time: '18:00', notes: '15 min',  tags: ['investment'], routine: true  },
  { label: '🧘 Reflect',   title: 'Daily Reflection',            time: '20:00', notes: '',        tags: ['mind'],       routine: true  },
  { label: '🧠 Mind map',  title: 'Daily mind map + Close Out',  time: '20:30', notes: '',        tags: ['mind'],       routine: true  },
  { label: '📖 Read',      title: 'Reading',                     time: '',      notes: '',        tags: ['reading'],    routine: false },
]

// ── per-day planner widgets, stored in one reserved meta row ──
const META_TAG = '__meta__'
const MOODS = ['😣', '😕', '😐', '🙂', '😄']
interface DayMeta {
  priorities: string[]
  focus: string
  memo: string
  highlight: string
  mood: number | null
  water: number
  sleep: string
  meals: { b: string; l: string; d: string; s: string }
}
function emptyMeta(): DayMeta {
  return { priorities: ['', '', ''], focus: '', memo: '', highlight: '', mood: null, water: 0, sleep: '', meals: { b: '', l: '', d: '', s: '' } }
}
function parseMeta(e?: Entry | null): DayMeta {
  const base = emptyMeta()
  if (!e?.details) return base
  try {
    const j = JSON.parse(e.details) as Partial<DayMeta>
    const p = Array.isArray(j.priorities) ? j.priorities : []
    return {
      priorities: [p[0] ?? '', p[1] ?? '', p[2] ?? ''],
      focus: j.focus ?? '', memo: j.memo ?? '', highlight: j.highlight ?? '',
      mood: typeof j.mood === 'number' ? j.mood : null,
      water: typeof j.water === 'number' ? j.water : 0,
      sleep: j.sleep ?? '',
      meals: { b: j.meals?.b ?? '', l: j.meals?.l ?? '', d: j.meals?.d ?? '', s: j.meals?.s ?? '' },
    }
  } catch { return base }
}

// Add-a-line input: Enter or blur commits the value (mobile-safe).
function AddLine({ onAdd, placeholder, className }: { onAdd: (t: string) => void; placeholder: string; className?: string }) {
  const [v, setV] = useState('')
  // Prevent double-submit when Enter fires then blur fires in the same gesture.
  const committedByKey = useRef(false)
  const commit = (val: string) => { const t = val.trim(); if (t) { onAdd(t); setV('') } }
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          committedByKey.current = true
          commit(v)
        }
      }}
      onBlur={() => {
        if (!committedByKey.current) commit(v)
        committedByKey.current = false
      }}
      placeholder={placeholder}
      className={className}
    />
  )
}

// Edit-in-place text: commits on blur / Enter, only if changed.
function EditLine({ value, onCommit, placeholder, className }: { value: string; onCommit: (t: string) => void; placeholder?: string; className?: string }) {
  const [v, setV] = useState(value)
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setV(value) }, [value, focused])
  return (
    <input
      value={v}
      onFocus={() => setFocused(true)}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { setFocused(false); if (v !== value) onCommit(v) }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      placeholder={placeholder}
      className={className}
    />
  )
}

const PRIORITY_STYLE: Record<string, string> = {
  high: 'border-l-rose-500',
  normal: 'border-l-primary',
  low: 'border-l-slate-400',
}
const PRIORITY_OPTS = [
  { v: 'low', label: 'Low', cls: 'bg-slate-500' },
  { v: 'normal', label: 'Normal', cls: 'bg-primary' },
  { v: 'high', label: 'High', cls: 'bg-rose-500' },
]

const TAG_COLORS = [
  'bg-blue-500/15 text-blue-500', 'bg-emerald-500/15 text-emerald-500',
  'bg-amber-500/15 text-amber-600', 'bg-violet-500/15 text-violet-500',
  'bg-rose-500/15 text-rose-500', 'bg-teal-500/15 text-teal-500',
]
const tagColor = (tag: string) => {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return TAG_COLORS[h % TAG_COLORS.length]
}

interface EditorState { entry: Entry | null; scope: 'day' | 'month'; date: Date; time?: string }

export default function PlannerPage() {
  const [view, setView] = useState<View>('day') // daily plan is the front page
  const [cursor, setCursor] = useState(new Date())
  const [entries, setEntries] = useState<Entry[]>([])
  const [knownTags, setKnownTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState<EditorState | null>(null)

  const dateParam = view === 'month' ? monthKey(cursor) : dayKey(cursor)
  const isToday = view === 'day' && dayKey(cursor) === dayKey(new Date())

  const load = useCallback(() => {
    setLoading(true)
    const req = view === 'day'
      ? fetch('/api/planner/seed-day', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: dateParam }),
        })
      : fetch(`/api/planner?scope=${view}&date=${dateParam}`)
    return req
      .then((r) => r.json())
      .then((res) => { if (res.success) { setEntries(res.data); setKnownTags(res.tags ?? []) } })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [view, dateParam])

  useEffect(() => { load() }, [load])

  const shift = (dir: number) => {
    const d = new Date(cursor)
    if (view === 'month') d.setMonth(d.getMonth() + dir)
    else d.setDate(d.getDate() + dir)
    setCursor(d)
  }

  const toggleDone = async (e: Entry) => {
    const next = e.status === 'done' ? 'pending' : 'done'
    setEntries((prev) => prev.map((x) => (x.id === e.id ? { ...x, status: next } : x)))
    await fetch('/api/planner', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: e.id, status: next }),
    })
  }

  const afterSave = () => { setEditor(null); load() }

  const restoreRoutine = () => {
    fetch('/api/planner/seed-day', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dayKey(cursor), force: true }),
    }).then(() => load()).catch(() => {})
  }

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" /> Planner
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your daily plan, habits, and goals — all in one place.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
          {(['day', 'month'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                view === v ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {v === 'day' ? <CalendarDays className="w-3.5 h-3.5" /> : <CalendarRange className="w-3.5 h-3.5" />}
              {v === 'day' ? 'Day' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      {/* date nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => shift(-1)}><ChevronLeft className="w-4 h-4" /></Button>
        <div className="text-center">
          <div className="font-semibold flex items-center justify-center gap-2">
            {view === 'month'
              ? cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              : cursor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {isToday && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">TODAY</span>}
          </div>
          {!isToday && (
            <button onClick={() => setCursor(new Date())} className="text-xs text-primary hover:underline">Jump to today</button>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => shift(1)}><ChevronRight className="w-4 h-4" /></Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : view === 'day' ? (
        <DayView
          entries={entries}
          cursor={cursor}
          onOpenEntry={(e) => setEditor({ entry: e, scope: e.scope, date: cursor })}
          onRestoreRoutine={restoreRoutine}
          onRefresh={load}
        />
      ) : (
        <MonthView
          cursor={cursor}
          entries={entries}
          onPickDay={(d) => { setCursor(d); setView('day') }}
          onAddGoal={() => setEditor({ entry: null, scope: 'month', date: cursor })}
          onOpen={(e) => setEditor({ entry: e, scope: e.scope, date: cursor })}
          onToggle={toggleDone}
        />
      )}

      {editor && (
        <EntryEditor
          initial={editor}
          knownTags={knownTags}
          onClose={() => setEditor(null)}
          onSaved={afterSave}
        />
      )}
    </div>
  )
}

// ── AI Coach: analyzes planner trend, effort & consistency via the LLM chain ──
interface HabitStat { title: string; scheduled: number; completed: number; rate: number }
interface Insights {
  stats: {
    days: number; activeDays: number; totalTasks: number; totalDone: number
    overallRate: number; streak: number
    habits: HabitStat[]
    series: { date: string; pct: number; total: number; done: number }[]
  }
  analysis: string
}

function AICoach() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Insights | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const r = await fetch('/api/planner/insights?days=30')
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error ?? 'Analysis failed')
      setData(j as Insights)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-4 border-primary/15 bg-gradient-to-br from-primary/[0.05] to-secondary/[0.04]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <div className="font-semibold text-sm">AI Coach</div>
            <div className="text-xs text-muted-foreground">Trends · effort · consistency — last 30 days</div>
          </div>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {data ? 'Refresh' : 'Analyze'}
        </button>
      </div>

      {err && <p className="text-xs text-rose-500 mt-2">{err}</p>}

      {data && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <CoachStat icon={TrendingUp} label="Completion" value={`${data.stats.overallRate}%`} />
            <CoachStat icon={Flame} label="Streak" value={`${data.stats.streak}d`} />
            <CoachStat icon={CalendarDays} label="Active days" value={`${data.stats.activeDays}/${data.stats.days}`} />
          </div>

          {data.stats.habits.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Habit consistency</div>
              <div className="space-y-1.5">
                {data.stats.habits.map((h) => (
                  <div key={h.title} className="flex items-center gap-2 text-xs">
                    <span className="w-36 truncate shrink-0">{h.title}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className={cn('h-full rounded-full', h.rate >= 70 ? 'bg-emerald-500' : h.rate >= 40 ? 'bg-amber-500' : 'bg-rose-500')} style={{ width: `${h.rate}%` }} />
                    </div>
                    <span className="w-14 text-right tabular-nums text-muted-foreground shrink-0">{h.completed}/{h.scheduled}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.analysis
            ? <div className="rounded-xl bg-background/60 border border-border p-3"><MarkdownRenderer content={data.analysis} /></div>
            : <p className="text-xs text-muted-foreground">Add and complete a few plans, then analyze again for a written review.</p>}
        </div>
      )}
    </Card>
  )
}

function CoachStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/60 border border-border p-3">
      <Icon className="w-4 h-4 text-primary mb-1" />
      <div className="text-lg font-bold tabular-nums leading-none">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-1">{label}</div>
    </div>
  )
}

// One editable task line — checkbox, inline-editable title, open & delete.
function TaskRow({ e, onToggle, onCommit, onRemove, onOpen }: {
  e: Entry
  onToggle: (e: Entry) => void
  onCommit: (e: Entry, t: string) => void
  onRemove: (id: string) => void
  onOpen: (e: Entry) => void
}) {
  return (
    <div className="flex items-center gap-2 group">
      <button onClick={() => onToggle(e)} className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0', e.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40 hover:border-primary')}>
        {e.status === 'done' && <Check className="w-2.5 h-2.5 text-white" />}
      </button>
      <EditLine value={e.title} onCommit={(t) => onCommit(e, t)}
        className={cn('flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/50 py-0.5', e.status === 'done' && 'line-through text-muted-foreground')} />
      <button onClick={() => onOpen(e)} title="More options" className="text-muted-foreground/50 hover:text-primary opacity-0 group-hover:opacity-100 shrink-0"><AlignLeft className="w-3.5 h-3.5" /></button>
      <button onClick={() => onRemove(e.id)} className="text-muted-foreground/50 hover:text-rose-500 opacity-0 group-hover:opacity-100 shrink-0"><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

// ============ DAY VIEW — inline multi-activity planner ============
// ── Confetti celebration (canvas-based, no dependencies) ──
interface Confetto { x: number; y: number; vx: number; vy: number; size: number; color: string; rot: number; vr: number; shape: number; born: number; life: number }
function fireConfetti(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;'
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) { canvas.remove(); return }
  const dpr = window.devicePixelRatio || 1
  const w = window.innerWidth, h = window.innerHeight
  canvas.width = w * dpr; canvas.height = h * dpr
  ctx.scale(dpr, dpr)
  const colors = ['#6366f1', '#8b5cf6', '#34d399', '#fbbf24', '#38bdf8', '#f472b6', '#f87171', '#a855f7']
  const origins = [0.10, 0.26, 0.74, 0.90] // two cannons on the left, two on the right
  const parts: Confetto[] = []
  const PARTICLE_LIFE = 2600
  const EMIT_MS = 4200   // keep launching fresh bursts for ~4.2s
  const TOTAL_MS = 5000  // sustain the show for ~5s
  const MAX_MS = 7000    // hard safety cap
  const WAVE_GAP = 550
  const gravity = 0.3
  const start = performance.now()
  let lastWave = -1
  const spawn = (now: number): void => {
    for (let o = 0; o < origins.length; o++) {
      const ox = w * origins[o]!
      const left = origins[o]! < 0.5
      for (let i = 0; i < 14; i++) {
        parts.push({
          x: ox + (Math.random() - 0.5) * 30,
          y: h * 0.5 + (Math.random() - 0.5) * 30,
          vx: (left ? 1 : -1) * (2 + Math.random() * 8),
          vy: -9 - Math.random() * 13,
          size: 6 + Math.random() * 7,
          color: colors[(Math.random() * colors.length) | 0]!,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.35,
          shape: Math.random() < 0.5 ? 0 : 1,
          born: now,
          life: PARTICLE_LIFE,
        })
      }
    }
  }
  const draw = (now: number): void => {
    const t = now - start
    if (t <= EMIT_MS) {
      const waveIndex = Math.floor(t / WAVE_GAP)
      if (waveIndex !== lastWave) { lastWave = waveIndex; spawn(now) }
    }
    ctx.clearRect(0, 0, w, h)
    let alive = false
    for (const p of parts) {
      const age = now - p.born
      if (age > p.life) continue
      p.vy += gravity; p.vx *= 0.99
      p.x += p.vx; p.y += p.vy; p.rot += p.vr
      const fade = Math.max(0, 1 - age / p.life)
      if (fade > 0 && p.y < h + 40) alive = true
      ctx.save()
      ctx.globalAlpha = fade
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      if (p.shape === 0) ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
      else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill() }
      ctx.restore()
    }
    if ((t < TOTAL_MS || alive) && t < MAX_MS) requestAnimationFrame(draw)
    else canvas.remove()
  }
  requestAnimationFrame(draw)
}

function DayView({
  entries, cursor, onOpenEntry, onRestoreRoutine, onRefresh,
}: {
  entries: Entry[]
  cursor: Date
  onOpenEntry: (e: Entry) => void
  onRestoreRoutine: () => void
  onRefresh: () => void
}) {
  const dateKey = dayKey(cursor)
  const [items, setItems] = useState<Entry[]>(entries)
  useEffect(() => { setItems(entries) }, [entries])

  // ── per-day meta (priorities, focus, water, mood, meals, …) ──
  const metaEntry = items.find((e) => e.tags.includes(META_TAG)) ?? null
  const [meta, setMeta] = useState<DayMeta>(() => parseMeta(metaEntry))
  const metaIdRef = useRef<string | null>(metaEntry?.id ?? null)
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const me = entries.find((e) => e.tags.includes(META_TAG)) ?? null
    setMeta(parseMeta(me))
    metaIdRef.current = me?.id ?? null
  }, [entries])

  // ── save status indicator ──
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const inflight = useRef(0)
  const begin = () => { inflight.current += 1; setSaveState('saving') }
  const end = () => { inflight.current = Math.max(0, inflight.current - 1); if (inflight.current === 0) setSaveState('saved') }

  const J = { 'Content-Type': 'application/json' }

  const createEntry = async (payload: Record<string, unknown>) => {
    begin()
    try {
      const res = await fetch('/api/planner', { method: 'POST', headers: J, body: JSON.stringify({ scope: 'day', date: dateKey, priority: 'normal', ...payload }) })
      const data = (await res.json())?.data as Entry | undefined
      if (data) setItems((prev) => [...prev, data])
    } catch { /* ignore */ } finally { end() }
  }
  const patchEntry = async (id: string, patch: Record<string, unknown>) => {
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } as Entry : e)))
    begin()
    try { await fetch('/api/planner', { method: 'PATCH', headers: J, body: JSON.stringify({ id, ...patch }) }) } catch { /* ignore */ } finally { end() }
  }
  const removeEntry = async (id: string) => {
    setItems((prev) => prev.filter((e) => e.id !== id))
    begin()
    try { await fetch(`/api/planner?id=${id}`, { method: 'DELETE' }) } catch { /* ignore */ } finally { end() }
  }
  const toggle = (e: Entry) => patchEntry(e.id, { status: e.status === 'done' ? 'pending' : 'done' })
  const commitTitle = (e: Entry, t: string) => (t.trim() ? patchEntry(e.id, { title: t.trim() }) : removeEntry(e.id))

  // ── meta save (debounced) ──
  const setMetaField = (patch: Partial<DayMeta>) => {
    const next = { ...meta, ...patch }
    setMeta(next)
    setSaveState('saving')
    if (metaTimer.current) clearTimeout(metaTimer.current)
    metaTimer.current = setTimeout(async () => {
      begin()
      try {
        const details = JSON.stringify(next)
        if (metaIdRef.current) {
          await fetch('/api/planner', { method: 'PATCH', headers: J, body: JSON.stringify({ id: metaIdRef.current, details }) })
        } else {
          const res = await fetch('/api/planner', { method: 'POST', headers: J, body: JSON.stringify({ scope: 'day', date: dateKey, title: META_TAG, tags: [META_TAG], details }) })
          const data = (await res.json())?.data as Entry | undefined
          if (data) { metaIdRef.current = data.id; setItems((prev) => [...prev, data]) }
        }
      } catch { /* ignore */ } finally { end() }
    }, 800)
  }

  // ── groups ──
  const routine = items.filter(isRoutine)
  const real = items.filter((e) => !isRoutine(e) && !e.tags.includes(META_TAG))
  const timed = real.filter((e) => e.startTime)
  const tasks = [...routine, ...real]
  // Sort habits chronologically by startTime; fall back to sortOrder for untimed items.
  const habitList = [...routine].sort((a, b) => {
    if (a.startTime && b.startTime) return a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0
    if (a.startTime) return -1
    if (b.startTime) return 1
    return a.sortOrder - b.sortOrder
  })
  const reorderHabit = (e: Entry, dir: number) => {
    const idx = habitList.findIndex((x) => x.id === e.id)
    const j = idx + dir
    if (j < 0 || j >= habitList.length) return
    const a = habitList[idx], b = habitList[j]
    const aOrder = a.sortOrder, bOrder = b.sortOrder
    patchEntry(a.id, { sortOrder: bOrder })
    patchEntry(b.id, { sortOrder: aOrder })
  }
  const done = tasks.filter((e) => e.status === 'done').length
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0

  // ── Celebrate the moment the day hits 100% (only on the transition, not on reload) ──
  const prevPctRef = useRef(pct)
  useEffect(() => {
    if (tasks.length > 0 && pct === 100 && prevPctRef.current < 100) fireConfetti()
    prevPctRef.current = pct
  }, [pct, tasks.length])

  const rowInput = 'flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/50 py-0.5'
  const sectionTitle = 'text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5'

  // ── section blocks (ordered into columns below) ──
  const focus = (
    <section key="focus">
      <h3 className={sectionTitle}><Target className="w-3.5 h-3.5" /> Today&apos;s focus</h3>
      <Card className="p-3">
        <textarea value={meta.focus} onChange={(e) => setMetaField({ focus: e.target.value })} rows={2} placeholder="What's the intention for today?" className="w-full bg-transparent text-sm resize-none focus:outline-none placeholder:text-muted-foreground/50" />
      </Card>
    </section>
  )

  const highlight = (
    <section key="hl">
      <h3 className={sectionTitle}><Sparkles className="w-3.5 h-3.5" /> Highlight &amp; notes</h3>
      <Card className="p-3 space-y-2">
        <EditLine value={meta.highlight} onCommit={(t) => setMetaField({ highlight: t })} placeholder="Highlight of the day…" className={rowInput} />
        <textarea value={meta.memo} onChange={(e) => setMetaField({ memo: e.target.value })} rows={2} placeholder="Memo / brain dump…" className="w-full bg-transparent text-sm resize-none focus:outline-none placeholder:text-muted-foreground/50 border-t border-border/60 pt-2" />
      </Card>
    </section>
  )

  const schedule = (
    <section key="sched">
      <h3 className={sectionTitle}><Clock className="w-3.5 h-3.5" /> Today&apos;s schedule</h3>
      <Card className="p-2 divide-y divide-border/60">
        {HOURS.map((h) => {
          const slot = timed.filter((e) => hourOf(e.startTime!) === h).sort((a, b) => (a.startTime! < b.startTime! ? -1 : 1))
          const hh = `${pad(h)}:00`
          return (
            <div key={h} className="flex gap-3 py-1.5">
              <div className="w-12 shrink-0 text-[11px] text-muted-foreground text-right pt-1 tabular-nums">{fmtHour(h)}</div>
              <div className="flex-1 min-w-0 space-y-1">
                {slot.map((e) => <TaskRow key={e.id} e={e} onToggle={toggle} onCommit={commitTitle} onRemove={removeEntry} onOpen={onOpenEntry} />)}
                <AddLine onAdd={(t) => createEntry({ title: t, startTime: hh })} placeholder="+ add…" className="w-full bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/30 py-0.5" />
              </div>
            </div>
          )
        })}
      </Card>
    </section>
  )

  const habits = (
    <section key="habits">
      <div className="flex items-center justify-between mb-2">
        <h3 className={cn(sectionTitle, 'mb-0')}><Repeat className="w-3.5 h-3.5" /> Habit tracker</h3>
        <button onClick={onRestoreRoutine} className="text-xs text-primary hover:underline inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Load defaults</button>
      </div>
      <Card className="p-3 space-y-2">
        {habitList.map((e, i) => (
          <div key={e.id} className="flex items-start gap-2 group rounded-lg hover:bg-muted/30 px-1 -mx-1 py-0.5">
            {/* reorder */}
            <div className="flex flex-col shrink-0 -my-0.5">
              <button onClick={() => reorderHabit(e, -1)} disabled={i === 0} title="Move up" className="text-muted-foreground/40 hover:text-primary disabled:opacity-20 leading-none"><ChevronUp className="w-3.5 h-3.5" /></button>
              <button onClick={() => reorderHabit(e, 1)} disabled={i === habitList.length - 1} title="Move down" className="text-muted-foreground/40 hover:text-primary disabled:opacity-20 leading-none"><ChevronDown className="w-3.5 h-3.5" /></button>
            </div>
            <button onClick={() => toggle(e)} className={cn('mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0', e.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40 hover:border-primary')}>
              {e.status === 'done' && <Check className="w-3 h-3 text-white" />}
            </button>
            <span className="text-base shrink-0 mt-0.5">{routineEmoji(e.title)}</span>
            <div className="flex-1 min-w-0">
              <EditLine value={e.title} onCommit={(t) => commitTitle(e, t)} className={cn('w-full bg-transparent text-sm font-medium focus:outline-none', e.status === 'done' && 'line-through text-muted-foreground')} />
              <EditLine value={e.details ?? ''} onCommit={(t) => patchEntry(e.id, { details: t })} placeholder="duration / note — e.g. 15 min lesson" className="w-full bg-transparent text-[11px] text-muted-foreground focus:outline-none placeholder:text-muted-foreground/40" />
            </div>
            <input
              type="time"
              value={e.startTime ?? ''}
              onChange={(ev) => patchEntry(e.id, { startTime: ev.target.value })}
              title="Time"
              className="text-[11px] text-muted-foreground bg-transparent border border-border/60 rounded px-1 py-0.5 shrink-0 mt-0.5 w-[5.5rem] focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <button onClick={() => removeEntry(e.id)} title="Remove" className="text-muted-foreground/50 hover:text-rose-500 opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-2 border-t border-border/60">
          <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
          <AddLine onAdd={(t) => createEntry({ title: t, tags: ['routine'] })} placeholder="Add a habit…" className={rowInput} />
        </div>
      </Card>
    </section>
  )

  const wellness = (
    <section key="well">
      <h3 className={sectionTitle}><Droplets className="w-3.5 h-3.5" /> Wellness</h3>
      <Card className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-12 shrink-0">Water</span>
          <div className="flex gap-1">
            {Array.from({ length: 8 }).map((_, i) => {
              const n = i + 1
              return (
                <button key={n} onClick={() => setMetaField({ water: meta.water === n ? n - 1 : n })} title={`${n} glasses`}>
                  <Droplets className={cn('w-4 h-4 transition-colors', n <= meta.water ? 'text-sky-400 fill-sky-400/30' : 'text-muted-foreground/30')} />
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-12 shrink-0">Mood</span>
          <div className="flex gap-1.5">
            {MOODS.map((m, i) => (
              <button key={i} onClick={() => setMetaField({ mood: meta.mood === i ? null : i })} className={cn('text-xl transition-all', meta.mood === i ? 'scale-125' : 'opacity-40 hover:opacity-80')}>{m}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-12 shrink-0">Sleep</span>
          <EditLine value={meta.sleep} onCommit={(t) => setMetaField({ sleep: t })} placeholder="e.g. 7.5 hrs" className={rowInput} />
          <Moon className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
        </div>
      </Card>
    </section>
  )

  const meals = (
    <section key="meals">
      <h3 className={sectionTitle}><Utensils className="w-3.5 h-3.5" /> Meals</h3>
      <Card className="p-3 space-y-1.5">
        {([['b', 'Breakfast'], ['l', 'Lunch'], ['d', 'Dinner'], ['s', 'Snack']] as const).map(([k, label]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-muted text-[10px] font-bold text-muted-foreground flex items-center justify-center shrink-0 uppercase">{k}</span>
            <EditLine value={meta.meals[k]} onCommit={(t) => setMetaField({ meals: { ...meta.meals, [k]: t } })} placeholder={label} className={rowInput} />
          </div>
        ))}
      </Card>
    </section>
  )

  return (
    <div className="space-y-5">
      {/* compact header + save status */}
      <Card className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="leading-tight">
            <div className="text-base font-bold">{cursor.toLocaleDateString('en-US', { weekday: 'long' })}</div>
            <div className="text-[11px] text-muted-foreground">{cursor.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <div className="flex items-center gap-3">
            {/* Save button — always visible, confirms sync with server */}
            <button
              onClick={async () => { begin(); await onRefresh(); end() }}
              disabled={saveState === 'saving'}
              className={cn(
                'flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors border',
                saveState === 'saving'
                  ? 'text-muted-foreground border-border cursor-wait'
                  : saveState === 'saved'
                  ? 'text-emerald-600 border-emerald-400/60 bg-emerald-50 dark:bg-emerald-950/30'
                  : 'text-primary border-primary/40 hover:bg-primary/5'
              )}
            >
              {saveState === 'saving'
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
                : saveState === 'saved'
                ? <><Check className="w-3 h-3" /> Saved</>
                : <><Check className="w-3 h-3" /> Save</>}
            </button>
            <div className="text-right">
              <div className="text-base font-bold tabular-nums leading-none">{pct}%</div>
              <div className="text-[10px] text-muted-foreground">{done}/{tasks.length} done</div>
            </div>
          </div>
        </div>
        <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      <AICoach />

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        {/* LEFT */}
        <div className="space-y-5">
          {focus}
          {schedule}
          {wellness}
        </div>
        {/* RIGHT */}
        <div className="space-y-5">
          {highlight}
          {habits}
          {meals}
        </div>
      </div>
    </div>
  )
}

// ============ MONTH VIEW ============
function MonthView({
  cursor, entries, onPickDay, onAddGoal, onOpen, onToggle,
}: {
  cursor: Date
  entries: Entry[]
  onPickDay: (d: Date) => void
  onAddGoal: () => void
  onOpen: (e: Entry) => void
  onToggle: (e: Entry) => void
}) {
  const goals = entries.filter((e) => e.scope === 'month')
  const dayEntries = entries.filter((e) => e.scope === 'day')

  const countByDay = useMemo(() => {
    const m: Record<string, number> = {}
    dayEntries.forEach((e) => { if (e.tags.includes(META_TAG) || e.tags.includes('routine')) return; const k = e.date.slice(0, 10); m[k] = (m[k] ?? 0) + 1 })
    return m
  }, [dayEntries])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayKey = dayKey(new Date())
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />
            const d = new Date(year, month, day)
            const k = dayKey(d)
            const count = countByDay[k] ?? 0
            const isToday = k === todayKey
            return (
              <button
                key={i}
                onClick={() => onPickDay(d)}
                title="Add a plan on this day"
                className={cn(
                  'aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-sm transition-colors hover:bg-primary/10',
                  isToday ? 'bg-primary/10 ring-1 ring-primary/40 font-bold' : 'text-foreground'
                )}
              >
                <span>{day}</span>
                {count > 0 && (
                  <span className="flex gap-0.5">
                    {Array.from({ length: Math.min(count, 3) }).map((_, j) => (
                      <span key={j} className="w-1 h-1 rounded-full bg-primary" />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-2">Tap any day to plan it.</p>
      </Card>

      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Target className="w-4 h-4 text-violet-400" /> Monthly goals
        </h3>
        <div className="space-y-2">
          {goals.map((e) => <EntryRow key={e.id} entry={e} onOpen={onOpen} onToggle={onToggle} />)}
          {goals.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No monthly goals set.</p>
          )}
        </div>
        <Button variant="outline" onClick={onAddGoal} className="w-full gap-2 border-dashed mt-3">
          <Plus className="w-4 h-4" /> Add monthly goal
        </Button>
      </div>
    </div>
  )
}

// ============ ENTRY ROW ============
function EntryRow({ entry, onOpen, onToggle }: { entry: Entry; onOpen: (e: Entry) => void; onToggle: (e: Entry) => void }) {
  const done = entry.status === 'done'
  return (
    <Card className={cn('p-3 border-l-4 flex items-start gap-3', PRIORITY_STYLE[entry.priority] ?? PRIORITY_STYLE['normal'])}>
      <button
        onClick={() => onToggle(entry)}
        className={cn(
          'mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
          done ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40 hover:border-primary'
        )}
      >
        {done && <Check className="w-3.5 h-3.5 text-white" />}
      </button>
      <button onClick={() => onOpen(entry)} className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 flex-wrap">
          {entry.startTime && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Clock className="w-3 h-3" /> {entry.startTime}
            </span>
          )}
          <span className={cn('font-medium', done && 'line-through text-muted-foreground')}>{entry.title}</span>
        </div>
        {(() => {
          const { notes, checklist } = parseDetails(entry.details)
          const doneCount = checklist.filter((c) => c.done).length
          return (
            <>
              {notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 whitespace-pre-wrap">{notes}</p>}
              {checklist.length > 0 && (
                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-muted-foreground">
                  <ListChecks className="w-3 h-3" /> {doneCount}/{checklist.length}
                </span>
              )}
            </>
          )
        })()}
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {entry.tags.map((t) => (
              <span key={t} className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', tagColor(t))}>{t}</span>
            ))}
          </div>
        )}
      </button>
    </Card>
  )
}

// ============ ENTRY EDITOR (rich template modal) ============
function EntryEditor({
  initial, knownTags, onClose, onSaved,
}: {
  initial: EditorState
  knownTags: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!initial.entry
  const scope = initial.scope
  const dateObj = initial.date
  const initParsed = parseDetails(initial.entry?.details ?? '')

  const [title, setTitle] = useState(initial.entry?.title ?? '')
  const [notes, setNotes] = useState(initParsed.notes)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initParsed.checklist)
  const [subInput, setSubInput] = useState('')
  const [startTime, setStartTime] = useState(initial.entry?.startTime ?? initial.time ?? '')
  const [priority, setPriority] = useState<string>(initial.entry?.priority ?? 'normal')
  const [tags, setTags] = useState<string[]>((initial.entry?.tags ?? []).filter((t) => t !== 'routine'))
  const [repeatDaily, setRepeatDaily] = useState((initial.entry?.tags ?? []).includes('routine'))
  const [tagInput, setTagInput] = useState('')
  const [status, setStatus] = useState<string>(initial.entry?.status ?? 'pending')
  const [saving, setSaving] = useState(false)
  const [hwOpen, setHwOpen] = useState(false)

  const addTag = (t: string) => { const v = t.trim(); if (v && !tags.includes(v)) setTags([...tags, v]); setTagInput('') }
  const addSub = (t: string) => { const v = t.trim(); if (v) setChecklist((c) => [...c, { text: v, done: false }]); setSubInput('') }
  const onHandwriting = (r: HandwritingResult) => { if (r.text && r.text.trim()) setNotes((d) => (d ? `${d}\n${r.text}` : r.text!)) }

  const applyTemplate = (t: Template) => {
    setTitle(t.title)
    if (t.time) setStartTime(t.time)
    if (t.notes) setNotes((n) => (n ? n : t.notes))
    setTags((prev) => Array.from(new Set([...prev, ...t.tags])))
    setRepeatDaily(t.routine)
  }

  const submit = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      const details = serializeDetails(notes, checklist)
      const finalTags = repeatDaily ? Array.from(new Set(['routine', ...tags])) : tags
      if (isEdit) {
        await fetch('/api/planner', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: initial.entry!.id, title, details, tags: finalTags, priority, status,
            startTime: scope === 'day' ? startTime : undefined,
          }),
        })
      } else {
        const date = scope === 'month' ? monthKey(dateObj) : dayKey(dateObj)
        await fetch('/api/planner', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope, date, title, details: details || undefined,
            startTime: scope === 'day' ? startTime || undefined : undefined,
            priority, tags: finalTags,
          }),
        })
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const del = async () => {
    if (!initial.entry) return
    setSaving(true)
    await fetch(`/api/planner?id=${initial.entry.id}`, { method: 'DELETE' })
    onSaved()
  }

  const suggestions = knownTags.filter((t) => t !== 'routine' && !tags.includes(t)).slice(0, 10)
  const doneCount = checklist.filter((c) => c.done).length
  const dateLabel = scope === 'month'
    ? dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto bg-background/70 backdrop-blur-sm"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <Card className="w-full max-w-2xl my-auto shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-bold text-xl">
              {isEdit ? 'Edit' : 'New'} {scope === 'month' ? 'monthly goal' : 'plan'}
            </h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              {scope === 'month' ? <Target className="w-3 h-3" /> : <CalendarDays className="w-3 h-3" />}
              {dateLabel}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* quick templates */}
          {!isEdit && scope === 'day' && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-2">
                <Sparkles className="w-3 h-3" /> Quick add
              </label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => applyTemplate(t)}
                    className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-primary/10 hover:border-primary/40 transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* title */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={scope === 'month' ? 'e.g. Finish reading 2 books' : 'e.g. Study session — AMC geometry'}
              className="mt-1.5 w-full px-3.5 py-3 rounded-xl bg-background border border-border text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* time + priority */}
          <div className="grid sm:grid-cols-2 gap-4">
            {scope === 'day' && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            )}
            <div className={scope === 'day' ? '' : 'sm:col-span-2'}>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Flag className="w-3 h-3" /> Priority</label>
              <div className="mt-1.5 inline-flex rounded-xl border border-border p-0.5 w-full">
                {PRIORITY_OPTS.map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setPriority(o.v)}
                    className={cn('flex-1 text-sm font-medium py-2 rounded-lg transition-colors',
                      priority === o.v ? cn(o.cls, 'text-white') : 'text-muted-foreground hover:text-foreground')}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* repeat daily */}
          {scope === 'day' && (
            <button
              onClick={() => setRepeatDaily((v) => !v)}
              className={cn('w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-colors text-left',
                repeatDaily ? 'border-primary/40 bg-primary/10' : 'border-border bg-background hover:bg-muted/40')}
            >
              <span className={cn('w-9 h-5 rounded-full relative shrink-0 transition-colors', repeatDaily ? 'bg-primary' : 'bg-muted-foreground/30')}>
                <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', repeatDaily ? 'left-[18px]' : 'left-0.5')} />
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium"><Repeat className="w-3.5 h-3.5" /> Repeat as daily routine</span>
            </button>
          )}

          {/* notes + handwrite */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><AlignLeft className="w-3 h-3" /> Notes</label>
              <button onClick={() => setHwOpen(true)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Pen className="w-3 h-3" /> Handwrite</button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes, context, anything…  (or use Handwrite)"
              rows={5}
              className="mt-1.5 w-full px-3.5 py-3 rounded-xl bg-background border border-border text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/40 whitespace-pre-wrap"
            />
          </div>

          {/* checklist */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <ListChecks className="w-3 h-3" /> Checklist
              {checklist.length > 0 && <span className="text-muted-foreground/70">· {doneCount}/{checklist.length}</span>}
            </label>
            <div className="mt-1.5 space-y-1.5">
              {checklist.map((c, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <button
                    onClick={() => setChecklist((cl) => cl.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
                    className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0', c.done ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40 hover:border-primary')}
                  >
                    {c.done && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <input
                    value={c.text}
                    onChange={(e) => setChecklist((cl) => cl.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                    className={cn('flex-1 bg-transparent text-sm focus:outline-none', c.done && 'line-through text-muted-foreground')}
                  />
                  <button onClick={() => setChecklist((cl) => cl.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  value={subInput}
                  onChange={(e) => setSubInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(subInput) } }}
                  placeholder="Add a checklist item…"
                  className="flex-1 bg-transparent text-sm focus:outline-none py-1"
                />
              </div>
            </div>
          </div>

          {/* tags */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><TagIcon className="w-3 h-3" /> Tags</label>
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              {tags.map((t) => (
                <span key={t} className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full', tagColor(t))}>
                  {t}<button onClick={() => setTags(tags.filter((x) => x !== t))}><X className="w-3 h-3" /></button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) } }}
                placeholder="add tag…"
                className="bg-transparent text-xs focus:outline-none px-1 py-1 min-w-[90px] flex-1"
              />
            </div>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {suggestions.map((t) => (
                  <button key={t} onClick={() => addTag(t)} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary">+ {t}</button>
                ))}
              </div>
            )}
          </div>

          {/* status (edit only) */}
          {isEdit && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={status === 'done'} onChange={(e) => setStatus(e.target.checked ? 'done' : 'pending')} className="w-4 h-4 accent-emerald-500" />
              Mark as done
            </label>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-border">
          {isEdit && (
            <Button variant="ghost" size="sm" onClick={del} disabled={saving} className="text-rose-500 hover:text-rose-600 gap-1.5"><Trash2 className="w-4 h-4" /> Delete</Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={!title.trim() || saving} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{isEdit ? 'Save' : 'Add'}
          </Button>
        </div>
      </Card>

      <HandwritingPad open={hwOpen} onClose={() => setHwOpen(false)} onResult={onHandwriting} textOnly title="Handwrite details" />
    </div>
  )
}
