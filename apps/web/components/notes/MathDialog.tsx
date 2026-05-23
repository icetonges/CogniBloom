'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MathDialogProps {
  open: boolean
  initialLatex?: string
  isBlock?: boolean
  onInsert: (latex: string, display: boolean) => void
  onClose: () => void
}

const TEMPLATES = [
  { label: 'Fraction', latex: '\\frac{a}{b}' },
  { label: 'Square Root', latex: '\\sqrt{x}' },
  { label: 'nth Root', latex: '\\sqrt[n]{x}' },
  { label: 'Power', latex: 'x^{n}' },
  { label: 'Subscript', latex: 'x_{n}' },
  { label: 'Sum (Σ)', latex: '\\sum_{i=1}^{n} x_i' },
  { label: 'Product (Π)', latex: '\\prod_{i=1}^{n} x_i' },
  { label: 'Integral', latex: '\\int_{a}^{b} f(x)\\,dx' },
  { label: 'Double Integral', latex: '\\iint_{D} f(x,y)\\,dA' },
  { label: 'Limit', latex: '\\lim_{x \\to \\infty} f(x)' },
  { label: 'Derivative', latex: '\\frac{d}{dx} f(x)' },
  { label: 'Partial', latex: '\\frac{\\partial f}{\\partial x}' },
  { label: 'Matrix 2×2', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
  { label: 'System', latex: '\\begin{cases} a + b = c \\\\ d - e = f \\end{cases}' },
  { label: 'Binomial', latex: '\\binom{n}{k}' },
  { label: 'Infinity', latex: '\\infty' },
  { label: 'Pi', latex: '\\pi' },
  { label: 'Theta', latex: '\\theta' },
  { label: 'Alpha', latex: '\\alpha' },
  { label: 'Align', latex: 'x^2 + y^2 &= z^2 \\\\' },
  { label: 'Vector', latex: '\\vec{v} = \\langle a, b, c \\rangle' },
  { label: 'Dot Product', latex: '\\vec{u} \\cdot \\vec{v}' },
  { label: 'Cross Product', latex: '\\vec{u} \\times \\vec{v}' },
  { label: 'Norm', latex: '\\|\\vec{v}\\|' },
]

export function MathDialog({ open, initialLatex = '', isBlock = true, onInsert, onClose }: MathDialogProps) {
  const [latex, setLatex] = useState(initialLatex)
  const [display, setDisplay] = useState(isBlock)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [isRendering, setIsRendering] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const renderTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync initial values when dialog opens
  useEffect(() => {
    if (open) {
      setLatex(initialLatex)
      setDisplay(isBlock)
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [open, initialLatex, isBlock])

  // Live KaTeX preview with debounce
  useEffect(() => {
    if (!open) return
    if (renderTimer.current) clearTimeout(renderTimer.current)
    setIsRendering(true)

    renderTimer.current = setTimeout(async () => {
      try {
        const katex = (await import('katex')).default
        const html = katex.renderToString(latex || '\\text{…}', {
          displayMode: display,
          throwOnError: true,
          strict: false,
        })
        setPreviewHtml(html)
        setPreviewError('')
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : 'Invalid LaTeX')
        setPreviewHtml('')
      } finally {
        setIsRendering(false)
      }
    }, 250)

    return () => {
      if (renderTimer.current) clearTimeout(renderTimer.current)
    }
  }, [latex, display, open])

  const handleInsert = () => {
    if (!latex.trim()) return
    onInsert(latex.trim(), display)
    onClose()
  }

  const handleTemplate = (tmplLatex: string) => {
    setLatex(tmplLatex)
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { handleInsert(); return }
    // Allow Tab to insert spaces in textarea
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = textareaRef.current
      if (!el) return
      const start = el.selectionStart
      const end = el.selectionEnd
      const next = latex.substring(0, start) + '  ' + latex.substring(end)
      setLatex(next)
      setTimeout(() => { el.selectionStart = el.selectionEnd = start + 2 }, 0)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#0d1117', border: '1px solid rgba(99,102,241,0.25)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(99,102,241,0.06)' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg font-black" style={{ color: '#a5b4fc' }}>∑</span>
            <span className="font-bold text-sm">Insert Math Formula</span>
            <span className="text-xs text-muted-foreground">(LaTeX)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Display mode toggle */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Mode</span>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              {[
                { label: 'Block (display)', value: true },
                { label: 'Inline', value: false },
              ].map(({ label, value }) => (
                <button
                  key={label}
                  onClick={() => setDisplay(value)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold transition-colors',
                    display === value
                      ? 'text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  style={display === value ? { background: 'rgba(99,102,241,0.3)' } : {}}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Templates */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Templates</p>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {TEMPLATES.map(({ label, latex: tmpl }) => (
                <button
                  key={label}
                  onClick={() => handleTemplate(tmpl)}
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* LaTeX input */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">LaTeX Source</p>
            <textarea
              ref={textareaRef}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
              placeholder="\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}"
              className="w-full rounded-xl px-4 py-3 text-sm font-mono focus:outline-none resize-none"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: '#e2e8f0',
                lineHeight: 1.6,
              }}
            />
            <p className="text-[10px] text-muted-foreground mt-1">Ctrl+Enter to insert · Esc to close</p>
          </div>

          {/* Preview */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Preview</p>
            <div
              className="rounded-xl p-4 min-h-[60px] flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {isRendering ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : previewError ? (
                <p className="text-xs text-red-400 font-mono">{previewError}</p>
              ) : (
                <div
                  className="katex-preview"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={onClose}
            className="text-xs px-4 py-2 rounded-xl font-semibold text-muted-foreground hover:text-foreground transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleInsert}
            disabled={!latex.trim() || !!previewError}
            className="flex items-center gap-1.5 text-xs px-5 py-2 rounded-xl font-bold text-white disabled:opacity-40 transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
            }}
          >
            ∑ Insert Formula
          </button>
        </div>
      </div>
    </div>
  )
}
