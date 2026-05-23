'use client'

import { useState, useRef, useEffect } from 'react'
import { Brain, GitBranch, Lightbulb, BookOpen, Loader2, Sparkles, ExternalLink, Compass, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NoteMindMapNode, NoteReasoningHint, NoteKnowledgePoint } from '@/hooks/useNotes'
import { MODELS, DEFAULT_MODEL_ID } from '@/lib/ai/models'

// All selectable models for analysis (all 10 — auto-fallback handles unavailable ones)
const ANALYZE_MODELS = MODELS

interface NoteAnalysisProps {
  noteId: string
  mindMap: string | null | undefined
  reasoningHints: string | null | undefined
  knowledgePoints: string | null | undefined
  tutorSummary: string | null | undefined
  aiAnalyzedAt: string | null | undefined
  publishedSlug: string | null | undefined
  onAnalyze?: () => void
}

// ── SVG Radial Mind Map ────────────────────────────────────────────────────────

const BRANCH_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9',
  '#8b5cf6', '#f43f5e', '#14b8a6', '#f97316', '#84cc16',
]

interface MindMapNode {
  label: string
  children?: MindMapNode[]
}

interface LayoutNode {
  label: string
  x: number
  y: number
  color: string
  depth: number
  isRoot?: boolean
}

interface LayoutEdge {
  x1: number; y1: number
  x2: number; y2: number
  color: string
  cx1: number; cy1: number
  cx2: number; cy2: number
}

function buildLayout(root: MindMapNode): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const nodes: LayoutNode[] = []
  const edges: LayoutEdge[] = []

  const CX = 320
  const CY = 260
  const R1 = 150  // radius level 1
  const R2 = 270  // radius level 2

  nodes.push({ label: root.label, x: CX, y: CY, color: '#6366f1', depth: 0, isRoot: true })

  const children1 = root.children ?? []
  const count1 = children1.length || 1

  children1.forEach((child1, i1) => {
    const angle1 = (2 * Math.PI * i1) / count1 - Math.PI / 2
    const x1 = CX + R1 * Math.cos(angle1)
    const y1 = CY + R1 * Math.sin(angle1)
    const color = BRANCH_COLORS[i1 % BRANCH_COLORS.length]

    nodes.push({ label: child1.label, x: x1, y: y1, color, depth: 1 })

    // Bezier edge from root → level 1
    const cx1 = CX + (R1 * 0.4) * Math.cos(angle1)
    const cy1 = CY + (R1 * 0.4) * Math.sin(angle1)
    edges.push({ x1: CX, y1: CY, x2: x1, y2: y1, color, cx1, cy1, cx2: x1, cy2: y1 })

    const children2 = child1.children ?? []
    const count2 = children2.length || 1

    children2.forEach((child2, i2) => {
      // Spread child-2 nodes around their parent, biased away from center
      const spread = Math.min(Math.PI * 0.6, (Math.PI * 0.8) / count2)
      const baseAngle = angle1
      const startAngle = baseAngle - (spread * (count2 - 1)) / 2
      const angle2 = startAngle + spread * i2

      const x2 = CX + R2 * Math.cos(angle2)
      const y2 = CY + R2 * Math.sin(angle2)

      nodes.push({ label: child2.label, x: x2, y: y2, color, depth: 2 })

      // Bezier edge from level 1 → level 2
      const mx = (x1 + x2) / 2
      const my = (y1 + y2) / 2
      edges.push({ x1, y1: y1, x2, y2, color, cx1: mx, cy1: my, cx2: mx, cy2: my })
    })
  })

  return { nodes, edges }
}

function truncate(s: string, max = 18): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function RadialMindMap({ root }: { root: MindMapNode }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const { nodes, edges } = buildLayout(root)
  const svgRef = useRef<SVGSVGElement>(null)

  return (
    <div className="w-full overflow-x-auto rounded-xl" style={{ background: 'rgba(0,0,0,0.2)' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 640 520"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', minWidth: '400px', maxWidth: '640px', display: 'block', margin: '0 auto' }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-strong">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background subtle grid */}
        <circle cx="320" cy="260" r="150" fill="none" stroke="rgba(99,102,241,0.06)" strokeWidth="1" strokeDasharray="4,8" />
        <circle cx="320" cy="260" r="270" fill="none" stroke="rgba(99,102,241,0.04)" strokeWidth="1" strokeDasharray="4,10" />

        {/* Edges */}
        {edges.map((e, i) => (
          <path
            key={i}
            d={`M ${e.x1} ${e.y1} C ${e.cx1} ${e.cy1}, ${e.cx2} ${e.cy2}, ${e.x2} ${e.y2}`}
            fill="none"
            stroke={e.color}
            strokeWidth="1.5"
            strokeOpacity="0.4"
          />
        ))}

        {/* Nodes */}
        {nodes.map((n, i) => {
          const isRoot = n.isRoot
          const isHovered = hovered === `${n.x},${n.y}`
          const rx = isRoot ? 48 : n.depth === 1 ? 38 : 32
          const ry = isRoot ? 18 : n.depth === 1 ? 14 : 12
          const label = truncate(n.label, isRoot ? 22 : n.depth === 1 ? 16 : 14)
          const fontSize = isRoot ? 12 : n.depth === 1 ? 10 : 9

          return (
            <g
              key={i}
              onMouseEnter={() => setHovered(`${n.x},${n.y}`)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'default' }}
            >
              {/* Glow effect */}
              {(isRoot || isHovered) && (
                <ellipse
                  cx={n.x}
                  cy={n.y}
                  rx={rx + 6}
                  ry={ry + 6}
                  fill={n.color}
                  opacity="0.15"
                  filter="url(#glow)"
                />
              )}
              <ellipse
                cx={n.x}
                cy={n.y}
                rx={rx}
                ry={ry}
                fill={isRoot ? `url(#root-grad)` : `${n.color}18`}
                stroke={n.color}
                strokeWidth={isRoot ? 0 : 1}
                strokeOpacity={isHovered ? 0.9 : 0.5}
              />
              {isRoot && (
                <defs>
                  <linearGradient id="root-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              )}
              <text
                x={n.x}
                y={n.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize}
                fontWeight={isRoot ? '800' : n.depth === 1 ? '700' : '500'}
                fill={isRoot ? 'white' : n.color}
                fontFamily="system-ui, sans-serif"
              >
                {label}
              </text>
            </g>
          )
        })}

        {/* Hover tooltip */}
        {hovered && (() => {
          const n = nodes.find((nd) => `${nd.x},${nd.y}` === hovered)
          if (!n || n.label.length <= 18) return null
          return (
            <g>
              <rect
                x={n.x - 90}
                y={n.y - 40}
                width={180}
                height={26}
                rx={6}
                fill="#1a1a2e"
                stroke={n.color}
                strokeWidth="1"
                strokeOpacity="0.5"
              />
              <text
                x={n.x}
                y={n.y - 27}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10}
                fill="white"
                fontFamily="system-ui, sans-serif"
              >
                {n.label}
              </text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}

// ── Study Recommendations ─────────────────────────────────────────────────────

function StudyRecommendations({ concepts, hints }: {
  concepts: NoteKnowledgePoint[]
  hints: NoteReasoningHint[]
}) {
  // Derive recommendations from concepts and hints
  const coreCount = concepts.filter((c) => c.importance === 'core').length
  const supportCount = concepts.filter((c) => c.importance === 'supporting').length
  const weakAreas = concepts.filter((c) => c.importance === 'context').map((c) => c.term)

  const tips = [
    coreCount > 0 && {
      emoji: '🎯',
      title: 'Master the core concepts first',
      body: `Focus on the ${coreCount} core concept${coreCount !== 1 ? 's' : ''} before moving on. These are the foundation everything else builds on.`,
      color: '#6366f1',
    },
    supportCount > 0 && {
      emoji: '🔗',
      title: 'Build supporting knowledge',
      body: `There are ${supportCount} supporting ideas that connect the core concepts. Understanding these will deepen your grasp significantly.`,
      color: '#10b981',
    },
    hints.length > 2 && {
      emoji: '📝',
      title: 'Practice the reasoning steps',
      body: `Try to reproduce the ${hints.length} reasoning steps without looking. If you can explain each step, you truly understand the topic.`,
      color: '#f59e0b',
    },
    weakAreas.length > 0 && {
      emoji: '🔍',
      title: 'Explore context topics',
      body: `Look deeper into: ${weakAreas.slice(0, 3).join(', ')}${weakAreas.length > 3 ? ', and more' : ''}. These form the wider context for this subject.`,
      color: '#ec4899',
    },
    {
      emoji: '🃏',
      title: 'Make flashcards from key concepts',
      body: 'The best way to lock in what you learned is spaced repetition. Turn each key concept into a flashcard and review them over the next few days.',
      color: '#8b5cf6',
    },
    {
      emoji: '🗣️',
      title: 'Teach it back',
      body: `Try explaining this topic out loud as if you were teaching someone else. The Feynman Technique is one of the most powerful study methods.`,
      color: '#0ea5e9',
    },
  ].filter(Boolean) as Array<{ emoji: string; title: string; body: string; color: string }>

  if (tips.length === 0) {
    return <p className="text-sm text-muted-foreground">Run the analysis to get personalised study recommendations.</p>
  }

  return (
    <div className="space-y-3">
      {tips.map((tip, i) => (
        <div
          key={i}
          className="rounded-xl p-4"
          style={{ background: `${tip.color}08`, border: `1px solid ${tip.color}20` }}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl leading-none mt-0.5">{tip.emoji}</span>
            <div>
              <p className="text-sm font-bold mb-1" style={{ color: tip.color }}>{tip.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{tip.body}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function NoteAnalysis({
  noteId,
  mindMap,
  reasoningHints,
  knowledgePoints,
  tutorSummary,
  aiAnalyzedAt,
  publishedSlug,
  onAnalyze,
}: NoteAnalysisProps) {
  const [activeTab, setActiveTab] = useState<'mindmap' | 'reasoning' | 'concepts' | 'tutor' | 'study'>('mindmap')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID)
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const modelPickerRef = useRef<HTMLDivElement>(null)

  // Close model picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setModelPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const [publishedUrl, setPublishedUrl] = useState<string | null>(
    publishedSlug ? `/notes/view/${publishedSlug}` : null
  )
  const [localMindMap, setLocalMindMap] = useState(mindMap)
  const [localHints, setLocalHints] = useState(reasoningHints)
  const [localConcepts, setLocalConcepts] = useState(knowledgePoints)
  const [localSummary, setLocalSummary] = useState(tutorSummary)
  const [localAnalyzedAt, setLocalAnalyzedAt] = useState(aiAnalyzedAt)

  const hasAnalysis = !!(localMindMap || localHints || localConcepts || localSummary)

  const runAnalysis = async () => {
    setIsAnalyzing(true)
    setError(null)
    try {
      const res = await fetch(`/api/notes/${noteId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel }),
      })
      const json = await res.json() as {
        success: boolean
        error?: string
        data?: { mindMap: string; reasoningHints: string; knowledgePoints: string; tutorSummary: string; aiAnalyzedAt: string }
      }
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Analysis failed')
      }
      if (json.success && json.data) {
        setLocalMindMap(json.data.mindMap)
        setLocalHints(json.data.reasoningHints)
        setLocalConcepts(json.data.knowledgePoints)
        setLocalSummary(json.data.tutorSummary)
        setLocalAnalyzedAt(json.data.aiAnalyzedAt)
        onAnalyze?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const publishNote = async () => {
    setIsPublishing(true)
    setError(null)
    try {
      const res = await fetch(`/api/notes/${noteId}/publish`, { method: 'POST' })
      const json = await res.json() as { success: boolean; error?: string; data?: { url: string } }
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Publish failed')
      }
      if (json.success && json.data) {
        setPublishedUrl(json.data.url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setIsPublishing(false)
    }
  }

  const parsedMindMap = (() => { try { return JSON.parse(localMindMap ?? '') as NoteMindMapNode } catch { return null } })()
  const parsedHints = (() => { try { return JSON.parse(localHints ?? '') as NoteReasoningHint[] } catch { return [] } })()
  const parsedConcepts = (() => { try { return JSON.parse(localConcepts ?? '') as NoteKnowledgePoint[] } catch { return [] } })()

  const importanceColor: Record<string, string> = { core: '#6366f1', supporting: '#10b981', context: '#f59e0b' }

  const TABS = [
    { id: 'mindmap' as const, label: 'Mind Map', icon: GitBranch },
    { id: 'reasoning' as const, label: 'Reasoning', icon: Lightbulb, count: parsedHints.length || null },
    { id: 'concepts' as const, label: 'Key Concepts', icon: BookOpen, count: parsedConcepts.length || null },
    { id: 'tutor' as const, label: 'Tutor Notes', icon: Brain },
    { id: 'study' as const, label: 'Study Plan', icon: Compass },
  ]

  return (
    <div
      className="rounded-2xl"
      style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.18)' }}
    >
      {/* Header — row 1: title + publish */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid rgba(99,102,241,0.08)', background: 'rgba(99,102,241,0.06)' }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="font-bold text-xs truncate">AI Expert Tutor</span>
          {localAnalyzedAt && (
            <span className="text-[9px] text-muted-foreground shrink-0">
              · {new Date(localAnalyzedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        {publishedUrl ? (
          <a
            href={publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors shrink-0"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}
          >
            <ExternalLink className="w-2.5 h-2.5" /> View Page
          </a>
        ) : (
          <button
            onClick={publishNote}
            disabled={isPublishing}
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors disabled:opacity-50 shrink-0"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}
          >
            {isPublishing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <ExternalLink className="w-2.5 h-2.5" />}
            {isPublishing ? 'Publishing…' : 'Publish'}
          </button>
        )}
      </div>

      {/* Header — row 2: model picker + analyze */}
      <div
        className="flex items-center gap-2 px-4 py-2"
        style={{ borderBottom: '1px solid rgba(99,102,241,0.12)', background: 'rgba(99,102,241,0.04)' }}
      >
        {/* Model picker + Analyze button grouped */}
        <div className="flex items-center flex-1 rounded-lg" style={{ border: '1px solid rgba(99,102,241,0.25)' }}>
          {/* Model selector trigger */}
          <div className="relative flex-1" ref={modelPickerRef}>
            <button
              onClick={() => setModelPickerOpen((o) => !o)}
              disabled={isAnalyzing}
              className="w-full flex items-center gap-1 text-[10px] font-semibold px-2 py-1.5 rounded-l-lg transition-colors disabled:opacity-50"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', borderRight: '1px solid rgba(99,102,241,0.2)' }}
              title="Select model for analysis"
            >
              <span className="flex-1 truncate text-left">{ANALYZE_MODELS.find((m) => m.id === selectedModel)?.name ?? 'Model'}</span>
                <ChevronDown
                  className="w-3 h-3 shrink-0 transition-transform duration-150"
                  style={{ transform: modelPickerOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>
              {modelPickerOpen && (
                <div
                  className="absolute left-0 top-full mt-1 z-[100] rounded-xl overflow-hidden shadow-2xl min-w-[220px]"
                  style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.3)' }}
                >
                  <div className="p-2 space-y-0.5">
                    {ANALYZE_MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setSelectedModel(m.id); setModelPickerOpen(false) }}
                        className={cn(
                          'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors',
                          selectedModel === m.id
                            ? 'text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]'
                        )}
                        style={selectedModel === m.id ? { background: 'rgba(99,102,241,0.15)' } : {}}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{m.name}</p>
                          <p className="text-[10px] opacity-60">{m.providerLabel}</p>
                        </div>
                        {m.isFree && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981' }}>FREE</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="px-3 py-2 text-[9px] text-muted-foreground/50" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    Auto-fallback to next model if this one is unavailable
                  </div>
                </div>
              )}
            </div>{/* end relative model picker */}
            {/* Analyze button */}
            <button
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-r-lg transition-colors disabled:opacity-50 shrink-0"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}
            >
              {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {isAnalyzing ? 'Analyzing…' : hasAnalysis ? 'Re-analyze' : 'Analyze'}
            </button>
          </div>{/* end model+analyze group */}
      </div>{/* end header row 2 */}

      {error && (
        <div className="mx-5 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200">
          {error}
        </div>
      )}

      {!hasAnalysis && !isAnalyzing ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
          <div className="text-4xl">🧠</div>
          <p className="font-semibold">Get expert tutor insights</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Click <strong>Analyze Note</strong> to generate a visual mind map, reasoning steps, key concepts, and a personalised study plan — all powered by AI.
          </p>
        </div>
      ) : isAnalyzing ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="relative">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div className="absolute inset-0 rounded-full animate-ping"
              style={{ background: 'rgba(99,102,241,0.15)', animationDuration: '1.5s' }} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm">AI is analyzing your note…</p>
            <p className="text-xs text-muted-foreground mt-1">Building mind map, extracting concepts, drafting study plan</p>
          </div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex px-4 pt-3 gap-1 overflow-x-auto" style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
            {TABS.map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-t-lg whitespace-nowrap transition-all mb-0',
                  activeTab === id
                    ? 'text-primary border-b-2'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                style={activeTab === id
                  ? { borderBottomColor: '#6366f1', background: 'rgba(99,102,241,0.08)' }
                  : {}}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {count != null && (
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">

            {/* ── Mind Map (SVG radial) ── */}
            {activeTab === 'mindmap' && (
              parsedMindMap ? (
                <div>
                  <RadialMindMap root={parsedMindMap} />
                  <p className="text-[10px] text-muted-foreground text-center mt-2">
                    Hover over nodes to see full labels
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No mind map data available.</p>
              )
            )}

            {/* ── Reasoning Steps ── */}
            {activeTab === 'reasoning' && (
              parsedHints.length > 0 ? (
                <div className="space-y-3">
                  {parsedHints.map((h) => (
                    <div key={h.step} className="flex gap-3 items-start">
                      <span
                        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 10px rgba(99,102,241,0.4)' }}
                      >
                        {h.step}
                      </span>
                      <p className="text-sm text-muted-foreground leading-relaxed pt-0.5">{h.hint}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No reasoning hints available.</p>
              )
            )}

            {/* ── Key Concepts ── */}
            {activeTab === 'concepts' && (
              parsedConcepts.length > 0 ? (
                <div className="space-y-3">
                  {/* Legend */}
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    {(['core', 'supporting', 'context'] as const).map((imp) => (
                      <span key={imp} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: importanceColor[imp] }} />
                        {imp}
                      </span>
                    ))}
                  </div>
                  {parsedConcepts.map((kp, i) => {
                    const color = importanceColor[kp.importance] ?? '#6366f1'
                    return (
                      <div
                        key={i}
                        className="rounded-xl p-3"
                        style={{ background: `${color}10`, border: `1px solid ${color}25` }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold" style={{ color }}>{kp.term}</span>
                          <span
                            className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                            style={{ background: `${color}20`, color }}
                          >
                            {kp.importance}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{kp.definition}</p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No key concepts available.</p>
              )
            )}

            {/* ── Tutor Summary ── */}
            {activeTab === 'tutor' && (
              localSummary ? (
                <div
                  className="prose prose-sm prose-invert max-w-none text-sm text-muted-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: localSummary }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Run the analysis to get a tutor summary.</p>
              )
            )}

            {/* ── Study Plan ── */}
            {activeTab === 'study' && (
              <StudyRecommendations
                hints={parsedHints}
                concepts={parsedConcepts}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
