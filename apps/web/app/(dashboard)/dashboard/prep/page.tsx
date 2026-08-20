'use client'

/**
 * Course Prep — the night-before workspace.
 *
 * Answers three questions for the next school day: what is coming, what to
 * bring, and what to actually study. Each class carries its FCPS-authoritative
 * sources, the student's own notes and due flashcards for that subject, and a
 * level-by-level challenge ladder that reaches past the syllabus into honors
 * and competition work.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  GraduationCap, Sparkles, Package, ExternalLink, Check, ChevronDown,
  Trophy, Layers, BookOpen, Loader2, RefreshCw, MapPin, AlertTriangle, Target,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SchoolDay, Course, StudySource, LadderRung, Competition } from '@/lib/school'

interface PrepItem {
  course: Course
  period: number
  time: string
  room: string
  roomName: string | null
  arc: string
  materials: string[]
  habits: string[]
  keySources: StudySource[]
  allSources: StudySource[]
  ladder: LadderRung[]
  ladderAt: number
  nextRung: { level: number; title: string; goal: string; action: string } | null
  competitions: Competition[]
  myNotes: { title: string; slug: string | null; updatedAt: string }[]
  noteCount: number
  flashcardsDue: number
  weakestCards: string[]
}

interface PrepResponse {
  success: boolean
  date: string
  day: SchoolDay
  prep: PrepItem[]
  districtSources: StudySource[]
  briefing: string
  message?: string
}

const KIND_STYLE: Record<string, string> = {
  official: 'bg-sky-500/15 text-sky-400',
  standard: 'bg-violet-500/15 text-violet-400',
  platform: 'bg-emerald-500/15 text-emerald-400',
  practice: 'bg-amber-500/15 text-amber-400',
  enrichment: 'bg-fuchsia-500/15 text-fuchsia-400',
  competition: 'bg-rose-500/15 text-rose-400',
}

export default function PrepPage() {
  const [data, setData] = useState<PrepResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [date, setDate] = useState<string>('')
  const [packed, setPacked] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async (d?: string, ai = false) => {
    ai ? setAiLoading(true) : setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (d) qs.set('date', d)
      if (ai) qs.set('ai', '1')
      const res = await fetch(`/api/school/prep?${qs}`)
      const json = (await res.json()) as PrepResponse
      if (json.success) {
        setData((prev) => (ai && prev ? { ...prev, briefing: json.briefing } : json))
        setDate(json.date)
        if (!open && json.prep?.length) setOpen(json.prep[0]!.course.id)
      }
    } catch { /* surfaced by the empty state */ } finally {
      setLoading(false); setAiLoading(false)
    }
  }, [open])

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const togglePack = (item: string) =>
    setPacked((prev) => {
      const next = new Set(prev)
      next.has(item) ? next.delete(item) : next.add(item)
      return next
    })

  const advanceLadder = async (courseId: string, level: number) => {
    setData((prev) =>
      prev ? { ...prev, prep: prev.prep.map((p) => (p.course.id === courseId ? { ...p, ladderAt: level } : p)) } : prev
    )
    try {
      await fetch('/api/school/prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, level }),
      })
    } catch { /* optimistic; the next load reconciles */ }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Building tomorrow&apos;s prep…
      </div>
    )
  }

  if (!data) {
    return <div className="p-6 text-sm text-muted-foreground">Could not load the prep sheet. Try refreshing.</div>
  }

  const { day, prep } = data
  const totalDue = prep.reduce((n, p) => n + p.flashcardsDue, 0)

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      {/* ── header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-lime-400" /> Course Prep
          </h1>
          <p className="text-xs text-muted-foreground">
            {day.dateLabel} · {day.label}
            {day.quarter ? ` · Quarter ${day.quarter}` : ''}
            {day.earlyRelease ? ' · 2-hour early release' : ''}
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); void load(e.target.value) }}
          className="bg-muted/40 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Link href="/dashboard/school" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" /> Map & route
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {totalDue > 0 && (
            <Link href="/dashboard/flashcards" className="text-[11px] px-2 py-1 rounded-full bg-rose-500/15 text-rose-400 font-bold hover:bg-rose-500/25">
              {totalDue} flashcards due
            </Link>
          )}
          <Button size="sm" variant="outline" onClick={() => void load(date, true)} disabled={aiLoading}>
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
            {data.briefing ? 'Regenerate briefing' : 'AI briefing'}
          </Button>
        </div>
      </div>

      {!day.isSchoolDay ? (
        <Card className="p-8 text-center">
          <div className="text-4xl mb-2">🌴</div>
          <div className="font-bold text-lg">{day.label}</div>
          <p className="text-sm text-muted-foreground mt-1">{data.message}</p>
          {day.next && (
            <button onClick={() => void load(day.next!)} className="mt-4 text-sm text-primary hover:underline">
              Prep the next school day instead →
            </button>
          )}
        </Card>
      ) : (
        <>
          {/* ── AI briefing ── */}
          {data.briefing && (
            <Card className="p-4 border-primary/30 bg-primary/[0.04]">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Coach briefing
              </h2>
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
                <Markdownish text={data.briefing} />
              </div>
            </Card>
          )}

          <div className="grid lg:grid-cols-[minmax(0,1fr)_260px] gap-4 items-start">
            {/* ── classes ── */}
            <div className="space-y-2.5">
              {prep.map((p) => (
                <CourseCard
                  key={p.course.id}
                  item={p}
                  expanded={open === p.course.id}
                  onToggle={() => setOpen(open === p.course.id ? null : p.course.id)}
                  onAdvance={advanceLadder}
                />
              ))}

              {day.untimed.length > 0 && (
                <Card className="p-3 text-xs text-muted-foreground">
                  Homeroom / team: {day.untimed.map((c) => `${c.name} — ${c.room}, ${c.teacher}`).join(' · ')}
                </Card>
              )}
            </div>

            {/* ── pack list + district sources ── */}
            <div className="space-y-3 lg:sticky lg:top-4">
              <Card className="p-3">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" /> Pack tonight
                </h2>
                <ul className="space-y-1">
                  {day.packList.map(({ item, forCourse }) => {
                    const on = packed.has(item)
                    return (
                      <li key={item}>
                        <button onClick={() => togglePack(item)} className="w-full flex items-start gap-2 text-left group py-0.5">
                          <span className={cn(
                            'mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
                            on ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40 group-hover:border-primary'
                          )}>
                            {on && <Check className="w-2.5 h-2.5 text-white" />}
                          </span>
                          <span className={cn('text-xs leading-snug', on && 'line-through text-muted-foreground')}>
                            {item}
                            {forCourse && <span className="text-muted-foreground/70"> · {forCourse}</span>}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <div className="mt-2 pt-2 border-t border-border/60 text-[11px] text-muted-foreground tabular-nums">
                  {packed.size} / {day.packList.length} packed
                </div>
              </Card>

              <Card className="p-3">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Check every night
                </h2>
                <ul className="space-y-1.5">
                  {data.districtSources.slice(0, 3).map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                        {s.label} <ExternalLink className="w-3 h-3" />
                      </a>
                      <p className="text-[10px] text-muted-foreground leading-snug">{s.note}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── course card ─────────────────────────────────────────────────────────────

function CourseCard({
  item, expanded, onToggle, onAdvance,
}: {
  item: PrepItem
  expanded: boolean
  onToggle: () => void
  onAdvance: (courseId: string, level: number) => void
}) {
  const { course } = item
  return (
    <Card className="overflow-hidden" style={{ borderLeft: `3px solid ${course.accent}` }}>
      <button onClick={onToggle} className="w-full text-left p-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2.5">
          <span className="text-xl shrink-0">{course.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm">{course.name}</span>
              {course.rigor !== 'standard' && (
                <span className={cn(
                  'text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full',
                  course.rigor === 'honors' ? 'bg-violet-500/20 text-violet-400' : 'bg-amber-500/20 text-amber-400'
                )}>
                  {course.rigor === 'honors' ? 'Honors' : 'Advanced Academic'}
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2">
              <span className="tabular-nums">P{item.period} · {item.time}</span>
              <span>{item.room}{item.roomName ? ` · ${item.roomName}` : ''}</span>
              <span>{course.teacher}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {item.flashcardsDue > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400">
                {item.flashcardsDue} due
              </span>
            )}
            {item.nextRung && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                L{item.ladderAt}/{item.ladder.length}
              </span>
            )}
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
          </div>
        </div>

        {!expanded && item.nextRung && (
          <div className="mt-2 pl-8 text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Target className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
            <span><span className="font-semibold text-foreground">Next:</span> {item.nextRung.action}</span>
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/60">
          {item.arc && <p className="text-xs text-muted-foreground leading-relaxed pt-2">{item.arc}</p>}

          {/* what to bring */}
          {item.materials.length > 0 && (
            <Section icon={Package} title="Bring">
              <div className="flex flex-wrap gap-1">
                {item.materials.map((m) => (
                  <span key={m} className="text-[11px] px-2 py-0.5 rounded-full bg-muted">{m}</span>
                ))}
              </div>
            </Section>
          )}

          {/* my material */}
          <Section icon={BookOpen} title="Your material">
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <Link href="/dashboard/notes" className="text-primary hover:underline">
                {item.noteCount} {course.subject} note{item.noteCount === 1 ? '' : 's'}
              </Link>
              <Link href="/dashboard/flashcards" className={cn('hover:underline', item.flashcardsDue ? 'text-rose-400 font-semibold' : 'text-muted-foreground')}>
                {item.flashcardsDue} flashcard{item.flashcardsDue === 1 ? '' : 's'} due
              </Link>
              <Link href={`/dashboard/chat?mode=${encodeURIComponent(course.subject)}`} className="text-primary hover:underline">
                Ask the tutor about {course.short}
              </Link>
            </div>
            {item.weakestCards.length > 0 && (
              <div className="mt-1.5 rounded-lg bg-amber-500/[0.07] border border-amber-500/20 p-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-amber-500 flex items-center gap-1 mb-1">
                  <AlertTriangle className="w-3 h-3" /> Keeps tripping you up
                </div>
                <ul className="space-y-0.5">
                  {item.weakestCards.map((c, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground">· {c}</li>
                  ))}
                </ul>
              </div>
            )}
            {item.myNotes.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {item.myNotes.map((n) => (
                  <li key={n.slug ?? n.title} className="text-[11px] truncate">
                    {n.slug
                      ? <Link href={`/dashboard/notes/${n.slug}`} className="text-primary hover:underline">{n.title}</Link>
                      : <span className="text-muted-foreground">{n.title}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ladder */}
          {item.ladder.length > 0 && (
            <Section icon={Layers} title={`Challenge ladder — level ${item.ladderAt} of ${item.ladder.length}`}>
              <ol className="space-y-1.5">
                {item.ladder.map((rung) => {
                  const done = rung.level <= item.ladderAt
                  const isNext = rung.level === item.ladderAt + 1
                  return (
                    <li key={rung.level} className={cn(
                      'rounded-lg p-2 border transition-colors',
                      isNext ? 'border-primary/40 bg-primary/[0.06]' : done ? 'border-transparent opacity-55' : 'border-transparent'
                    )}>
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => onAdvance(course.id, done ? rung.level - 1 : rung.level)}
                          title={done ? 'Mark not reached' : 'Mark reached'}
                          className={cn(
                            'mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                            done ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40 hover:border-primary'
                          )}
                        >
                          {done && <Check className="w-2.5 h-2.5 text-white" />}
                        </button>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold">
                            L{rung.level} · {rung.title}
                            <span className="ml-2 text-[10px] font-normal text-muted-foreground">{rung.span}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-snug">{rung.goal}</div>
                          {isNext && (
                            <div className="text-[11px] mt-1 flex items-start gap-1.5">
                              <Target className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
                              <span><span className="font-semibold">Do this:</span> {rung.action}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </Section>
          )}

          {/* habits */}
          {item.habits.length > 0 && (
            <Section icon={RefreshCw} title="Habits that matter here">
              <ul className="space-y-0.5">
                {item.habits.map((h) => (
                  <li key={h} className="text-[11px] text-muted-foreground">· {h}</li>
                ))}
              </ul>
            </Section>
          )}

          {/* sources */}
          <Section icon={ExternalLink} title="Study sources">
            <ul className="space-y-1.5">
              {item.allSources.map((s) => (
                <li key={s.url}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-semibold text-primary hover:underline">
                      {s.label}
                    </a>
                    <span className={cn('text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full', KIND_STYLE[s.kind])}>
                      {s.kind}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug">{s.note}</p>
                </li>
              ))}
            </ul>
          </Section>

          {/* competitions */}
          {item.competitions.length > 0 && (
            <Section icon={Trophy} title="Go compete">
              <ul className="space-y-1.5">
                {item.competitions.map((c) => (
                  <li key={c.id}>
                    <a href={c.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                      {c.name} <ExternalLink className="w-3 h-3" />
                    </a>
                    <span className="text-[10px] text-muted-foreground"> · {c.window}</span>
                    <p className="text-[10px] text-muted-foreground leading-snug">{c.why}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
    </Card>
  )
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
        <Icon className="w-3 h-3" /> {title}
      </h3>
      {children}
    </div>
  )
}

/**
 * Minimal markdown rendering for the coach briefing — the model is prompted to
 * emit only bold headings, paragraphs and dashes, so a full parser is overkill.
 */
function Markdownish({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').filter((l) => l.trim()).map((line, i) => {
        const bold = /^\*\*(.+?)\*\*\s*(?:—|-)?\s*(.*)$/.exec(line.trim())
        if (bold) {
          return (
            <p key={i} className="mt-2 first:mt-0">
              <strong className="text-primary">{bold[1]}</strong>
              {bold[2] ? <span> — {inline(bold[2])}</span> : null}
            </p>
          )
        }
        const bullet = /^[-*]\s+(.*)$/.exec(line.trim())
        if (bullet) return <p key={i} className="pl-4 -indent-2">· {inline(bullet[1]!)}</p>
        return <p key={i}>{inline(line)}</p>
      })}
    </>
  )
}

function inline(s: string): React.ReactNode {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  )
}
