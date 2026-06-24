'use client'

import { useState } from 'react'
import { StudyCoachAI } from '@/components/study-coach/StudyCoachAI'
import {
  Sparkles, CheckCircle2, Circle, BookOpen, Code2,
  Languages, PenLine, Brain, AlertTriangle,
  Clock, Sun, Moon, RotateCcw,
  ChevronDown, ChevronUp, Star, Heart,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── tiny helpers ────────────────────────────────────────────────────────────
function SectionCard({
  color, emoji, title, children, defaultOpen = true,
}: {
  color: string; emoji: string; title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${color}25`, background: `${color}08` }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        style={{ background: `${color}12` }}
      >
        <span className="text-2xl">{emoji}</span>
        <span className="flex-1 font-bold text-sm tracking-wide">{title}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5 pt-3 space-y-3">{children}</div>}
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
      <Star className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
      <span>{children}</span>
    </li>
  )
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full"
      style={{ background: `${color}20`, color, border: `1px solid ${color}35` }}
    >
      {children}
    </span>
  )
}

function SubjectCard({
  icon: Icon, color, subject, tips,
}: { icon: React.ElementType; color: string; subject: string; tips: string[] }) {
  return (
    <div className="rounded-xl p-4" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-sm font-bold">{subject}</span>
      </div>
      <ul className="space-y-1.5">
        {tips.map(t => <Tip key={t}>{t}</Tip>)}
      </ul>
    </div>
  )
}

// ── Daily checklist ──────────────────────────────────────────────────────────
const CHECKLIST = [
  { id: 'pack',    label: 'Pack your bag / open your notes before sitting down' },
  { id: 'goal',   label: 'Write one goal for today\'s study session' },
  { id: 'phone',  label: 'Put your phone in another room (or face-down, on silent)' },
  { id: 'chunk',  label: 'Study for 25 min, then take a 5-min break' },
  { id: 'wrong',  label: 'Write down anything you got wrong today' },
  { id: 'review', label: 'Spend 5 min reviewing yesterday\'s notes' },
  { id: 'note',   label: 'Fill in your Daily Reflection note before you close the books' },
  { id: 'plan',   label: 'Write what you\'ll review tomorrow' },
]

// ── Main component ────────────────────────────────────────────────────────────
export function StudyCoachClient() {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setChecked(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) }; return n })
  const doneCount = checked.size

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* ── Hero ── */}
      <div
        className="rounded-3xl p-6 sm:p-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.10) 50%, rgba(16,185,129,0.08) 100%)',
          border: '1px solid rgba(99,102,241,0.25)',
        }}
      >
        <div className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #a78bfa, transparent)' }} />
        <div className="pointer-events-none absolute -bottom-8 -left-8 w-36 h-36 rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #34d399, transparent)' }} />

        <div className="flex items-start gap-4 relative">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}
          >
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-1">
              <span className="bg-gradient-to-r from-violet-400 to-emerald-400 bg-clip-text text-transparent">
                Your Study Coach
              </span>
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
              Hey! I&apos;m here to help you become the student <em>you already have the potential to be</em>.
              This guide is made just for you — a rising 7th grader who wants to learn smarter, not harder.
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 1: What successful 7th graders do ── */}
      <SectionCard color="#6366f1" emoji="🏆" title="1 · What Successful 7th Graders Do Every Day">
        <p className="text-sm text-muted-foreground mb-2">
          Here&apos;s the secret: the best students in your class don&apos;t study for 5 hours a night.
          They just do <strong>a few small things consistently</strong>.
        </p>
        <ul className="space-y-2">
          <Tip>They <strong>show up ready</strong> — bag packed, notebook open, phone away before they start.</Tip>
          <Tip>They <strong>try hard problems even when it&apos;s annoying</strong> — they don&apos;t skip the hard stuff.</Tip>
          <Tip>They <strong>review notes the same day</strong> — not just the night before a test.</Tip>
          <Tip>They <strong>write down what confused them</strong> — so they can fix it later.</Tip>
          <Tip>They <strong>take short breaks</strong> — 25 minutes of focus, 5 minutes of rest.</Tip>
          <Tip>They <strong>ask &quot;why&quot;</strong> — not just &quot;what is the answer.&quot;</Tip>
        </ul>
      </SectionCard>

      {/* ── Coach Bloom AI ── */}
      <StudyCoachAI />

      {/* ── Section 2 & 3: Why + Why it works ── */}
      <SectionCard color="#10b981" emoji="🔬" title="2–3 · Why Those Habits Work (The Science Behind It)">
        <p className="text-sm text-muted-foreground mb-3">
          Your brain isn&apos;t a hard drive. It doesn&apos;t just save files. It builds <em>connections</em> — and
          those connections get stronger every time you <strong>review and practice</strong>.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { title: '⏰ Spaced Repetition', body: 'Reviewing something on Day 1, Day 3, and Day 7 is WAY more powerful than re-reading it for 3 hours in one night. Your brain loves little reminders spread out over time.' },
            { title: '✏️ The Testing Effect', body: 'Closing your notes and trying to recall what you learned is 2× more effective than just re-reading. Quiz yourself — even if you get it wrong.' },
            { title: '😴 Sleep = Supercharger', body: 'Your brain actually replays what you studied while you sleep. That\'s why 7 hours of sleep after studying beats 5 hours of cramming with no sleep.' },
            { title: '🔁 Mistakes = Learning', body: 'Every time you get something wrong and then fix it, your brain builds a stronger memory. Wrong answers aren\'t failures — they\'re part of the process.' },
          ].map(({ title, body }) => (
            <div key={title} className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)' }}>
              <p className="text-sm font-bold mb-1">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Section 4: How to slowly become that student ── */}
      <SectionCard color="#f59e0b" emoji="🌱" title="4 · How to Slowly Become That Kind of Student">
        <p className="text-sm text-muted-foreground mb-3">
          You don&apos;t need to change everything at once. Pick <strong>one habit this week</strong> and build from there.
        </p>
        <div className="flex flex-col gap-3">
          {[
            { week: 'Week 1', habit: 'Put your phone away before studying. Just that. Nothing else.' },
            { week: 'Week 2', habit: 'After studying, write 3 things you learned. Takes 3 minutes.' },
            { week: 'Week 3', habit: 'Review yesterday\'s notes for 5 minutes before starting new stuff.' },
            { week: 'Week 4', habit: 'For every wrong answer, write WHY you got it wrong.' },
          ].map(({ week, habit }) => (
            <div key={week} className="flex items-start gap-3">
              <Pill color="#f59e0b">{week}</Pill>
              <p className="text-sm text-muted-foreground leading-relaxed">{habit}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4 italic">
          After 4 weeks, those habits feel automatic. That&apos;s when the real growth starts.
        </p>
      </SectionCard>

      {/* ── Section 5: Before / During / After ── */}
      <SectionCard color="#0ea5e9" emoji="⏱️" title="5 · Before, During, and After Studying">
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            {
              icon: Sun, color: '#f59e0b', label: 'Before',
              tips: [
                'Clear your desk — clutter = distraction',
                'Write your goal: "Today I will finish problems 1–10"',
                'Get water, snack, everything you need',
                'Put your phone on Do Not Disturb',
              ],
            },
            {
              icon: Clock, color: '#6366f1', label: 'During',
              tips: [
                'Work in 25-min focused blocks',
                'Mark anything confusing with a ❓',
                'Write notes in your own words, not copy-paste',
                'After each chunk, take a 5-min break (stand up!)',
              ],
            },
            {
              icon: Moon, color: '#10b981', label: 'After',
              tips: [
                'Review what you wrote — fix any ❓ marks',
                'Write 3 things you learned today',
                'Write 1–2 things you\'ll review tomorrow',
                'Fill in your Daily Reflection note',
              ],
            },
          ].map(({ icon: Icon, color, label, tips }) => (
            <div key={label} className="rounded-xl p-4" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4" style={{ color }} />
                <span className="text-sm font-bold">{label}</span>
              </div>
              <ul className="space-y-1.5">
                {tips.map(t => <Tip key={t}>{t}</Tip>)}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Section 6: Mistakes / confusion / frustration ── */}
      <SectionCard color="#ec4899" emoji="😤" title="6 · Handling Mistakes, Confusion &amp; Frustration">
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            {
              emoji: '❌', title: 'Got Something Wrong',
              color: '#ef4444',
              steps: [
                'Don\'t erase it — circle it instead',
                'Write: "I thought ___. The real answer is ___ because ___"',
                'That sentence = your best study material',
              ],
            },
            {
              emoji: '😕', title: 'Feeling Confused',
              color: '#f59e0b',
              steps: [
                'Write down exactly what\'s confusing you',
                'Try a different explanation (YouTube, ask an adult)',
                'Confusion is just your brain asking for more info — it\'s normal',
              ],
            },
            {
              emoji: '😤', title: 'Feeling Frustrated',
              color: '#6366f1',
              steps: [
                'Stop. Take 5 deep breaths or a 5-min walk',
                'Come back and try just ONE small part of the problem',
                'Frustration means you\'re working on something hard — that\'s GOOD',
              ],
            },
          ].map(({ emoji, title, color, steps }) => (
            <div key={title} className="rounded-xl p-4" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
              <p className="text-lg mb-2">{emoji} <strong className="text-sm">{title}</strong></p>
              <ul className="space-y-1.5">
                {steps.map(s => <Tip key={s}>{s}</Tip>)}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Section 7: Subject-specific tips ── */}
      <SectionCard color="#8b5cf6" emoji="📚" title="7 · How to Study Each Subject">
        <div className="grid sm:grid-cols-2 gap-3">
          <SubjectCard
            icon={Brain} color="#6366f1" subject="Math"
            tips={[
              'Don\'t just read examples — close the book and TRY the problem first.',
              'When you get it wrong, find the exact step where you went off track.',
              'Do a few problems every day, even if it\'s easy. Consistency beats cramming.',
              'Explain your solution out loud as if teaching someone. If you can\'t, you don\'t fully get it yet.',
            ]}
          />
          <SubjectCard
            icon={BookOpen} color="#10b981" subject="Reading"
            tips={[
              'After each paragraph, pause and say out loud: "This paragraph is about ___."',
              'Circle words you don\'t know — look them up after the section.',
              'Ask yourself: What is the author trying to say? Why does this matter?',
              'Summarize what you read in 2–3 sentences when you finish.',
            ]}
          />
          <SubjectCard
            icon={PenLine} color="#f59e0b" subject="Writing"
            tips={[
              'Outline first (3 bullets is fine). Then write fast. Edit later.',
              'Don\'t stop to fix every word while drafting — get the ideas out first.',
              'Read your writing out loud. If it sounds weird, it probably reads weird.',
              'Strong writing = clear ideas, not fancy words.',
            ]}
          />
          <SubjectCard
            icon={Star} color="#ec4899" subject="Vocabulary"
            tips={[
              'Write new words in a sentence YOU made up — not from the book.',
              'Review your word list 3 days in a row, then once a week after that.',
              'Try to use a new word in conversation at least once before the week ends.',
              'Group similar words together — patterns help you remember faster.',
            ]}
          />
          <SubjectCard
            icon={Languages} color="#0ea5e9" subject="Duolingo / Language Learning"
            tips={[
              '15 minutes every day beats 2 hours on the weekend. Consistency is everything.',
              'After each lesson, write 3 words or phrases you learned.',
              'Try to think in the new language — even for tiny things ("I am going to eat now").',
              'Don\'t skip days — missing 2+ days erases progress faster than you think.',
            ]}
          />
          <SubjectCard
            icon={Code2} color="#14b8a6" subject="Coding / Technology"
            tips={[
              'Type code yourself — don\'t just read or copy-paste. Your fingers need to learn too.',
              'When something breaks, read the error message carefully before asking for help.',
              'Build small things: a calculator, a number guessing game, a quiz.',
              'Stuck for 20+ minutes? It\'s okay to look it up — but understand it, don\'t just copy it.',
            ]}
          />
        </div>
      </SectionCard>

      {/* ── Section 8: Daily learning note ── */}
      <SectionCard color="#14b8a6" emoji="📓" title="8 · How to Use Your Daily Learning Note">
        <p className="text-sm text-muted-foreground mb-3">
          Your Daily Reflection note is your <strong>most powerful study tool</strong>.
          It takes 5–8 minutes and is worth more than an extra hour of re-reading.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { emoji: '💡', label: 'What I Learned', tip: 'Write 2–3 real things you learned, in your own words. Not "I did math." But "I learned that you flip the fraction when dividing."' },
            { emoji: '❌', label: 'What I Got Wrong', tip: 'Write the question, your answer, and the real answer. This single habit improves test scores more than almost anything else.' },
            { emoji: '❓', label: 'What Confused Me', tip: 'Specific confusion is useful. "I don\'t understand fractions" = too vague. "I don\'t get why you flip the fraction in division" = fixable.' },
            { emoji: '📈', label: 'What I Improved', tip: 'Find at least one thing you did better than yesterday. Even tiny wins count. Your brain needs to see progress to stay motivated.' },
            { emoji: '🔁', label: 'Review Tomorrow', tip: 'Write 1–3 specific things to check tomorrow. This creates a built-in spaced repetition system — for free.' },
          ].map(({ emoji, label, tip }) => (
            <div key={label} className="rounded-xl p-3.5" style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.16)' }}>
              <p className="text-sm font-bold mb-1">{emoji} {label}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Section 9: Bad habits ── */}
      <SectionCard color="#ef4444" emoji="⚠️" title="9 · Bad Study Habits to Avoid">
        <div className="space-y-2">
          {[
            { bad: 'Re-reading your notes passively', why: 'It feels like studying but almost nothing sticks. Quiz yourself instead.' },
            { bad: 'Cramming the night before a test', why: 'You\'ll forget 70% within 48 hours. Short daily sessions beat one long panic session every time.' },
            { bad: 'Studying with your phone next to you', why: 'Every time you check it — even for 10 seconds — your brain needs 5+ minutes to fully refocus.' },
            { bad: 'Skipping review when you feel confident', why: '"I already know this" is when forgetting usually starts. Review easy things too, just faster.' },
            { bad: 'Giving up at the first hard problem', why: 'The difficulty is the learning. The first time something is hard is when your brain is actually building the memory.' },
            { bad: 'Highlighting everything', why: 'If everything is highlighted, nothing stands out. Highlight only the 1–2 key ideas per paragraph.' },
          ].map(({ bad, why }) => (
            <div key={bad} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.14)' }}>
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-semibold text-red-300">{bad}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{why}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Section 10: Daily checklist ── */}
      <SectionCard color="#6366f1" emoji="✅" title="10 · Your Daily Study Checklist">
        <p className="text-sm text-muted-foreground mb-4">
          Tick these off every study day. You don&apos;t need to be perfect — aim for <strong>6 out of 8</strong>.
        </p>
        <div className="space-y-2">
          {CHECKLIST.map(({ id, label }) => {
            const done = checked.has(id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all',
                  done
                    ? 'text-emerald-300'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                style={
                  done
                    ? { background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)' }
                    : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }
                }
              >
                {done
                  ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                  : <Circle className="w-5 h-5 shrink-0 opacity-40" />}
                <span className={cn('text-sm font-medium', done && 'line-through opacity-70')}>{label}</span>
              </button>
            )
          })}
        </div>
        {doneCount > 0 && (
          <div className="mt-4 flex items-center justify-between px-2">
            <p className="text-xs text-muted-foreground">
              {doneCount} / {CHECKLIST.length} done
              {doneCount >= 6 ? ' — 🎉 Great session!' : doneCount >= 4 ? ' — Keep going!' : ''}
            </p>
            <button
              type="button"
              onClick={() => setChecked(new Set())}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>
        )}
      </SectionCard>

      {/* ── Section 11: Weekly review ── */}
      <SectionCard color="#a855f7" emoji="📅" title="11 · Weekly Review (Sunday or Weekend)">
        <p className="text-sm text-muted-foreground mb-3">
          Once a week, spend <strong>20–30 minutes</strong> doing this review. It cements everything from the past 5 days.
        </p>
        <div className="space-y-2">
          {[
            { time: '5 min', action: 'Look at every "What I Got Wrong" from your daily notes this week. Try to answer each one now without looking.' },
            { time: '5 min', action: 'Flip through the self-check quiz questions you wrote in your daily notes. Cover the answers and test yourself.' },
            { time: '5 min', action: 'Read your "Concepts I Don\'t Fully Understand" list. Is there anything you now understand better? Cross it off.' },
            { time: '5 min', action: 'Write 3 things you got noticeably better at this week. Doesn\'t matter how small — write them anyway.' },
            { time: '5 min', action: 'Plan next week: what do you want to focus on? Is there a test coming? A subject that needs more time?' },
          ].map(({ time, action }) => (
            <div key={action.slice(0, 20)} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.14)' }}>
              <Pill color="#a855f7">{time}</Pill>
              <p className="text-sm text-muted-foreground leading-relaxed">{action}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Section 12: Motivation ── */}
      <div
        className="rounded-3xl p-6 sm:p-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(16,185,129,0.08))',
          border: '1px solid rgba(99,102,241,0.22)',
        }}
      >
        <div className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #34d399, transparent)' }} />

        <div className="flex items-start gap-3 mb-4">
          <Heart className="w-5 h-5 mt-0.5 text-rose-400 shrink-0" />
          <h2 className="text-base font-bold text-muted-foreground uppercase tracking-wide">A Real Talk from Your Coach</h2>
        </div>

        <div className="space-y-3 text-sm leading-relaxed">
          <p>
            You&apos;re not going to become a great student overnight. No one does.
            But here&apos;s the thing — <strong>you don&apos;t have to be great. You just have to be slightly better than yesterday.</strong>
          </p>
          <p className="text-muted-foreground">
            Some days you&apos;ll be distracted. Some days a problem will make zero sense.
            Some days you&apos;ll feel like everyone else gets it and you don&apos;t.
            That&apos;s not a sign you&apos;re bad at this — that&apos;s a normal Tuesday in 7th grade.
          </p>
          <p>
            What separates students who improve from students who stay stuck isn&apos;t talent.
            It&apos;s <strong>showing up the next day anyway</strong> — even when it&apos;s annoying, even when you&apos;re tired,
            even when you only have 20 minutes.
          </p>
          <p className="text-muted-foreground">
            Twenty minutes of real focus every day adds up to <strong>over 120 hours</strong> by the end of 7th grade.
            That&apos;s more than most students study in an entire year.
          </p>
          <p
            className="font-bold text-base mt-2"
            style={{ background: 'linear-gradient(90deg, #a78bfa, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            You can do this. One day at a time.
          </p>
        </div>

        <div className="mt-5 flex gap-2 flex-wrap">
          <Pill color="#6366f1">Try.</Pill>
          <Pill color="#8b5cf6">Notice mistakes.</Pill>
          <Pill color="#a855f7">Ask why.</Pill>
          <Pill color="#10b981">Fix one thing.</Pill>
          <Pill color="#0ea5e9">Review a little.</Pill>
          <Pill color="#34d399">Come back tomorrow.</Pill>
        </div>
      </div>

    </div>
  )
}
