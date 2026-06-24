'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2, RefreshCw, CheckCircle2, XCircle, Clock,
  SkipForward, ChevronLeft, Rss, Bot, Zap, Database,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { CATEGORY_META } from '@/lib/feed/meta'
import { triggerIngest } from './actions'

interface SourceRow {
  id: string
  name: string
  category: string
  url: string
  type: string
  isActive: boolean
  lastPulledAt: string | null
  lastStatus: string | null
  lastError: string | null
  itemsToday: number
  itemsTotal: number
  totalItemsInDb: number
}

interface Summary {
  totalSources: number
  activeSources: number
  errorSources: number
  totalItemsToday: number
  totalItemsEver: number
  lastPulledAt: string | null
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  success: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    label: 'OK',
    className: 'text-green-600 dark:text-green-400',
  },
  error: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    label: 'Error',
    className: 'text-red-500',
  },
  skipped: {
    icon: <SkipForward className="w-3.5 h-3.5" />,
    label: 'Skipped',
    className: 'text-muted-foreground',
  },
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  rss: { icon: <Rss className="w-3 h-3" />, label: 'RSS' },
  api: { icon: <Zap className="w-3 h-3" />, label: 'API' },
  ai: { icon: <Bot className="w-3 h-3" />, label: 'AI' },
}

function formatTime(iso: string | null): string {
  if (!iso) return 'Never'
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  return `${diffDays}d ago`
}

function SourceRow({ src }: { src: SourceRow }) {
  const [showError, setShowError] = useState(false)
  const statusConf = src.lastStatus ? STATUS_CONFIG[src.lastStatus] : null
  const typeConf = TYPE_CONFIG[src.type] ?? { icon: <Database className="w-3 h-3" />, label: src.type }

  return (
    <div className="py-3 border-b border-border/50 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {/* Type badge */}
          <span className="shrink-0 flex items-center gap-1 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded mt-0.5">
            {typeConf.icon}
            {typeConf.label}
          </span>

          <div className="min-w-0">
            <p className="font-medium text-sm leading-tight truncate">{src.name}</p>
            {src.url && (
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-blue-500 hover:underline truncate block"
              >
                {src.url.slice(0, 60)}{src.url.length > 60 ? '…' : ''}
              </a>
            )}
          </div>
        </div>

        {/* Right: status + counts */}
        <div className="flex items-center gap-3 shrink-0 text-xs">
          <div className="text-right">
            <p className="text-muted-foreground">{src.itemsToday} today</p>
            <p className="text-muted-foreground">{src.itemsTotal} total</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {statusConf ? (
              <span className={cn('flex items-center gap-1 font-medium', statusConf.className)}>
                {statusConf.icon} {statusConf.label}
              </span>
            ) : (
              <span className="text-muted-foreground text-[10px]">Not pulled</span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {formatTime(src.lastPulledAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Error detail */}
      {src.lastError && (
        <div className="mt-2">
          <button
            onClick={() => setShowError((v) => !v)}
            className="text-[10px] text-red-500 hover:underline"
          >
            {showError ? 'Hide error' : 'Show error'}
          </button>
          {showError && (
            <pre className="mt-1 text-[10px] text-red-400 bg-red-500/5 rounded p-2 overflow-x-auto whitespace-pre-wrap">
              {src.lastError.slice(0, 400)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

export default function FeedSourcesPage() {
  const router = useRouter()
  const [data, setData] = useState<Record<string, SourceRow[]>>({})
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [ingestResult, setIngestResult] = useState<string | null>(null)

  const loadSources = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/feed/sources')
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      setData(json.data ?? {})
      setSummary(json.summary ?? null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const runIngest = async () => {
    setIngesting(true)
    setIngestResult(null)
    try {
      const result = await triggerIngest()
      if (result.success) {
        setIngestResult(`✅ Ingested ${result.summary?.totalNewItems ?? 0} new items across ${result.summary?.categoriesProcessed ?? 0} categories in ${result.summary?.durationMs ?? 0}ms.`)
        await loadSources(true)
      } else {
        setIngestResult(`❌ ${result.error ?? 'Ingest failed'}`)
      }
    } catch (e) {
      setIngestResult(`❌ ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setIngesting(false)
    }
  }

  useEffect(() => { loadSources() }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard/feed')}
          className="mt-1 -ml-2 gap-1 text-muted-foreground"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          All Feeds
        </Button>
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">⚙️ Feed Source Status</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Live status of all content sources powering the category feeds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSources(true)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={runIngest}
            disabled={ingesting}
            className="gap-2"
          >
            {ingesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {ingesting ? 'Ingesting…' : 'Run Ingest Now'}
          </Button>
        </div>
      </div>

      {ingestResult && (
        <Card className={cn('p-3 text-sm', ingestResult.startsWith('✅') ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5')}>
          {ingestResult}
        </Card>
      )}

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total Sources', value: summary.totalSources, color: 'text-foreground' },
            { label: 'Active', value: summary.activeSources, color: 'text-green-600 dark:text-green-400' },
            { label: 'Errors', value: summary.errorSources, color: summary.errorSources > 0 ? 'text-red-500' : 'text-muted-foreground' },
            { label: "Items Today", value: summary.totalItemsToday, color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Items Ever', value: summary.totalItemsEver, color: 'text-muted-foreground' },
          ].map(({ label, value, color }) => (
            <Card key={label} className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={cn('text-2xl font-bold', color)}>{value}</p>
            </Card>
          ))}
        </div>
      )}

      {summary?.lastPulledAt && (
        <p className="text-xs text-muted-foreground -mt-2">
          Last pull: {new Date(summary.lastPulledAt).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} ET
        </p>
      )}

      {/* Per-category source lists */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {CATEGORY_META.map((cat) => {
            const srcs = data[cat.slug] ?? []
            const errCount = srcs.filter((s) => s.lastStatus === 'error').length
            const okCount = srcs.filter((s) => s.lastStatus === 'success').length

            return (
              <Card key={cat.slug} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{cat.emoji}</span>
                    <div>
                      <h2 className="font-semibold text-sm">{cat.label}</h2>
                      <p className="text-xs text-muted-foreground">{srcs.length} sources</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {okCount > 0 && (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="w-3 h-3" /> {okCount}
                      </span>
                    )}
                    {errCount > 0 && (
                      <span className="flex items-center gap-1 text-red-500">
                        <XCircle className="w-3 h-3" /> {errCount}
                      </span>
                    )}
                    {srcs.length === 0 && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" /> Not run
                      </span>
                    )}
                  </div>
                </div>

                {srcs.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No sources registered yet — ingest once to populate.</p>
                ) : (
                  srcs.map((src) => <SourceRow key={src.id} src={src} />)
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
