'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Loader2, GitBranch, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { GraphNode, GraphEdge, KnowledgeGraphData } from '@/app/api/knowledge-graph/route'

// ─── Layout types ─────────────────────────────────────────────────────────────

interface SimNode extends GraphNode {
  x: number
  y: number
  vx: number
  vy: number
  r: number   // visual radius
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WIDTH = 800
const HEIGHT = 560
const CX = WIDTH / 2
const CY = HEIGHT / 2

const MASTERY_COLOR = (score: number | null): string => {
  if (score === null) return '#6366f1'           // indigo — untracked
  if (score >= 0.85) return '#10b981'            // green  — mastered
  if (score >= 0.65) return '#3b82f6'            // blue   — proficient
  if (score >= 0.45) return '#f59e0b'            // amber  — developing
  return '#ef4444'                               // red    — learning
}

const MASTERY_LABEL = (score: number | null): string => {
  if (score === null) return 'No quiz data'
  if (score >= 0.85) return 'Mastered'
  if (score >= 0.65) return 'Proficient'
  if (score >= 0.45) return 'Developing'
  return 'Learning'
}

// ─── Force-directed simulation (pure TS, no external lib) ────────────────────

function initPositions(nodes: GraphNode[]): SimNode[] {
  return nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length
    const radius = 160 + Math.random() * 60
    return {
      ...n,
      x: CX + radius * Math.cos(angle),
      y: CY + radius * Math.sin(angle),
      vx: 0,
      vy: 0,
      r: nodeRadius(n),
    }
  })
}

function nodeRadius(n: GraphNode): number {
  const base = n.type === 'subject' ? 22 : 14
  return base + Math.min(n.noteCount * 1.5, 12)
}

function runSimulation(nodes: SimNode[], edges: GraphEdge[], iterations = 300): SimNode[] {
  const idxMap = new Map(nodes.map((n, i) => [n.id, i]))

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations  // cooling factor

    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const minDist = a.r + b.r + 30
        if (dist < minDist) {
          const force = (minDist - dist) / dist * 0.5
          a.vx -= dx * force
          a.vy -= dy * force
          b.vx += dx * force
          b.vy += dy * force
        }
      }
    }

    // Spring attraction along edges
    for (const edge of edges) {
      const ai = idxMap.get(edge.source)
      const bi = idxMap.get(edge.target)
      if (ai == null || bi == null) continue
      const a = nodes[ai]
      const b = nodes[bi]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const idealLen = 140 - Math.min(edge.weight * 4, 40)
      const force = (dist - idealLen) / dist * 0.08 * alpha
      a.vx += dx * force
      a.vy += dy * force
      b.vx -= dx * force
      b.vy -= dy * force
    }

    // Gravity toward centre
    for (const n of nodes) {
      n.vx += (CX - n.x) * 0.012 * alpha
      n.vy += (CY - n.y) * 0.012 * alpha
    }

    // Integrate + dampen
    for (const n of nodes) {
      n.vx *= 0.8
      n.vy *= 0.8
      n.x += n.vx
      n.y += n.vy
      // Clamp to canvas with node-radius padding
      n.x = Math.max(n.r + 8, Math.min(WIDTH - n.r - 8, n.x))
      n.y = Math.max(n.r + 8, Math.min(HEIGHT - n.r - 8, n.y))
    }
  }

  return nodes
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KnowledgeGraphPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rawData, setRawData] = useState<KnowledgeGraphData | null>(null)
  const [simNodes, setSimNodes] = useState<SimNode[]>([])
  const [hovered, setHovered] = useState<SimNode | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const buildGraph = useCallback((data: KnowledgeGraphData) => {
    const positioned = initPositions(data.nodes)
    const settled = runSimulation(positioned, data.edges, 400)
    setSimNodes([...settled])
  }, [])

  useEffect(() => {
    fetch('/api/knowledge-graph')
      .then((r) => r.json())
      .then(({ data, error: err }) => {
        if (err) { setError(err); return }
        setRawData(data)
        buildGraph(data)
      })
      .catch(() => setError('Failed to load knowledge graph'))
      .finally(() => setLoading(false))
  }, [buildGraph])

  const handleReshuffle = () => {
    if (!rawData) return
    buildGraph(rawData)
  }

  const nodeMap = new Map(simNodes.map((n) => [n.id, n]))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !rawData) {
    return <p className="text-destructive text-center py-12">{error || 'No data'}</p>
  }

  const isEmpty = rawData.nodes.length === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GitBranch className="w-7 h-7 text-primary" />
            Knowledge Graph
          </h1>
          <p className="text-muted-foreground mt-1">
            See how your subjects and topics connect — sized by note count, coloured by mastery.
          </p>
        </div>
        {!isEmpty && (
          <Button variant="outline" size="sm" onClick={handleReshuffle} className="shrink-0">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reshuffle
          </Button>
        )}
      </div>

      {isEmpty ? (
        <Card className="p-12 text-center space-y-3">
          <p className="text-4xl">🗺️</p>
          <p className="text-lg font-semibold">Your graph is empty</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Take notes with subjects and tags, or complete quizzes to start building your knowledge map.
          </p>
        </Card>
      ) : (
        <>
          {/* Graph canvas */}
          <Card className="p-2 overflow-hidden">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="w-full rounded-lg"
              style={{ background: 'hsl(var(--muted)/0.3)' }}
            >
              {/* Edge lines */}
              {rawData.edges.map((edge) => {
                const a = nodeMap.get(edge.source)
                const b = nodeMap.get(edge.target)
                if (!a || !b) return null
                const opacity = Math.min(0.15 + edge.weight * 0.08, 0.5)
                const strokeWidth = Math.min(1 + edge.weight * 0.4, 4)
                return (
                  <line
                    key={`${edge.source}-${edge.target}`}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="currentColor"
                    strokeOpacity={opacity}
                    strokeWidth={strokeWidth}
                    className="text-foreground"
                  />
                )
              })}

              {/* Nodes */}
              {simNodes.map((node) => {
                const color = MASTERY_COLOR(node.mastery)
                const isHovered = hovered?.id === node.id
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => {
                      setHovered(node)
                      const rect = svgRef.current?.getBoundingClientRect()
                      if (rect) {
                        const svgScale = rect.width / WIDTH
                        setTooltip({
                          x: node.x * svgScale,
                          y: node.y * svgScale,
                        })
                      }
                    }}
                    onMouseLeave={() => { setHovered(null); setTooltip(null) }}
                  >
                    {/* Glow ring on hover */}
                    {isHovered && (
                      <circle
                        r={node.r + 6}
                        fill={color}
                        opacity={0.2}
                      />
                    )}
                    {/* Main circle */}
                    <circle
                      r={node.r}
                      fill={color}
                      fillOpacity={node.type === 'tag' ? 0.6 : 0.85}
                      stroke={color}
                      strokeWidth={2}
                      strokeOpacity={0.9}
                    />
                    {/* Label */}
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="white"
                      fontSize={node.r > 20 ? 11 : 9}
                      fontWeight={node.type === 'subject' ? '700' : '400'}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {node.label.length > 10 ? node.label.slice(0, 9) + '…' : node.label}
                    </text>
                    {/* Note count badge (subject nodes only) */}
                    {node.type === 'subject' && node.noteCount > 0 && (
                      <text
                        y={node.r + 13}
                        textAnchor="middle"
                        fill="currentColor"
                        fontSize={9}
                        className="text-muted-foreground"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {node.noteCount} note{node.noteCount !== 1 ? 's' : ''}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>

            {/* Tooltip */}
            {hovered && tooltip && (
              <div
                className="absolute pointer-events-none z-10 bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-sm min-w-[140px]"
                style={{
                  left: tooltip.x + 16,
                  top: tooltip.y - 40,
                  transform: tooltip.x > 600 ? 'translateX(-110%)' : undefined,
                }}
              >
                <p className="font-semibold">{hovered.label}</p>
                <p className="text-muted-foreground text-xs capitalize">{hovered.type}</p>
                {hovered.noteCount > 0 && (
                  <p className="text-xs">{hovered.noteCount} note{hovered.noteCount !== 1 ? 's' : ''}</p>
                )}
                {hovered.mastery !== null && (
                  <p className="text-xs mt-1">
                    <span
                      className="font-medium"
                      style={{ color: MASTERY_COLOR(hovered.mastery) }}
                    >
                      {Math.round(hovered.mastery * 100)}% — {MASTERY_LABEL(hovered.mastery)}
                    </span>
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <Card className="p-4">
              <p className="text-2xl font-bold text-primary">
                {rawData.nodes.filter((n) => n.type === 'subject').length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Subjects</p>
            </Card>
            <Card className="p-4">
              <p className="text-2xl font-bold text-purple-500">
                {rawData.nodes.filter((n) => n.type === 'tag').length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Tag nodes</p>
            </Card>
            <Card className="p-4">
              <p className="text-2xl font-bold text-green-500">{rawData.edges.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Connections</p>
            </Card>
          </div>

          {/* Legend */}
          <Card className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Mastery colour legend
            </p>
            <div className="flex flex-wrap gap-4">
              {[
                { color: '#10b981', label: 'Mastered (≥85%)' },
                { color: '#3b82f6', label: 'Proficient (65–85%)' },
                { color: '#f59e0b', label: 'Developing (45–65%)' },
                { color: '#ef4444', label: 'Learning (<45%)' },
                { color: '#6366f1', label: 'No quiz data' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Node size = note count · Edge thickness = notes linking those topics · Tags shown as smaller nodes
            </p>
          </Card>
        </>
      )}
    </div>
  )
}
