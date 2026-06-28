'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import {
  TrendingUp, Sparkles, Loader2, RefreshCw, Info, Plus, Trash2,
  ShieldCheck, Bot, BookOpen, Target, Clock, ExternalLink,
} from 'lucide-react'
import { cn, localISODate } from '@/lib/utils'
import { MarkdownRenderer } from '@/components/notes/MarkdownRenderer'
import { ModelCompare } from '@/components/chat/ModelCompare'

// ── Finance-advisor system prompt (adapted from Anthropic's wealth-management
//    skill posture + behavioral-finance coaching + teen-safe guardrails) ──
const FINANCE_SYSTEM = [
  'You are the AI Investment Assistant inside a teen financial-literacy app. The user is a teenager learning to invest $5 a day.',
  'Your job is to teach research habits, business thinking, risk awareness, and behavioral self-awareness — NOT to manage money.',
  'Hard rules (always): you do NOT recommend or rank specific stocks/tickers/funds to buy or sell; you do NOT predict prices or promise returns;',
  'you do NOT encourage day trading, options, leverage, crypto speculation, meme-stock chasing, or hype-based decisions;',
  'you never give personalized financial, legal, or tax advice. You help the teen reason for themselves.',
  'Coaching style: ask Socratic questions, point out behavioral biases by name (anchoring, loss aversion, herding, recency, confirmation, overconfidence),',
  'reinforce diversification, dollar-cost averaging, long time horizons, understanding the business, and checking more than one source.',
  'Treat losses as learning signals, not failures. Be warm, concise, and age-appropriate.',
  'When you state a general fact, prefer well-established principles from authoritative sources (SEC/Investor.gov, FINRA, CFA Institute). If unsure, say so.',
  'Always end with: a one-line reminder that this is educational only, not investment advice.',
].join(' ')

const DECISIONS = ['Invest $5', 'Hold Cash', 'Add to Watchlist', 'Research More'] as const
const RISK_LEVELS = ['Low', 'Medium', 'High'] as const
const SCORE_ROWS: { key: string; label: string }[] = [
  { key: 'understand', label: 'I understand the business' },
  { key: 'products', label: 'Strong products / services' },
  { key: 'financials', label: 'Seems financially healthy' },
  { key: 'longterm', label: 'Long-term potential' },
  { key: 'risk', label: 'The risk feels acceptable' },
  { key: 'nothype', label: 'I am NOT buying from hype' },
]

interface PortRow {
  ticker: string; name: string; invested: string; shares: string
  avgPrice: string; currentPrice: string; reason: string; risk: string; action: string
}
interface WatchRow {
  ticker: string; name: string; why: string; learn: string; question: string; risk: string; reviewDate: string
}
const emptyPort = (): PortRow => ({ ticker: '', name: '', invested: '', shares: '', avgPrice: '', currentPrice: '', reason: '', risk: 'Low', action: 'Watch' })
const emptyWatch = (): WatchRow => ({ ticker: '', name: '', why: '', learn: '', question: '', risk: 'Low', reviewDate: '' })

// ── tiny localStorage-backed state hook ──
function useStored<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [val, setVal] = useState<T>(initial)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw != null) setVal(JSON.parse(raw))
    } catch { /* ignore */ }
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* ignore */ }
  }, [key, val, ready])
  return [val, setVal]
}

// ── small reusable field with instruction-as-placeholder (nothing pre-filled) ──
function Field({
  label, hint, value, onChange, textarea, type = 'text', tip,
}: {
  label: string; hint: string; value: string; onChange: (v: string) => void
  textarea?: boolean; type?: string; tip?: string
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
        {label}
        {tip && (
          <span className="group relative inline-flex">
            <Info className="w-3 h-3 opacity-60" />
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1 w-48 rounded-lg px-2.5 py-1.5 text-[10px] font-normal normal-case leading-snug text-white opacity-0 group-hover:opacity-100 transition-opacity z-20"
              style={{ background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(255,255,255,0.12)' }}>
              {tip}
            </span>
          </span>
        )}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hint}
          rows={2}
          className="cb-input w-full px-3 py-2 rounded-xl text-sm focus:outline-none resize-y placeholder:text-muted-foreground/45"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hint}
          className="cb-input w-full px-3 py-2 rounded-xl text-sm focus:outline-none placeholder:text-muted-foreground/45"
        />
      )}
    </label>
  )
}

function Chips({ options, value, onChange }: { options: readonly string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(value === o ? '' : o)}
          className={cn(
            'text-[11px] px-2.5 py-1 rounded-full font-semibold transition-all',
            value === o ? 'text-white' : 'text-muted-foreground hover:text-foreground',
          )}
          style={value === o
            ? { background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 2px 8px rgba(16,185,129,0.35)' }
            : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

function ScoreRow({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm">{label}</span>
      <div className="flex gap-1 shrink-0">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? 0 : n)}
            className={cn(
              'w-7 h-7 rounded-lg text-xs font-bold transition-all',
              value >= n && value > 0 ? 'text-white' : 'text-muted-foreground',
            )}
            style={value >= n && value > 0
              ? { background: 'linear-gradient(135deg, #10b981, #059669)' }
              : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function SectionCard({ icon: Icon, title, subtitle, children, accent = '#10b981' }: {
  icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string
  children: React.ReactNode; accent?: string
}) {
  return (
    <section className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${accent}1f`, border: `1px solid ${accent}40` }}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-bold leading-none">{title}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

interface Tip { date: string; topic: string; storyTitle: string; biasName: string; markdown: string; sources: { label: string; url: string }[]; generated: boolean }

export default function InvestmentPage() {
  const today = localISODate(new Date())

  // Daily entry (resets each calendar day via per-date key)
  const dailyKey = `cb:invest:daily:${today}`
  const [daily, setDaily] = useStored(dailyKey, {
    ticker: '', name: '', price: '', decision: '', confidence: '', riskFeel: '', timeSpent: '',
    business: '', numbers: '', news: '', riskCheck: '', reason: '', lesson: '',
  })
  const setD = (k: string, v: string) => setDaily((p) => ({ ...p, [k]: v }))

  const [score, setScore] = useStored<Record<string, number>>(`cb:invest:score:${today}`, {})
  const scoreTotal = SCORE_ROWS.reduce((sum, r) => sum + (score[r.key] || 0), 0)
  const scoreComplete = SCORE_ROWS.every((r) => (score[r.key] || 0) > 0)
  const band =
    !scoreComplete ? { text: 'Rate all six to see your guide', color: '#94a3b8' }
    : scoreTotal >= 24 ? { text: '24–30 · Strong research candidate', color: '#10b981' }
    : scoreTotal >= 18 ? { text: '18–23 · Needs more research', color: '#eab308' }
    : scoreTotal >= 12 ? { text: '12–17 · High uncertainty', color: '#f97316' }
    : { text: 'Below 12 · Avoid for now / keep on watchlist', color: '#ef4444' }

  // Persistent across days
  const [portfolio, setPortfolio] = useStored<PortRow[]>('cb:invest:portfolio', [emptyPort()])
  const [watchlist, setWatchlist] = useStored<WatchRow[]>('cb:invest:watchlist', [emptyWatch()])

  // ── Daily tip (cached per day so it generates once, then stays stable) ──
  const [tip, setTip] = useState<Tip | null>(null)
  const [tipLoading, setTipLoading] = useState(true)

  const loadTip = async (force = false) => {
    const cacheKey = `cb:invest:tip:v4:${today}`
    if (!force) {
      try {
        const cached = localStorage.getItem(cacheKey)
        if (cached) { setTip(JSON.parse(cached)); setTipLoading(false); return }
      } catch { /* ignore */ }
    }
    if (force) setTip(null)
    setTipLoading(true)
    try {
      const r = await fetch(`/api/investment/tip?date=${today}&n=${Date.now()}`, { cache: 'no-store' })
      const data = await r.json()
      setTip(data)
      try { localStorage.setItem(cacheKey, JSON.stringify(data)) } catch { /* ignore */ }
    } catch {
      setTip(null)
    } finally {
      setTipLoading(false)
    }
  }
  useEffect(() => { loadTip(false) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [today])

  // ── AI: analyze my day ──
  const [analysis, setAnalysis] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null)

  const analyzeDay = async () => {
    setAnalyzing(true); setAnalyzeErr(null); setAnalysis('')
    const lines = [
      `Ticker/ETF: ${daily.ticker || '—'} (${daily.name || 'no name'})`,
      `Today's price: ${daily.price || '—'} · Planned: $5`,
      `Decision: ${daily.decision || '—'} · Confidence: ${daily.confidence || '—'}/5 · Risk I feel: ${daily.riskFeel || '—'}`,
      `What the business does / how it earns: ${daily.business || '—'}`,
      `Numbers I found: ${daily.numbers || '—'}`,
      `News I read: ${daily.news || '—'}`,
      `My risk check: ${daily.riskCheck || '—'}`,
      `My reason: ${daily.reason || '—'}`,
      `Research scorecard: ${scoreComplete ? scoreTotal + '/30' : 'incomplete'}`,
    ]
    const prompt =
      `Here is my investing research for today. Please coach me: point out any behavioral biases, ` +
      `what's strong, what's missing, and 2–3 Socratic questions to make my reasoning better. ` +
      `Do not tell me whether to buy.\n\n${lines.join('\n')}`
    try {
      const r = await fetch('/api/tutor/compare', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, modelA: 'gemini-3.5-flash', system: FINANCE_SYSTEM }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error ?? 'Request failed')
      if (data?.a?.error) throw new Error(data.a.error)
      setAnalysis(data?.a?.content ?? '')
    } catch (e) {
      setAnalyzeErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const routine = useMemo(() => ([
    'Min 1–2 · Pick a stock or ETF',
    'Min 3–5 · Understand what it does',
    'Min 6–8 · Check a few numbers',
    'Min 9–11 · Read 1–2 news items',
    'Min 12–13 · Risk check',
    'Min 14–15 · Decide the $5 + write a lesson',
  ]), [])

  const portTotals = portfolio.reduce((acc, r) => {
    const avg = parseFloat(r.avgPrice), cur = parseFloat(r.currentPrice), sh = parseFloat(r.shares), inv = parseFloat(r.invested)
    if (!Number.isNaN(inv)) acc.invested += inv
    if (!Number.isNaN(avg) && !Number.isNaN(cur) && !Number.isNaN(sh)) acc.gain += (cur - avg) * sh
    return acc
  }, { invested: 0, gain: 0 })

  return (
    <div className="space-y-6 pb-10">
      {/* Hero */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(5,150,105,0.06))', border: '1px solid rgba(16,185,129,0.25)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 0 18px rgba(16,185,129,0.5)' }}>
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Investment Reflection</h1>
            <p className="text-sm text-muted-foreground">My $5 research lab · {today}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {routine.map((t) => (
            <span key={t} className="text-[10px] font-semibold px-2 py-1 rounded-full text-muted-foreground flex items-center gap-1"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Clock className="w-2.5 h-2.5" /> {t}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground rounded-xl px-3 py-2"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#10b981' }} />
          Educational only — not investment advice. No returns are promised. Losses are learning signals. You make every $5 decision yourself.
        </div>
      </div>

      {/* Daily tip */}
      <SectionCard icon={Sparkles} title="Daily Investment Story" subtitle="An inspiring daily read · grounded in SEC, Federal Reserve, Nobel &amp; CFA Institute facts" accent="#6366f1">
        {tipLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Writing today’s story…
          </div>
        ) : tip ? (
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>📖 {tip.storyTitle}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' }}>Bias: {tip.biasName}</span>
              <button onClick={() => loadTip(true)} className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                <RefreshCw className="w-3 h-3" /> New wording
              </button>
            </div>
            <MarkdownRenderer content={tip.markdown} disableMath />
            {tip.sources?.length > 0 && (
              <div className="mt-3 pt-3 flex flex-wrap gap-x-4 gap-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Sources</span>
                {tip.sources.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] inline-flex items-center gap-1 text-primary hover:underline">
                    {s.label} <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">Couldn’t load today’s tip. <button onClick={() => loadTip(true)} className="text-primary hover:underline">Try again</button>.</p>
        )}
      </SectionCard>

      {/* Today's $5 decision */}
      <SectionCard icon={Target} title="Today’s $5 Decision" subtitle="Click any field to type — the grey hint is just an example and isn’t saved">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Ticker" hint="e.g. VOO" value={daily.ticker} onChange={(v) => setD('ticker', v)} />
          <Field label="Company / fund name" hint="e.g. Vanguard S&P 500 ETF" value={daily.name} onChange={(v) => setD('name', v)} />
          <Field label="Today’s price" hint="e.g. $512.40" value={daily.price} onChange={(v) => setD('price', v)} />
          <Field label="Time spent researching" hint="e.g. 12 min" value={daily.timeSpent} onChange={(v) => setD('timeSpent', v)} />
        </div>
        <div className="mt-3 grid sm:grid-cols-2 gap-4">
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">My decision today</span>
            <Chips options={DECISIONS} value={daily.decision} onChange={(v) => setD('decision', v)} />
          </div>
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Risk I feel</span>
            <Chips options={RISK_LEVELS} value={daily.riskFeel} onChange={(v) => setD('riskFeel', v)} />
          </div>
        </div>
        <div className="mt-3">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Confidence (1–5)</span>
          <Chips options={['1', '2', '3', '4', '5']} value={daily.confidence} onChange={(v) => setD('confidence', v)} />
        </div>
      </SectionCard>

      {/* Quick research */}
      <SectionCard icon={BookOpen} title="Quick Research" subtitle="A few honest lines each — short is fine">
        <div className="space-y-3">
          <Field textarea label="Business understanding" value={daily.business} onChange={(v) => setD('business', v)}
            hint="What does it do, how does it make money, and would it still matter in 5–10 years?" />
          <Field textarea label="Simple numbers" value={daily.numbers} onChange={(v) => setD('numbers', v)}
            tip="Market cap = whole-company price. Revenue = sales. Net income = profit after costs. P/E = price vs profit. Dividend = cash paid to holders."
            hint="Market cap, revenue, profit, revenue growth, 1-yr change, P/E, dividend (fill what you can find)" />
          <Field textarea label="News & reason check" value={daily.news} onChange={(v) => setD('news', v)}
            hint="What news did I find? Is it real business news or just market emotion? Did I check more than one source?" />
          <Field textarea label="Risk tolerance check" value={daily.riskCheck} onChange={(v) => setD('riskCheck', v)}
            hint="If this dropped 20%, would I panic, hold, or research more? What could go wrong with this company/industry?" />
        </div>
      </SectionCard>

      {/* Scorecard */}
      <SectionCard icon={ShieldCheck} title="Research Scorecard" subtitle="Rate 1–5. A thinking tool, not a guarantee.">
        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          {SCORE_ROWS.map((r) => (
            <ScoreRow key={r.key} label={r.label} value={score[r.key] || 0} onChange={(n) => setScore((p) => ({ ...p, [r.key]: n }))} />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: `${band.color}14`, border: `1px solid ${band.color}40` }}>
          <span className="text-sm font-bold">Total: {scoreTotal}/30</span>
          <span className="text-xs font-semibold" style={{ color: band.color }}>{band.text}</span>
        </div>
      </SectionCard>

      {/* Decision + lesson */}
      <SectionCard icon={Target} title="Decision & Lesson" accent="#eab308">
        <div className="space-y-3">
          <Field textarea label="Reason for my decision" value={daily.reason} onChange={(v) => setD('reason', v)}
            hint="What evidence supports it, and what would make me change my mind later?" />
          <Field textarea label="One lesson I learned today" value={daily.lesson} onChange={(v) => setD('lesson', v)}
            hint="The single most important habit — even one sentence counts." />
        </div>
      </SectionCard>

      {/* Portfolio */}
      <SectionCard icon={TrendingUp} title="Portfolio Tracker" subtitle="Gain/loss updates automatically as you type prices">
        <div className="space-y-3">
          {portfolio.map((row, i) => {
            const avg = parseFloat(row.avgPrice), cur = parseFloat(row.currentPrice), sh = parseFloat(row.shares)
            const hasCalc = !Number.isNaN(avg) && avg > 0 && !Number.isNaN(cur) && !Number.isNaN(sh)
            const gain = hasCalc ? (cur - avg) * sh : null
            const gainPct = hasCalc ? (cur / avg - 1) * 100 : null
            const up = (gain ?? 0) >= 0
            const set = (k: keyof PortRow, v: string) => setPortfolio((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r))
            return (
              <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Field label="Ticker" hint="AAPL" value={row.ticker} onChange={(v) => set('ticker', v)} />
                  <Field label="Name" hint="Apple Inc." value={row.name} onChange={(v) => set('name', v)} />
                  <Field label="Total invested" hint="$25" value={row.invested} onChange={(v) => set('invested', v)} />
                  <Field label="Shares" hint="0.13" value={row.shares} onChange={(v) => set('shares', v)} />
                  <Field label="Avg price" hint="$190" value={row.avgPrice} onChange={(v) => set('avgPrice', v)} />
                  <Field label="Current price" hint="$205" value={row.currentPrice} onChange={(v) => set('currentPrice', v)} />
                  <Field label="Reason I own it" hint="I understand it" value={row.reason} onChange={(v) => set('reason', v)} />
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Action</span>
                    <Chips options={['Keep', 'Add', 'Watch', 'Exit']} value={row.action} onChange={(v) => set('action', v)} />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs">
                    {gain != null ? (
                      <span className="font-bold" style={{ color: up ? '#10b981' : '#ef4444' }}>
                        {up ? '▲' : '▼'} {up ? '+' : ''}{gain.toFixed(2)} ({gainPct!.toFixed(1)}%)
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Enter avg price, current price &amp; shares for gain/loss</span>
                    )}
                  </div>
                  {portfolio.length > 1 && (
                    <button onClick={() => setPortfolio((p) => p.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-rose-400 transition-colors" title="Remove holding">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          <div className="flex items-center justify-between">
            <button onClick={() => setPortfolio((p) => [...p, emptyPort()])}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add holding
            </button>
            <span className="text-xs text-muted-foreground">
              Invested: <span className="font-bold text-foreground">${portTotals.invested.toFixed(2)}</span> · Gain/loss:{' '}
              <span className="font-bold" style={{ color: portTotals.gain >= 0 ? '#10b981' : '#ef4444' }}>
                {portTotals.gain >= 0 ? '+' : ''}{portTotals.gain.toFixed(2)}
              </span>
            </span>
          </div>
        </div>
      </SectionCard>

      {/* Watchlist */}
      <SectionCard icon={BookOpen} title="Watchlist" subtitle="Curious but not ready to buy" accent="#38bdf8">
        <div className="space-y-3">
          {watchlist.map((row, i) => {
            const set = (k: keyof WatchRow, v: string) => setWatchlist((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r))
            return (
              <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Field label="Ticker" hint="NVDA" value={row.ticker} onChange={(v) => set('ticker', v)} />
                  <Field label="Company" hint="Nvidia" value={row.name} onChange={(v) => set('name', v)} />
                  <Field label="Review date" hint="2026-07-15" value={row.reviewDate} onChange={(v) => set('reviewDate', v)} />
                  <Field label="Why I’m watching" hint="Curious about its business" value={row.why} onChange={(v) => set('why', v)} />
                  <Field label="Learn before buying" hint="How it makes money" value={row.learn} onChange={(v) => set('learn', v)} />
                  <Field label="My target question" hint="Is the price about hype?" value={row.question} onChange={(v) => set('question', v)} />
                </div>
                {watchlist.length > 1 && (
                  <div className="flex justify-end mt-2">
                    <button onClick={() => setWatchlist((p) => p.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-rose-400 transition-colors" title="Remove">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          <button onClick={() => setWatchlist((p) => [...p, emptyWatch()])}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add to watchlist
          </button>
        </div>
      </SectionCard>

      {/* AI Investment Assistant */}
      <section className="rounded-2xl overflow-hidden" style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.20)' }}>
        <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid rgba(99,102,241,0.12)', background: 'rgba(99,102,241,0.08)' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 10px rgba(99,102,241,0.4)' }}>
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-none">AI Investment Assistant</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Coaches your reasoning &amp; biases — never tells you what to buy</p>
          </div>
        </div>
        <div className="p-4 space-y-5">
          <div>
            <p className="text-xs text-muted-foreground mb-3">Analyze today’s research: spot biases, what’s strong, what’s missing, and questions to sharpen your thinking.</p>
            <button onClick={analyzeDay} disabled={analyzing}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40 hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
              {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Analyze my day
            </button>
            {analyzeErr && <p className="mt-2 text-xs text-rose-400">⚠ {analyzeErr}</p>}
            {analysis && (
              <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <MarkdownRenderer content={analysis} disableMath />
              </div>
            )}
          </div>
          <div className="pt-5 border-t" style={{ borderColor: 'rgba(99,102,241,0.12)' }}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-3">Ask &amp; compare two models</p>
            <ModelCompare system={FINANCE_SYSTEM} placeholder="Ask about investing concepts, a business model, or a bias… (Ctrl/Cmd+Enter)" />
          </div>
        </div>
      </section>
    </div>
  )
}
