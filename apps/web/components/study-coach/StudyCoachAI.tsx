'use client'

import { useState } from 'react'
import {
  Sparkles, Loader2, AlertCircle, ArrowRightLeft,
  Plus, X, Send, BookOpen, Code2, Languages,
  Brain, Rocket, FlaskConical, Trophy, Calculator,
} from 'lucide-react'
import { MODELS, DEFAULT_MODEL_ID } from '@/lib/ai/models'
import { MarkdownRenderer } from '@/components/notes/MarkdownRenderer'
import { cn } from '@/lib/utils'

// ── Study Coach system prompt ────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Coach Bloom — a friendly, expert AI study coach for a 12-year-old rising 7th grader.

Your specialties:
• Math & Logic Reasoning: step-by-step problem solving, competition math (AMC 8), fractions, geometry, algebra basics, pattern recognition, logical proofs
• Writing & Language Arts: essay structure, strong paragraphs, thesis statements, descriptive language, grammar, editing strategies
• Word Memory & Vocabulary: spaced repetition techniques, etymology tricks, memory hooks, using new words in sentences
• Resilience, Consistency & Excellence: growth mindset, bouncing back from mistakes, building study habits, dealing with frustration and confusion
• Coding & Technology: Python basics, algorithms, debugging mindset, what programs really do, AI fundamentals
• STEM & Science: scientific thinking, hypotheses, data interpretation, math in real life
• Robotics, Automation & AI: how robots work, sensors and motors, control logic, machine learning basics, real-world AI applications

How you answer every question:
1. Use simple, clear language a 12-year-old can understand — no jargon without explanation
2. Use real examples from everyday middle-school life (video games, sports, school projects, cooking, etc.)
3. For math problems: show every step clearly, explain WHY each step works, not just HOW
4. For coding: give short working code examples with comments
5. For mindset questions: be honest and realistic — not fake-cheerful, but genuinely encouraging
6. Keep answers focused — detailed enough to actually help, short enough to stay readable
7. Always end with either: a follow-up question to keep the student thinking, OR a 1-sentence encouragement
8. If a student seems frustrated or confused, acknowledge it first before explaining`

// ── Skill topic quick-picks ──────────────────────────────────────────────────
const SKILL_TOPICS = [
  {
    id: 'math',
    icon: Calculator,
    label: 'Math Logic',
    color: '#6366f1',
    starter: 'Walk me step-by-step through how to solve this type of math problem:\n\n',
  },
  {
    id: 'writing',
    icon: BookOpen,
    label: 'Writing',
    color: '#10b981',
    starter: 'Help me improve my writing. Here is what I need help with:\n\n',
  },
  {
    id: 'memory',
    icon: Brain,
    label: 'Word Memory',
    color: '#f59e0b',
    starter: 'Give me a memory trick to remember this word or concept:\n\n',
  },
  {
    id: 'coding',
    icon: Code2,
    label: 'Coding',
    color: '#14b8a6',
    starter: 'Explain this coding concept in simple terms with a short example:\n\n',
  },
  {
    id: 'robotics',
    icon: Rocket,
    label: 'Robotics & AI',
    color: '#a855f7',
    starter: 'Explain how this works in robotics or AI in a way a 7th grader can understand:\n\n',
  },
  {
    id: 'stem',
    icon: FlaskConical,
    label: 'STEM',
    color: '#0ea5e9',
    starter: 'Help me understand this science or STEM concept with a real-life example:\n\n',
  },
  {
    id: 'mindset',
    icon: Trophy,
    label: 'Mindset & Resilience',
    color: '#ec4899',
    starter: "I'm feeling stuck/frustrated and need real advice on how to keep going. Here's what's happening:\n\n",
  },
  {
    id: 'language',
    icon: Languages,
    label: 'Language Learning',
    color: '#f97316',
    starter: 'Help me get better at language learning. My question is:\n\n',
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
interface SideResult {
  requested: string
  usedModel: string
  content: string
  tokens: number
  ms: number
  error: string | null
}

function ModelSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="flex-1 min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'inherit' }}
      >
        {MODELS.map((m) => (
          <option key={m.id} value={m.id}
            style={{ backgroundColor: '#0d1117', color: '#e2e8f0' }}>
            {m.name} · {m.providerLabel}{m.badge ? ` · ${m.badge}` : ''}{m.isFree ? ' · Free' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

function OutputCard({ side, result, loading, color }: { side: string; result: SideResult | null; loading: boolean; color: string }) {
  const meta = result ? MODELS.find((m) => m.id === result.requested) : null
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col min-h-[180px]"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2 px-4 py-2.5"
        style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta?.providerColor ?? color }} />
        <span className="font-bold text-xs truncate">{meta?.name ?? side}</span>
        {meta && <span className="text-[10px] text-muted-foreground">{meta.providerLabel}</span>}
        {result && !result.error && (
          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
            {(result.ms / 1000).toFixed(1)}s · {result.tokens} tok
          </span>
        )}
      </div>
      <div className="p-4 flex-1">
        {loading ? (
          <div className="h-full flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Thinking…</span>
          </div>
        ) : result?.error ? (
          <div className="flex items-start gap-2 text-sm text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {result.error}
          </div>
        ) : result ? (
          <MarkdownRenderer content={result.content} />
        ) : (
          <p className="text-sm text-muted-foreground">Answer will appear here.</p>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function StudyCoachAI() {
  const defaultFreeModel = MODELS.find((m) => m.isFree)?.id ?? DEFAULT_MODEL_ID
  const [modelA, setModelA] = useState(DEFAULT_MODEL_ID)
  const [modelB, setModelB] = useState(defaultFreeModel !== DEFAULT_MODEL_ID ? defaultFreeModel : (MODELS.find((m) => m.id !== DEFAULT_MODEL_ID)?.id ?? MODELS[1].id))
  const [compare, setCompare] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [activeTopic, setActiveTopic] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState<{ a: SideResult; b: SideResult | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectTopic = (topic: typeof SKILL_TOPICS[0]) => {
    setActiveTopic(topic.id)
    if (!prompt.trim()) setPrompt(topic.starter)
  }

  const run = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true); setError(null); setRes(null)
    try {
      const r = await fetch('/api/tutor/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          compare
            ? { prompt: prompt.trim(), modelA, modelB, system: SYSTEM_PROMPT }
            : { prompt: prompt.trim(), modelA, system: SYSTEM_PROMPT }
        ),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error ?? 'Request failed')
      setRes({ a: data.a, b: data.b ?? null })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  const swap = () => { setModelA(modelB); setModelB(modelA) }
  const activeColor = SKILL_TOPICS.find((t) => t.id === activeTopic)?.color ?? '#6366f1'

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{ border: `1px solid ${activeColor}30`, background: `${activeColor}06` }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ background: `${activeColor}10`, borderBottom: `1px solid ${activeColor}20` }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${activeColor}, ${activeColor}99)`, boxShadow: `0 0 14px ${activeColor}50` }}
        >
          <Sparkles className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <p className="text-sm font-black">Coach Bloom AI</p>
          <p className="text-[11px] text-muted-foreground">Ask anything — math, coding, writing, mindset, robotics, STEM</p>
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* Skill topic buttons */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Choose a skill area</p>
          <div className="flex flex-wrap gap-2">
            {SKILL_TOPICS.map((topic) => {
              const Icon = topic.icon
              const active = activeTopic === topic.id
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => selectTopic(topic)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                    active ? 'text-white scale-105' : 'text-muted-foreground hover:text-foreground'
                  )}
                  style={
                    active
                      ? { background: `linear-gradient(135deg, ${topic.color}, ${topic.color}bb)`, boxShadow: `0 3px 12px ${topic.color}50`, border: `1px solid ${topic.color}` }
                      : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  {topic.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Prompt textarea */}
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run() }}
            rows={4}
            placeholder="Type your question here… (Ctrl/Cmd+Enter to ask)"
            className="w-full px-4 py-3 rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${activeTopic ? activeColor + '40' : 'rgba(255,255,255,0.08)'}`,
              color: 'inherit',
              '--tw-ring-color': activeColor,
            } as React.CSSProperties}
          />
        </div>

        {/* Model selector row */}
        <div className="flex items-end gap-2 flex-wrap">
          <ModelSelect value={modelA} onChange={setModelA} label={compare ? 'Model A' : 'Model'} />

          {compare ? (
            <>
              <button onClick={swap} title="Swap models"
                className="mb-0.5 p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
                <ArrowRightLeft className="w-4 h-4" />
              </button>
              <ModelSelect value={modelB} onChange={setModelB} label="Model B" />
              <button onClick={() => setCompare(false)} title="Remove second model"
                className="mb-0.5 p-2 rounded-xl text-muted-foreground hover:text-rose-400 transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button onClick={() => setCompare(true)}
              className="mb-0.5 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-all whitespace-nowrap"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <Plus className="w-3.5 h-3.5" /> Compare 2nd model
            </button>
          )}

          {/* Ask / Compare button */}
          <button
            onClick={run}
            disabled={!prompt.trim() || loading}
            className="mb-0.5 flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 hover:scale-105 whitespace-nowrap"
            style={{
              background: `linear-gradient(135deg, ${activeColor}, ${activeColor}bb)`,
              boxShadow: `0 4px 14px ${activeColor}40`,
            }}
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
            {compare ? 'Compare' : 'Ask Coach'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl text-sm text-rose-400"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {/* Output */}
        {(loading || res) && (
          <div className={cn('gap-3', compare ? 'grid md:grid-cols-2' : 'grid grid-cols-1')}>
            <OutputCard side="Model A" result={res?.a ?? null} loading={loading} color={activeColor} />
            {compare && <OutputCard side="Model B" result={res?.b ?? null} loading={loading} color={activeColor} />}
          </div>
        )}

        {!loading && !res && !error && (
          <div className="text-center py-6 text-muted-foreground">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Pick a skill area above, type your question, and hit <strong>Ask Coach</strong>.</p>
            <p className="text-xs mt-1 opacity-70">Add a second model anytime to compare how different AIs explain the same thing.</p>
          </div>
        )}
      </div>
    </div>
  )
}
