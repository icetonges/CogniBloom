'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pen, Eraser, Undo2, Type, ImagePlus, X, Loader2, Check } from 'lucide-react'

export interface HandwritingResult {
  text?: string
  imageDataUrl?: string
}

interface HandwritingPadProps {
  open: boolean
  onClose: () => void
  onResult: (r: HandwritingResult) => void
  /** When true, hides "Insert drawing" (target field can only hold text). */
  textOnly?: boolean
  title?: string
}

type Pt = { x: number; y: number; t: number }

// ── Minimal typing for the experimental Web Handwriting Recognition API ──
interface HWDrawing {
  addStroke(s: { points: { x: number; y: number; t: number }[] }): void
  getPrediction(): Promise<{ text: string }[]>
}
interface HWRecognizer { startDrawing(hints: object): HWDrawing }
interface HWNavigator {
  queryHandwritingRecognizerSupport?(c: object): Promise<unknown>
  createHandwritingRecognizer?(c: object): Promise<HWRecognizer>
}

export function HandwritingPad({ open, onClose, onResult, textOnly, title }: HandwritingPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const strokesRef = useRef<Pt[][]>([])
  const drawingRef = useRef<Pt[] | null>(null)

  const [mode, setMode] = useState<'draw' | 'review'>('draw')
  const [recognized, setRecognized] = useState('')
  const [busy, setBusy] = useState(false)
  const [hasInk, setHasInk] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── set up / resize the canvas ──
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.6
    ctx.strokeStyle = '#e6eaf3'
    ctxRef.current = ctx
    redraw()
  }, [])

  useEffect(() => {
    if (!open) return
    // reset state each time it opens
    strokesRef.current = []
    drawingRef.current = null
    setMode('draw'); setRecognized(''); setBusy(false); setHasInk(false); setError(null)
    const id = requestAnimationFrame(() => setupCanvas())
    window.addEventListener('resize', setupCanvas)
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', setupCanvas) }
  }, [open, setupCanvas])

  function redraw() {
    const ctx = ctxRef.current, canvas = canvasRef.current
    if (!ctx || !canvas) return
    const dpr = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    for (const stroke of strokesRef.current) drawStroke(ctx, stroke)
  }

  function drawStroke(ctx: CanvasRenderingContext2D, stroke: Pt[]) {
    if (stroke.length < 2) {
      if (stroke.length === 1) {
        ctx.beginPath(); ctx.arc(stroke[0].x, stroke[0].y, 1.4, 0, Math.PI * 2); ctx.fill()
      }
      return
    }
    ctx.beginPath()
    ctx.moveTo(stroke[0].x, stroke[0].y)
    for (let i = 1; i < stroke.length - 1; i++) {
      const mx = (stroke[i].x + stroke[i + 1].x) / 2
      const my = (stroke[i].y + stroke[i + 1].y) / 2
      ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, mx, my)
    }
    const last = stroke[stroke.length - 1]
    ctx.lineTo(last.x, last.y)
    ctx.stroke()
  }

  function pos(e: React.PointerEvent): Pt {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: Date.now() }
  }

  const onDown = (e: React.PointerEvent) => {
    if (mode !== 'draw') return
    e.preventDefault()
    canvasRef.current?.setPointerCapture(e.pointerId)
    drawingRef.current = [pos(e)]
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return
    const p = pos(e)
    const stroke = drawingRef.current
    stroke.push(p)
    const ctx = ctxRef.current
    if (ctx && stroke.length >= 2) {
      const a = stroke[stroke.length - 2]
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(p.x, p.y); ctx.stroke()
    }
  }
  const onUp = () => {
    if (!drawingRef.current) return
    if (drawingRef.current.length) { strokesRef.current.push(drawingRef.current); setHasInk(true) }
    drawingRef.current = null
  }

  const clearAll = () => { strokesRef.current = []; setHasInk(false); redraw() }
  const undo = () => { strokesRef.current.pop(); setHasInk(strokesRef.current.length > 0); redraw() }

  const toPng = () => canvasRef.current?.toDataURL('image/png') ?? ''

  // ── recognition: native API first (instant/offline), then AI fallback ──
  async function recognize() {
    if (!hasInk) return
    setBusy(true); setError(null)
    try {
      const nav = navigator as unknown as HWNavigator
      if (nav.createHandwritingRecognizer && nav.queryHandwritingRecognizerSupport) {
        try {
          const recognizer = await nav.createHandwritingRecognizer({
            languages: ['en'], alternatives: 0,
          })
          const drawing = recognizer.startDrawing({ recognitionType: 'text', inputType: 'mouse' })
          for (const stroke of strokesRef.current) {
            drawing.addStroke({ points: stroke.map((p) => ({ x: p.x, y: p.y, t: p.t })) })
          }
          const preds = await drawing.getPrediction()
          if (preds?.[0]?.text) {
            setRecognized(preds[0].text); setMode('review'); setBusy(false); return
          }
        } catch { /* fall through to server transcription */ }
      }
      // Server (Gemini vision) fallback — reliable everywhere
      const res = await fetch('/api/handwriting', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: toPng() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Recognition failed')
      setRecognized(data.text ?? ''); setMode('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not recognize handwriting')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 font-semibold">
            <Pen className="w-4 h-4 text-primary" /> {title ?? 'Handwrite'}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {mode === 'draw' ? (
          <>
            <div className="p-3">
              <canvas
                ref={canvasRef}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                onPointerLeave={onUp}
                className="w-full h-[300px] rounded-xl touch-none cursor-crosshair"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.18)' }}
              />
              <p className="text-[11px] text-muted-foreground mt-2 text-center">
                Write with a stylus, finger, or mouse. {textOnly ? 'It will be converted to text.' : 'Convert to text or drop it in as an image.'}
              </p>
              {error && <p className="text-xs text-rose-500 text-center mt-1">{error}</p>}
            </div>
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border flex-wrap">
              <button onClick={clearAll} disabled={!hasInk} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40">
                <Eraser className="w-3.5 h-3.5" /> Clear
              </button>
              <button onClick={undo} disabled={!hasInk} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40">
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </button>
              <div className="flex-1" />
              {!textOnly && (
                <button onClick={() => { onResult({ imageDataUrl: toPng() }); onClose() }} disabled={!hasInk} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40">
                  <ImagePlus className="w-3.5 h-3.5" /> Insert drawing
                </button>
              )}
              <button onClick={recognize} disabled={!hasInk || busy} className="inline-flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-40">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Type className="w-3.5 h-3.5" />} Convert to text
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-4 space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Recognized text — edit if needed</label>
              <textarea
                autoFocus
                value={recognized}
                onChange={(e) => setRecognized(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
              <button onClick={() => setMode('draw')} className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted">
                ← Back to drawing
              </button>
              <div className="flex-1" />
              <button onClick={() => { onResult({ text: recognized }); onClose() }} disabled={!recognized.trim()} className="inline-flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-40">
                <Check className="w-3.5 h-3.5" /> Insert text
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
