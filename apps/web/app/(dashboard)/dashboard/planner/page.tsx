'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2, CalendarDays, CalendarRange, ChevronLeft, ChevronRight,
  Plus, X, Check, Trash2, Tag as TagIcon, Target, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

// ----- local date helpers (calendar-day granularity) -----
const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

const PRIORITY_STYLE: Record<string, string> = {
  high: 'border-l-rose-500',
  normal: 'border-l-primary',
  low: 'border-l-slate-400',
}

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

export default function PlannerPage() {
  const [view, setView] = useState<View>('day')
  const [cursor, setCursor] = useState(new Date()) // anchor for current day/month
  const [entries, setEntries] = useState<Entry[]>([])
  const [knownTags, setKnownTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const dateParam = view === 'month' ? monthKey(cursor) : dayKey(cursor)

  const load = useCallback(() => {
    setLoading(true)
    return fetch(`/api/planner?scope=${view}&date=${dateParam}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) { setEntries(res.data); setKnownTags(res.tags ?? []) }
      })
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

  const remove = async (id: string) => {
    setEntries((prev) => prev.filter((x) => x.id !== id))
    await fetch(`/api/planner?id=${id}`, { method: 'DELETE' })
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
            Plan your day and month. Tag activities however you like.
          </p>
        </div>
        {/* view toggle */}
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
          dayKeyStr={dayKey(cursor)} entries={entries} knownTags={knownTags}
          onAdded={load} onToggle={toggleDone} onRemove={remove}
        />
      ) : (
        <MonthView
          cursor={cursor} entries={entries} knownTags={knownTags}
          onAdded={load} onToggle={toggleDone} onRemove={remove}
          onPickDay={(d) => { setCursor(d); setView('day') }}
        />
      )}
    </div>
  )
}

// ============ DAY VIEW ============
function DayView({
  dayKeyStr, entries, knownTags, onAdded, onToggle, onRemove,
}: {
  dayKeyStr: string
  entries: Entry[]
  knownTags: string[]
  onAdded: () => void
  onToggle: (e: Entry) => void
  onRemove: (id: string) => void
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
        {items.map((e) => (
          <EntryRow key={e.id} entry={e} onToggle={onToggle} onRemove={onRemove} />
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No plans yet for this day.</p>
        )}
      </div>

      <AddForm scope="day" dateParam={dayKeyStr} knownTags={knownTags} onAdded={onAdded} />
    </div>
  )
}

// ============ MONTH VIEW ============
function MonthView({
  cursor, entries, knownTags, onAdded, onToggle, onRemove, onPickDay,
}: {
  cursor: Date
  entries: Entry[]
  knownTags: string[]
  onAdded: () => void
  onToggle: (e: Entry) => void
  onRemove: (id: string) => void
  onPickDay: (d: Date) => void
}) {
  const goals = entries.filter((e) => e.scope === 'month')
  const dayEntries = entries.filter((e) => e.scope === 'day')

  // counts per day-of-month
  const countByDay = useMemo(() => {
    const m: Record<string, number> = {}
    dayEntries.forEach((e) => {
      const k = e.date.slice(0, 10) // YYYY-MM-DD (UTC anchor → date part is stable)
      m[k] = (m[k] ?? 0) + 1
    })
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
      {/* calendar grid */}
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
                className={cn(
                  'aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-sm transition-colors hover:bg-muted',
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
      </Card>

      {/* monthly goals */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Target className="w-4 h-4 text-violet-400" /> Monthly goals
        </h3>
        <div className="space-y-2">
          {goals.map((e) => (
            <EntryRow key={e.id} entry={e} onToggle={onToggle} onRemove={onRemove} />
          ))}
          {goals.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No monthly goals set.</p>
          )}
        </div>
        <div className="mt-3">
          <AddForm scope="month" dateParam={monthKey(cursor)} knownTags={knownTags} onAdded={onAdded} />
        </div>
      </div>
    </div>
  )
}

// ============ ENTRY ROW ============
function EntryRow({ entry, onToggle, onRemove }: { entry: Entry; onToggle: (e: Entry) => void; onRemove: (id: string) => void }) {
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
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {entry.startTime && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Clock className="w-3 h-3" /> {entry.startTime}
            </span>
          )}
          <span className={cn('font-medium', done && 'line-through text-muted-foreground')}>{entry.title}</span>
        </div>
        {entry.details && <p className="text-xs text-muted-foreground mt-0.5">{entry.details}</p>}
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {entry.tags.map((t) => (
              <span key={t} className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', tagColor(t))}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <button onClick={() => onRemove(entry.id)} className="text-muted-foreground hover:text-rose-500 shrink-0 p-1">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </Card>
  )
}

// ============ ADD FORM ============
function AddForm({
  scope, dateParam, knownTags, onAdded,
}: {
  scope: 'day' | 'month'
  dateParam: string
  knownTags: string[]
  onAdded: () => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [startTime, setStartTime] = useState('')
  const [priority, setPriority] = useState('normal')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)

  const addTag = (t: string) => {
    const v = t.trim()
    if (v && !tags.includes(v)) setTags([...tags, v])
    setTagInput('')
  }

  const reset = () => {
    setTitle(''); setDetails(''); setStartTime(''); setPriority('normal'); setTags([]); setTagInput('')
  }

  const submit = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    await fetch('/api/planner', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope, date: dateParam, title, details: details || undefined,
        startTime: scope === 'day' ? startTime || undefined : undefined,
        priority, tags,
      }),
    })
    setSaving(false)
    reset()
    setOpen(false)
    onAdded()
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="w-full gap-2 border-dashed">
        <Plus className="w-4 h-4" /> Add {scope === 'month' ? 'monthly goal' : 'plan'}
      </Button>
    )
  }

  const suggestions = knownTags.filter((t) => !tags.includes(t)).slice(0, 8)

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">New {scope === 'month' ? 'monthly goal' : 'plan'}</span>
        <button onClick={() => { reset(); setOpen(false) }} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
        placeholder={scope === 'month' ? 'e.g. Finish reading 2 books' : 'e.g. Study session — AMC geometry'}
        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />

      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Details (optional)"
        rows={2}
        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
      />

      <div className="flex gap-2 flex-wrap">
        {scope === 'day' && (
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        )}
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="low">Low priority</option>
          <option value="normal">Normal</option>
          <option value="high">High priority</option>
        </select>
      </div>

      {/* tags */}
      <div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {tags.map((t) => (
            <span key={t} className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full', tagColor(t))}>
              {t}
              <button onClick={() => setTags(tags.filter((x) => x !== t))}><X className="w-3 h-3" /></button>
            </span>
          ))}
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-dashed border-border">
            <TagIcon className="w-3 h-3 text-muted-foreground" />
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) } }}
              placeholder="add tag"
              className="bg-transparent text-xs focus:outline-none w-16"
            />
          </span>
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

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => { reset(); setOpen(false) }}>Cancel</Button>
        <Button size="sm" onClick={submit} disabled={!title.trim() || saving} className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add
        </Button>
      </div>
    </Card>
  )
}
