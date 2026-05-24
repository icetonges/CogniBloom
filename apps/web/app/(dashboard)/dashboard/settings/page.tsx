'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Loader2, User, Brain, BookOpen, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Settings {
  grade: string
  preferredModel: string
  subjects: string[]
  responseLength: string
  includeExamples: boolean
  emailFrequency: string
}

const DEFAULT_SETTINGS: Settings = {
  grade: 'Year 9',
  preferredModel: 'gemini-2.5-flash',
  subjects: ['Math', 'Science'],
  responseLength: 'medium',
  includeExamples: true,
  emailFrequency: 'daily',
}

const GRADES = ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12']
const MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Fast, smart, and recommended' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', note: 'Cheaper and quick for simple help' },
  { id: 'claude-3-5-haiku-20241022', label: 'Claude Haiku 3.5', note: 'Concise and precise' },
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', note: 'Open-source, very fast' },
]
const MODEL_IDS = new Set(MODELS.map((model) => model.id))
const ALL_SUBJECTS = ['Math', 'Science', 'English', 'History', 'Coding', 'Language', 'Geography', 'Art', 'Music', 'PE']
const RESPONSE_LENGTHS = [
  { id: 'short', label: 'Concise', desc: 'Quick answers, less detail' },
  { id: 'medium', label: 'Balanced', desc: 'Clear explanations with examples' },
  { id: 'detailed', label: 'In-depth', desc: 'Full explanations and deep dives' },
]

const STORAGE_KEY = 'cognibloom_settings'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customSubject, setCustomSubject] = useState('')

  // Load from API on mount (fall back to localStorage if offline)
  useEffect(() => {
    const localFallback = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) setSettings(JSON.parse(stored) as Settings)
      } catch { /* ignore */ }
    }

    fetch('/api/settings')
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) {
          const merged: Settings = {
            grade: data.grade ?? DEFAULT_SETTINGS.grade,
            preferredModel: MODEL_IDS.has(data.preferredModel) ? data.preferredModel : DEFAULT_SETTINGS.preferredModel,
            subjects: (data.subjects as string[]).length > 0 ? (data.subjects as string[]) : DEFAULT_SETTINGS.subjects,
            responseLength: data.responseLength ?? DEFAULT_SETTINGS.responseLength,
            includeExamples: data.includeExamples ?? DEFAULT_SETTINGS.includeExamples,
            emailFrequency: data.emailFrequency ?? DEFAULT_SETTINGS.emailFrequency,
          }
          setSettings(merged)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
        }
      })
      .catch(() => localFallback())
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error('Save failed')
      // Also persist to localStorage as a fast cache for ChatWindow
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Failed to save — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const toggleSubject = (subject: string) => {
    setSettings((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter((s) => s !== subject)
        : [...prev.subjects, subject],
    }))
  }

  const addCustomSubject = () => {
    const trimmed = customSubject.trim()
    if (trimmed && !settings.subjects.includes(trimmed)) {
      setSettings((prev) => ({ ...prev, subjects: [...prev.subjects, trimmed] }))
      setCustomSubject('')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings ⚙️</h1>
        <p className="text-muted-foreground mt-1">Personalise your learning experience.</p>
      </div>

      {/* Profile */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          <User className="w-4 h-4" /> Profile
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Name</label>
            <Input value="Daniel" disabled className="opacity-60 cursor-not-allowed" />
            <p className="text-xs text-muted-foreground mt-1">Name is managed by the app owner.</p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Year Level</label>
            <div className="flex flex-wrap gap-2">
              {GRADES.map((g) => (
                <button
                  key={g}
                  onClick={() => setSettings((p) => ({ ...p, grade: g }))}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                    settings.grade === g
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* AI Tutor */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          <Brain className="w-4 h-4" /> AI Tutor
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Default AI Model</label>
          <p className="text-xs text-muted-foreground mb-3">This model will be pre-selected when you open the AI Tutor.</p>
          <div className="space-y-2">
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setSettings((p) => ({ ...p, preferredModel: m.id }))}
                className={cn(
                  'w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors',
                  settings.preferredModel === m.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <div>
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.note}</p>
                </div>
                {settings.preferredModel === m.id && (
                  <Check className="w-4 h-4 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Response Length</label>
          <div className="grid grid-cols-3 gap-2">
            {RESPONSE_LENGTHS.map((r) => (
              <button
                key={r.id}
                onClick={() => setSettings((p) => ({ ...p, responseLength: r.id }))}
                className={cn(
                  'p-3 rounded-lg border text-center transition-colors',
                  settings.responseLength === r.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <p className="text-sm font-medium">{r.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Include examples</p>
            <p className="text-xs text-muted-foreground">Show worked examples in responses</p>
          </div>
          <button
            onClick={() => setSettings((p) => ({ ...p, includeExamples: !p.includeExamples }))}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              settings.includeExamples ? 'bg-primary' : 'bg-muted'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                settings.includeExamples ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      </Card>

      {/* Subjects */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          <BookOpen className="w-4 h-4" /> Favourite Subjects
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          These will be highlighted in your daily feed and quiz suggestions.
        </p>
        <div className="flex flex-wrap gap-2">
          {ALL_SUBJECTS.map((s) => (
            <button
              key={s}
              onClick={() => toggleSubject(s)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm border transition-colors',
                settings.subjects.includes(s)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add custom subject..."
            value={customSubject}
            onChange={(e) => setCustomSubject(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomSubject()}
            className="flex-1"
          />
          <Button variant="outline" onClick={addCustomSubject} disabled={!customSubject.trim()}>
            Add
          </Button>
        </div>
        {settings.subjects.filter((s) => !ALL_SUBJECTS.includes(s)).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {settings.subjects
              .filter((s) => !ALL_SUBJECTS.includes(s))
              .map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSubject(s)}
                  className="px-3 py-1.5 rounded-full text-sm border bg-primary text-primary-foreground border-primary"
                >
                  {s} ✕
                </button>
              ))}
          </div>
        )}
      </Card>

      {/* Notifications */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          <Bell className="w-4 h-4" /> Notifications
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Daily summary email</p>
            <p className="text-xs text-muted-foreground">Sent to Daniel and parents at 7 PM AEST</p>
          </div>
          <button
            onClick={() => setSettings((p) => ({ ...p, emailFrequency: p.emailFrequency === 'daily' ? 'off' : 'daily' }))}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              settings.emailFrequency === 'daily' ? 'bg-primary' : 'bg-muted'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                settings.emailFrequency === 'daily' ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      </Card>

      {/* Save */}
      {error && (
        <p className="text-sm text-destructive text-right">{error}</p>
      )}
      <div className="flex justify-end pb-8">
        <Button onClick={save} className="gap-2 min-w-36" disabled={saving}>
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          ) : saved ? (
            <><Check className="w-4 h-4" /> Saved!</>
          ) : (
            'Save Settings'
          )}
        </Button>
      </div>
    </div>
  )
}
