'use client'

import { useState } from 'react'
import { Brain, GitBranch, Lightbulb, BookOpen, Loader2, Sparkles, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NoteMindMapNode, NoteReasoningHint, NoteKnowledgePoint } from '@/hooks/useNotes'

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

// ── Mind Map Tree ─────────────────────────────────────────────────────────────
function MindMapNode({ node, depth = 0 }: { node: NoteMindMapNode; depth?: number }) {
  const colors = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd']
  const color = colors[Math.min(depth, colors.length - 1)]
  const isRoot = depth === 0

  return (
    <li className="list-none">
      <span
        className="inline-block rounded-lg font-semibold transition-all"
        style={{
          background: isRoot ? `linear-gradient(135deg, #6366f1, #8b5cf6)` : `${color}18`,
          color: isRoot ? 'white' : color,
          border: isRoot ? 'none' : `1px solid ${color}40`,
          padding: isRoot ? '6px 18px' : depth === 1 ? '4px 12px' : '3px 10px',
          fontSize: isRoot ? '14px' : depth === 1 ? '13px' : '12px',
          boxShadow: isRoot ? `0 0 20px ${color}40` : 'none',
        }}
      >
        {node.label}
      </span>
      {node.children && node.children.length > 0 && (
        <ul className="ml-4 mt-2 space-y-2 border-l-2 pl-4" style={{ borderColor: `${color}30` }}>
          {node.children.map((child, i) => (
            <MindMapNode key={i} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
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
  const [activeTab, setActiveTab] = useState<'mindmap' | 'reasoning' | 'concepts' | 'tutor'>('mindmap')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
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
    try {
      const res = await fetch(`/api/notes/${noteId}/analyze`, { method: 'POST' })
      const json = await res.json() as {
        success: boolean
        data?: { mindMap: string; reasoningHints: string; knowledgePoints: string; tutorSummary: string; aiAnalyzedAt: string }
      }
      if (json.success && json.data) {
        setLocalMindMap(json.data.mindMap)
        setLocalHints(json.data.reasoningHints)
        setLocalConcepts(json.data.knowledgePoints)
        setLocalSummary(json.data.tutorSummary)
        setLocalAnalyzedAt(json.data.aiAnalyzedAt)
        onAnalyze?.()
      }
    } finally {
      setIsAnalyzing(false)
    }
  }

  const publishNote = async () => {
    setIsPublishing(true)
    try {
      const res = await fetch(`/api/notes/${noteId}/publish`, { method: 'POST' })
      const json = await res.json() as { success: boolean; data?: { url: string } }
      if (json.success && json.data) {
        setPublishedUrl(json.data.url)
      }
    } finally {
      setIsPublishing(false)
    }
  }

  const parsedMindMap = (() => { try { return JSON.parse(localMindMap ?? '') as NoteMindMapNode } catch { return null } })()
  const parsedHints = (() => { try { return JSON.parse(localHints ?? '') as NoteReasoningHint[] } catch { return [] } })()
  const parsedConcepts = (() => { try { return JSON.parse(localConcepts ?? '') as NoteKnowledgePoint[] } catch { return [] } })()

  const importanceColor = { core: '#6366f1', supporting: '#10b981', context: '#f59e0b' }

  const TABS = [
    { id: 'mindmap' as const, label: 'Mind Map', icon: GitBranch, count: parsedMindMap ? '✓' : null },
    { id: 'reasoning' as const, label: 'Reasoning', icon: Lightbulb, count: parsedHints.length || null },
    { id: 'concepts' as const, label: 'Key Concepts', icon: BookOpen, count: parsedConcepts.length || null },
    { id: 'tutor' as const, label: 'Tutor Notes', icon: Brain, count: localSummary ? '✓' : null },
  ]

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.18)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid rgba(99,102,241,0.12)', background: 'rgba(99,102,241,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">AI Expert Tutor Analysis</span>
          {localAnalyzedAt && (
            <span className="text-[10px] text-muted-foreground">
              · {new Date(localAnalyzedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {publishedUrl ? (
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}
            >
              <ExternalLink className="w-3 h-3" /> View Page
            </a>
          ) : (
            <button
              onClick={publishNote}
              disabled={isPublishing}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              {isPublishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
              {isPublishing ? 'Publishing…' : 'Publish Page'}
            </button>
          )}
          <button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}
          >
            {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {isAnalyzing ? 'Analyzing…' : hasAnalysis ? 'Re-analyze' : 'Analyze Note'}
          </button>
        </div>
      </div>

      {!hasAnalysis && !isAnalyzing ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
          <div className="text-4xl">🧠</div>
          <p className="font-semibold">Get expert tutor insights</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Click <strong>Analyze Note</strong> to generate a mind map, reasoning steps, key concepts, and tutor summary — all powered by AI.
          </p>
        </div>
      ) : isAnalyzing ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">AI is analyzing your note…</p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex px-4 pt-3 gap-1 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap transition-all',
                  activeTab === id
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                style={activeTab === id ? { background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' } : {}}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {count !== null && (
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
            {/* Mind Map */}
            {activeTab === 'mindmap' && (
              parsedMindMap ? (
                <ul className="space-y-3">
                  <MindMapNode node={parsedMindMap} depth={0} />
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No mind map data available.</p>
              )
            )}

            {/* Reasoning Steps */}
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

            {/* Key Concepts */}
            {activeTab === 'concepts' && (
              parsedConcepts.length > 0 ? (
                <div className="space-y-3">
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

            {/* Tutor Summary */}
            {activeTab === 'tutor' && (
              localSummary ? (
                <div
                  className="prose prose-sm prose-invert max-w-none text-sm text-muted-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: localSummary }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No tutor summary available.</p>
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}
