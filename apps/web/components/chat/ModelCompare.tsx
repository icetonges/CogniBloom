'use client'

import { useState } from 'react'
import { MODELS, DEFAULT_MODEL_ID } from '@/lib/ai/models'
import { MarkdownRenderer } from '@/components/notes/MarkdownRenderer'
import { Loader2, Sparkles, GitCompare, ArrowRightLeft, AlertCircle, Plus, X } from 'lucide-react'

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
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full text-sm rounded-lg px-2.5 py-2 bg-background text-foreground border border-border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {MODELS.map((m) => (
          <option key={m.id} value={m.id} style={{ backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}>
            {m.name} · {m.providerLabel}{m.badge ? ` · ${m.badge}` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

function OutputCard({ side, result, loading }: { side: string; result: SideResult | null; loading: boolean }) {
  const meta = result ? MODELS.find((m) => m.id === result.requested) : null
  const fellBack = result && result.usedModel !== result.requested && !result.error
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta?.providerColor ?? '#888' }} />
        <span className="font-semibold text-sm truncate">{meta?.name ?? side}</span>
        {meta && <span className="text-[10px] text-muted-foreground">{meta.providerLabel}</span>}
        {result && !result.error && (
          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
            {(result.ms / 1000).toFixed(1)}s · {result.tokens} tok
          </span>
        )}
      </div>
      <div className="p-4 flex-1 min-h-[160px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : result?.error ? (
          <div className="flex items-start gap-2 text-sm text-rose-500">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {result.error}
          </div>
        ) : result ? (
          <>
            {fellBack && (
              <p className="text-[11px] text-amber-500 mb-2">
                Requested model unavailable — answered by {result.usedModel}.
              </p>
            )}
            <MarkdownRenderer content={result.content} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Output will appear here.</p>
        )}
      </div>
    </div>
  )
}

export function ModelCompare({ system, placeholder: customPlaceholder }: { system?: string; placeholder?: string } = {}) {
  const [modelA, setModelA] = useState(DEFAULT_MODEL_ID)
  const [modelB, setModelB] = useState(
    () => MODELS.find((m) => m.id !== DEFAULT_MODEL_ID)?.id ?? MODELS[1].id
  )
  // Single model by default; the 2nd model is opt-in for comparison.
  const [compare, setCompare] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState<{ a: SideResult; b: SideResult | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true); setError(null); setRes(null)
    try {
      const r = await fetch('/api/tutor/compare', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // Only send modelB when comparing — otherwise the API runs a single model.
        body: JSON.stringify(compare ? { prompt, modelA, modelB, system } : { prompt, modelA, system }),
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

  return (
    <div className="space-y-4">
      {/* model picker(s) */}
      {!compare ? (
        <div className="flex items-end gap-2">
          <ModelSelect value={modelA} onChange={setModelA} label="Model" />
          <button
            onClick={() => setCompare(true)}
            title="Add a second model to compare side by side"
            className="mb-0.5 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" /> Compare a 2nd model
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <ModelSelect value={modelA} onChange={setModelA} label="Model A" />
          <button
            onClick={swap}
            title="Swap models"
            className="mb-0.5 p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>
          <ModelSelect value={modelB} onChange={setModelB} label="Model B" />
          <button
            onClick={() => setCompare(false)}
            title="Remove second model"
            className="mb-0.5 p-2 rounded-lg border border-border text-muted-foreground hover:text-rose-400 hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* prompt */}
      <div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run() }}
          rows={3}
          placeholder={customPlaceholder ?? (compare
            ? 'Ask both models the same question… (Ctrl/Cmd+Enter to run)'
            : 'Ask the model a question… (Ctrl/Cmd+Enter to run)')}
          className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted-foreground">
            {compare
              ? 'Runs the same prompt through both models in parallel.'
              : 'Ask a single model, or add a second to compare.'}
          </p>
          <button
            onClick={run}
            disabled={!prompt.trim() || loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {compare ? 'Compare' : 'Ask'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-sm text-rose-500">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* outputs */}
      {(loading || res) && (
        <div className={compare ? 'grid md:grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3'}>
          <OutputCard side="Model A" result={res?.a ?? null} loading={loading} />
          {compare && <OutputCard side="Model B" result={res?.b ?? null} loading={loading} />}
        </div>
      )}

      {!loading && !res && !error && (
        <div className="text-center py-12 text-muted-foreground">
          <GitCompare className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {compare
              ? 'Pick two models, ask a question, and compare their answers head-to-head.'
              : 'Pick a model and ask a question. Add a second model anytime to compare.'}
          </p>
        </div>
      )}
    </div>
  )
}
