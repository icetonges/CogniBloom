'use client'

/**
 * Interactive Frost MS floor plan.
 *
 * Draws one floor at a time from the schematic geometry in lib/school/rooms,
 * highlights the rooms on today's route in visit order, and overlays the
 * walking path for the currently selected leg. Pan with drag, zoom with the
 * wheel or the buttons.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ROOMS, NODES, VIEW_W, VIEW_H,
  type Room, type Floor, type Route,
  roomCenter, findRoom,
} from '@/lib/school/rooms'
import { cn } from '@/lib/utils'

export interface FloorPlanProps {
  floor: Floor
  onFloorChange: (f: Floor) => void
  /** Rooms on today's path, in visit order — numbered badges are drawn on these. */
  path?: string[]
  /** The leg currently being explained, drawn as a route line. */
  route?: Route | null
  /** Room the user has selected / searched for. */
  selected?: string | null
  onSelectRoom?: (roomId: string) => void
  /** Per-room accent colours, keyed by room id. */
  accents?: Record<string, string>
  className?: string
}

const WING_FILL: Record<string, string> = {
  A: 'fill-slate-500/10',
  B: 'fill-indigo-500/10',
  C: 'fill-emerald-500/10',
  D: 'fill-violet-500/10',
  E: 'fill-amber-500/10',
  F: 'fill-cyan-500/10',
  G: 'fill-rose-500/10',
  J: 'fill-fuchsia-500/10',
  Core: 'fill-sky-500/10',
}

export function FloorPlan({
  floor, onFloorChange, path = [], route = null, selected = null,
  onSelectRoom, accents = {}, className,
}: FloorPlanProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [hover, setHover] = useState<Room | null>(null)
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const rooms = useMemo(() => ROOMS.filter((r) => r.floor === floor), [floor])
  const stairs = useMemo(() => NODES.filter((n) => n.floor === floor && n.stairTo), [floor])

  // Visit order → badge number. A room visited twice (E106 in periods 1 and 4)
  // shows every stop number it owns.
  const stops = useMemo(() => {
    const m = new Map<string, number[]>()
    path.forEach((raw, i) => {
      const r = findRoom(raw)
      if (!r) return
      const list = m.get(r.id) ?? []
      list.push(i + 1)
      m.set(r.id, list)
    })
    return m
  }, [path])

  const routeSegments = useMemo(() => {
    if (!route) return []
    const segs: { d: string; floor: Floor }[] = []
    let cur: { x: number; y: number }[] = []
    let curFloor: Floor | null = null
    for (const p of route.points) {
      if (curFloor === null) curFloor = p.floor
      if (p.floor !== curFloor) {
        if (cur.length > 1) segs.push({ d: toPath(cur), floor: curFloor })
        cur = []
        curFloor = p.floor
      }
      cur.push(p)
    }
    if (cur.length > 1 && curFloor !== null) segs.push({ d: toPath(cur), floor: curFloor })
    return segs
  }, [route])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => Math.min(4, Math.max(0.6, z * (e.deltaY < 0 ? 1.12 : 0.89))))
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const scale = (svgRef.current?.clientWidth ?? VIEW_W) / VIEW_W
    setPan({
      x: drag.current.px + (e.clientX - drag.current.x) / (scale * zoom),
      y: drag.current.py + (e.clientY - drag.current.y) / (scale * zoom),
    })
  }
  const endDrag = () => { drag.current = null }

  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  const vb = `${-pan.x + (VIEW_W * (1 - 1 / zoom)) / 2} ${-pan.y + (VIEW_H * (1 - 1 / zoom)) / 2} ${VIEW_W / zoom} ${VIEW_H / zoom}`

  return (
    <div className={cn('relative rounded-xl border border-border/60 bg-muted/20 overflow-hidden', className)}>
      {/* ── controls ── */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-lg bg-background/85 backdrop-blur px-1 py-1 border border-border/60">
        {([1, 2] as Floor[]).map((f) => (
          <button
            key={f}
            onClick={() => onFloorChange(f)}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold rounded-md transition-colors',
              floor === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {f === 1 ? '1st floor' : '2nd floor'}
          </button>
        ))}
      </div>
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-lg bg-background/85 backdrop-blur px-1 py-1 border border-border/60">
        <button onClick={() => setZoom((z) => Math.min(4, z * 1.25))} className="w-7 h-7 text-sm font-bold hover:text-primary" aria-label="Zoom in">+</button>
        <button onClick={() => setZoom((z) => Math.max(0.6, z / 1.25))} className="w-7 h-7 text-sm font-bold hover:text-primary" aria-label="Zoom out">−</button>
        <button onClick={reset} className="px-2 h-7 text-[11px] font-semibold text-muted-foreground hover:text-primary">Reset</button>
      </div>

      {/* ── hover card ── */}
      {hover && (
        <div className="absolute bottom-2 left-2 z-10 rounded-lg bg-background/95 backdrop-blur border border-border/60 px-3 py-2 max-w-[60%]">
          <div className="text-sm font-bold">{hover.label}</div>
          {hover.name && <div className="text-xs text-muted-foreground">{hover.name}</div>}
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mt-0.5">
            {hover.wing === 'Core' ? 'Central core' : `${hover.wing}-wing`} · Floor {hover.floor}
          </div>
        </div>
      )}

      {/* The plan fills its column and grows with it. The floor is 1240×1000,
          so on a full-width page this draws about twice as large as before;
          preserveAspectRatio letterboxes rather than distorting when the
          max-height caps it on a short window. */}
      <svg
        ref={svgRef}
        viewBox={vb}
        className="w-full h-auto min-h-[520px] max-h-[calc(100vh-7rem)] touch-none select-none cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        role="img"
        aria-label={`Frost Middle School floor ${floor} plan`}
      >
        <defs>
          <marker id="fp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" className="fill-primary" />
          </marker>
        </defs>

        {/* building outline */}
        <rect x={8} y={8} width={VIEW_W - 16} height={VIEW_H - 16} rx={14}
          className="fill-background stroke-border" strokeWidth={2} />

        {/* rooms */}
        {rooms.map((r) => {
          const nums = stops.get(r.id)
          const isStop = !!nums
          const isSel = selected === r.id
          const accent = accents[r.id]
          return (
            <g
              key={r.id}
              onMouseEnter={() => setHover(r)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelectRoom?.(r.id)}
              className="cursor-pointer"
            >
              <rect
                x={r.x} y={r.y} width={r.w} height={r.h} rx={4}
                className={cn(
                  'stroke-border transition-all',
                  !isStop && !isSel && WING_FILL[r.wing],
                  isSel && 'stroke-primary'
                )}
                style={isStop || isSel ? { fill: accent ?? 'var(--primary, #6366f1)', fillOpacity: isSel ? 0.5 : 0.32 } : undefined}
                strokeWidth={isSel ? 3 : isStop ? 2 : 1}
              />
              <text
                x={r.x + r.w / 2} y={r.y + r.h / 2 + 4}
                textAnchor="middle"
                className={cn(
                  'pointer-events-none',
                  isStop || isSel ? 'fill-foreground font-bold' : 'fill-muted-foreground'
                )}
                fontSize={r.w > 100 ? 18 : 14.5}
              >
                {r.label}
              </text>
              {nums?.map((n, i) => (
                <g key={n} className="pointer-events-none">
                  <circle cx={r.x + 12 + i * 23} cy={r.y + 12} r={11} className="fill-primary" />
                  <text x={r.x + 12 + i * 23} y={r.y + 16.5} textAnchor="middle"
                    className="fill-primary-foreground font-bold" fontSize={13}>{n}</text>
                </g>
              ))}
            </g>
          )
        })}

        {/* stairwells */}
        {stairs.map((n) => (
          <g key={n.id} className="pointer-events-none">
            <rect x={n.x - 11} y={n.y - 11} width={22} height={22} rx={3}
              className="fill-muted stroke-muted-foreground/50" strokeWidth={1} />
            {[0, 1, 2].map((i) => (
              <line key={i} x1={n.x - 7} y1={n.y - 5 + i * 5} x2={n.x + 7} y2={n.y - 5 + i * 5}
                className="stroke-muted-foreground" strokeWidth={1.2} />
            ))}
          </g>
        ))}

        {/* route */}
        {routeSegments
          .filter((s) => s.floor === floor)
          .map((s, i) => (
            <path
              key={i}
              d={s.d}
              className="stroke-primary"
              fill="none"
              strokeWidth={5.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="12 8"
              markerEnd={i === routeSegments.length - 1 ? 'url(#fp-arrow)' : undefined}
              opacity={0.95}
            >
              <animate attributeName="stroke-dashoffset" from="34" to="0" dur="1.1s" repeatCount="indefinite" />
            </path>
          ))}

        {/* endpoints of the visible leg */}
        {route && [route.from, route.to].map((r, i) =>
          r.floor === floor ? (
            <circle key={i} {...circleAt(r)} r={9}
              className={i === 0 ? 'fill-background stroke-primary' : 'fill-primary stroke-background'}
              strokeWidth={3} />
          ) : null
        )}
      </svg>
    </div>
  )
}

function toPath(pts: { x: number; y: number }[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

function circleAt(r: Room) {
  const c = roomCenter(r)
  return { cx: c.x, cy: c.y }
}
