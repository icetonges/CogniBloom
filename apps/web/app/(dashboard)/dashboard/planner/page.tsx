'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2, CalendarDays, CalendarRange, ChevronLeft, ChevronRight,
  Plus, X, Check, Trash2, Tag as TagIcon, Clock, Target, Flag,
  AlignLeft, Pen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { HandwritingPad, type HandwritingResult } from '@/components/notes/HandwritingPad'

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

interface EditorState { entry: Entry | null; scope: 'day' | 'month'; date: Date }

export default function PlannerPage() {
  const [view, setView] = useState<View>('month') // monthly is the default
  const [cursor, setCursor] = useState(new Date())
  const [entries, setEntries] = useState<Entry[]>([])
  const [knownTags, setKnownTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState<EditorState | null>(null)

  const dateParam = view === 'month' ? monthKey(cursor) : dayKey(cursor)

  const load = useCallback(() => {
    setLoading(true)
    return fetch(`/api/planner?scope=${view}&date=${dateParam}`)
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

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" /> Planner
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Plan your month and day. Tag activities however you like.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
            {(['month', 'day'] as View[]).map((v) => (
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
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setEditor({ entry: null, scope: view === 'month' ? 'month' : 'day', date: cursor })}
          >
            <Plus className="w-4 h-4" /> New
          </Button>
        </div>
      </div>

      {/* date nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => shift(-1)}><ChevronLeft className="w-4 h-4" /></Button>
        <div className="text-center">
          <div className="font-semibold">
            {view === 'month'
              ? cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              : cursor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <button onClick={() => setCursor(new Date())} className="text-xs text-primary hover:underline">
            Jump to today
          </button>
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
          onAddPlan={() => setEditor({ entry: null, scope: 'day', date: cursor })}
          onOpen={(e) => setEditor({ entry: e, scope: e.scope, date: cursor })}
          onToggle={toggleDone}
        />
      ) : (
        <MonthView
          cursor={cursor}
          entries={entries}
          onPickDay={(d) => setEditor({ entry: null, scope: 'day', date: d })}
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

// ============ DAY VIEW ============
function DayView({
  entries, onAddPlan, onOpen, onToggle,
}: {
  entries: Entry[]
  onAddPlan: () => void
  onOpen: (e: Entry) => void
  onToggle: (e: Entry) => void
}) {
  const items = entries.filter((e) => e.scope === 'day')
  const done = items.filter((e) => e.status === 'done').length
  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(done / items.length) * 100}%` }} />
          </div>
          <span className="tabular-nums">{done}/{items.length} done</span>
        </div>
      )}
      <div className="space-y-2">
        {items.map((e) => <EntryRow key={e.id} entry={e} onOpen={onOpen} onToggle={onToggle} />)}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No plans yet for this day.</p>
        )}
      </div>
      <Button variant="outline" onClick={onAddPlan} className="w-full gap-2 border-dashed">
        <Plus className="w-4 h-4" /> Add plan
      </Button>
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
    dayEntries.forEach((e) => { const k = e.date.slice(0, 10); m[k] = (m[k] ?? 0) + 1 })
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
        {entry.details && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 whitespace-pre-wrap">{entry.details}</p>}
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

  const [title, setTitle] = useState(initial.entry?.title ?? '')
  const [details, setDetails] = useState(initial.entry?.details ?? '')
  const [startTime, setStartTime] = useState(initial.entry?.startTime ?? '')
  const [priority, setPriority] = useState<string>(initial.entry?.priority ?? 'normal')
  const [tags, setTags] = useState<string[]>(initial.entry?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [status, setStatus] = useState<string>(initial.entry?.status ?? 'pending')
  const [saving, setSaving] = useState(false)
  const [hwOpen, setHwOpen] = useState(false)

  const addTag = (t: string) => {
    const v = t.trim()
    if (v && !tags.includes(v)) setTags([...tags, v])
    setTagInput('')
  }

  const onHandwriting = (r: HandwritingResult) => {
    if (r.text && r.text.trim()) setDetails((d) => (d ? `${d}\n${r.text}` : r.text!))
  }

  const submit = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      if (isEdit) {
        await fetch('/api/planner', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: initial.entry!.id, title, details, tags, priority, status,
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
            priority, tags,
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

  const suggestions = knownTags.filter((t) => !tags.includes(t)).slice(0, 10)
  const dateLabel = scope === 'month'
    ? dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto bg-background/70 backdrop-blur-sm"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <Card className="w-full max-w-lg my-auto shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-bold text-lg">
              {isEdit ? 'Edit' : 'New'} {scope === 'month' ? 'monthly goal' : 'plan'}
            </h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              {scope === 'month' ? <Target className="w-3 h-3" /> : <CalendarDays className="w-3 h-3" />}
              {dateLabel}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* title */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={scope === 'month' ? 'e.g. Finish reading 2 books' : 'e.g. Study session — AMC geometry'}
              className="mt-1 w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* time + priority */}
          <div className="grid grid-cols-2 gap-3">
            {scope === 'day' && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            )}
            <div className={scope === 'day' ? '' : 'col-span-2'}>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Flag className="w-3 h-3" /> Priority
              </label>
              <div className="mt-1 inline-flex rounded-lg border border-border p-0.5 w-full">
                {PRIORITY_OPTS.map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setPriority(o.v)}
                    className={cn(
                      'flex-1 text-xs font-medium py-1.5 rounded-md transition-colors',
                      priority === o.v ? cn(o.cls, 'text-white') : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* details + handwrite */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <AlignLeft className="w-3 h-3" /> Details
              </label>
              <button
                onClick={() => setHwOpen(true)}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Pen className="w-3 h-3" /> Handwrite
              </button>
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Notes, checklist, anything…  (or use Handwrite)"
              rows={4}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/40 whitespace-pre-wrap"
            />
          </div>

          {/* tags */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <TagIcon className="w-3 h-3" /> Tags
            </label>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {tags.map((t) => (
                <span key={t} className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full', tagColor(t))}>
                  {t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))}><X className="w-3 h-3" /></button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) } }}
                placeholder="add tag…"
                className="bg-transparent text-xs focus:outline-none px-1 py-1 min-w-[80px] flex-1"
              />
            </div>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {suggestions.map((t) => (
                  <button key={t} onClick={() => addTag(t)} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary">
                    + {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* status (edit only) */}
          {isEdit && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={status === 'done'}
                onChange={(e) => setStatus(e.target.checked ? 'done' : 'pending')}
                className="w-4 h-4 accent-emerald-500"
              />
              Mark as done
            </label>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          {isEdit && (
            <Button variant="ghost" size="sm" onClick={del} disabled={saving} className="text-rose-500 hover:text-rose-600 gap-1.5">
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={!title.trim() || saving} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isEdit ? 'Save' : 'Add'}
          </Button>
        </div>
      </Card>

      <HandwritingPad
        open={hwOpen}
        onClose={() => setHwOpen(false)}
        onResult={onHandwriting}
        textOnly
        title="Handwrite details"
      />
    </div>
  )
}
