import { NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export interface GraphNode {
  id: string
  label: string
  type: 'subject' | 'tag'
  noteCount: number
  mastery: number | null  // 0–1 if in LearningProfile, else null
}

export interface GraphEdge {
  source: string
  target: string
  weight: number  // number of notes that link the two nodes
}

export interface KnowledgeGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// GET /api/knowledge-graph
export async function GET() {
  try {
    const userId = DANIEL_USER_ID

    const [notes, learningProfile] = await Promise.all([
      db.note.findMany({
        where: { userId },
        select: { subject: true, tags: true },
      }),
      db.learningProfile.findUnique({
        where: { userId },
        select: { masteryScores: true },
      }),
    ])

    const masteryScores: Record<string, number> =
      learningProfile?.masteryScores &&
      typeof learningProfile.masteryScores === 'object' &&
      !Array.isArray(learningProfile.masteryScores)
        ? (learningProfile.masteryScores as Record<string, number>)
        : {}

    // ── Count notes per subject ──────────────────────────────────────────────
    const subjectCounts: Record<string, number> = {}
    const tagCounts: Record<string, number> = {}

    for (const note of notes) {
      if (note.subject) {
        subjectCounts[note.subject] = (subjectCounts[note.subject] ?? 0) + 1
      }
      for (const tag of note.tags) {
        const t = tag.toLowerCase().trim()
        if (t) tagCounts[t] = (tagCounts[t] ?? 0) + 1
      }
    }

    // ── Build node set ───────────────────────────────────────────────────────
    // Include all subjects (even mastery-only ones) and tags used ≥ 2 times
    const subjectNodeIds = new Set([
      ...Object.keys(subjectCounts),
      ...Object.keys(masteryScores),
    ])

    const nodes: GraphNode[] = []

    for (const id of subjectNodeIds) {
      nodes.push({
        id,
        label: id.charAt(0).toUpperCase() + id.slice(1),
        type: 'subject',
        noteCount: subjectCounts[id] ?? 0,
        mastery: masteryScores[id] != null ? masteryScores[id] : null,
      })
    }

    // Add high-frequency tags that aren't already subject nodes (cap at 12)
    const tagNodes = Object.entries(tagCounts)
      .filter(([tag]) => !subjectNodeIds.has(tag))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 12)

    for (const [tag, count] of tagNodes) {
      nodes.push({
        id: tag,
        label: tag.charAt(0).toUpperCase() + tag.slice(1),
        type: 'tag',
        noteCount: count,
        mastery: null,
      })
    }

    // ── Build edge set ───────────────────────────────────────────────────────
    // Two nodes are linked when a note references both of them.
    const allNodeIds = new Set(nodes.map((n) => n.id))
    const edgeMap: Record<string, number> = {}  // "a||b" → weight

    for (const note of notes) {
      // Gather all node IDs this note touches
      const touched: string[] = []
      if (note.subject && allNodeIds.has(note.subject)) touched.push(note.subject)
      for (const tag of note.tags) {
        const t = tag.toLowerCase().trim()
        if (allNodeIds.has(t)) touched.push(t)
      }

      // Add an edge between every pair
      for (let i = 0; i < touched.length; i++) {
        for (let j = i + 1; j < touched.length; j++) {
          const [a, b] = [touched[i], touched[j]].sort()
          const key = `${a}||${b}`
          edgeMap[key] = (edgeMap[key] ?? 0) + 1
        }
      }
    }

    const edges: GraphEdge[] = Object.entries(edgeMap).map(([key, weight]) => {
      const [source, target] = key.split('||')
      return { source, target, weight }
    })

    const data: KnowledgeGraphData = { nodes, edges }
    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
