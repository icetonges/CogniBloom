'use client'

import { useEffect, useRef, useState } from 'react'
import { ChatWindow } from './ChatWindow'
import { formatDistanceToNow } from 'date-fns'
import {
  BookOpen, Calculator, Code2, Globe, Beaker,
  HelpCircle, Brain, Trophy, History, ChevronRight, Plus, RotateCcw, GitCompare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ModelCompare } from './ModelCompare'

const TUTOR_MODES = [
  { id: 'GENERAL',         name: 'General Chat',   desc: 'Ask questions on any topic',      icon: BookOpen,   iconColor: '#3b82f6', gradientCss: 'linear-gradient(135deg,#3b82f6,#6366f1)', glow: 'rgba(59,130,246,0.35)',  bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)'  },
  { id: 'MATH',            name: 'Math Tutor',     desc: 'Get help with mathematics',        icon: Calculator, iconColor: '#10b981', gradientCss: 'linear-gradient(135deg,#10b981,#0d9488)', glow: 'rgba(16,185,129,0.35)',  bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)'  },
  { id: 'CODING',          name: 'Code Assistant', desc: 'Learn programming concepts',       icon: Code2,      iconColor: '#8b5cf6', gradientCss: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', glow: 'rgba(139,92,246,0.35)',  bg: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.25)'  },
  { id: 'LANGUAGE',        name: 'Language Tutor', desc: 'Improve your language skills',     icon: Globe,      iconColor: '#06b6d4', gradientCss: 'linear-gradient(135deg,#06b6d4,#0284c7)', glow: 'rgba(6,182,212,0.35)',   bg: 'rgba(6,182,212,0.1)',   border: 'rgba(6,182,212,0.25)'   },
  { id: 'SCIENCE',         name: 'Science Tutor',  desc: 'Explore scientific concepts',      icon: Beaker,     iconColor: '#f97316', gradientCss: 'linear-gradient(135deg,#f97316,#f59e0b)', glow: 'rgba(249,115,22,0.35)',  bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.25)'  },
  { id: 'HOMEWORK_HELPER', name: 'Homework Help',  desc: 'Get guidance on assignments',      icon: HelpCircle, iconColor: '#eab308', gradientCss: 'linear-gradient(135deg,#eab308,#f97316)', glow: 'rgba(234,179,8,0.35)',   bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.25)'   },
  { id: 'SOCRATIC_COACH',  name: 'Socratic Coach', desc: 'Learn through questioning',        icon: Brain,      iconColor: '#ec4899', gradientCss: 'linear-gradient(135deg,#ec4899,#be185d)', glow: 'rgba(236,72,153,0.35)',  bg: 'rgba(236,72,153,0.1)',  border: 'rgba(236,72,153,0.25)'  },
  { id: 'QUIZ',            name: 'Quiz Master',    desc: 'Test your knowledge',              icon: Trophy,     iconColor: '#f59e0b', gradientCss: 'linear-gradient(135deg,#f59e0b,#d97706)', glow: 'rgba(245,158,11,0.35)',  bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)'  },
]

interface Session {
  id: string
  mode: string
  topic: string | null
  messageCount: number
  createdAt: string
}

export function ChatPage() {
  const [selectedMode, setSelectedMode] = useState<string | null>(null)
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const chatKey = useRef(0)

  useEffect(() => {
    fetch('/api/tutor/sessions?limit=8')
      .then((r) => r.json())
      .then(({ data }) => { if (Array.isArray(data)) setSessions(data as Session[]) })
      .catch(() => {})
  }, [])

  const startMode = (modeId: string) => {
    chatKey.current += 1
    setResumeSessionId(null)
    setSelectedMode(modeId)
  }

  const resumeSession = (session: Session) => {
    chatKey.current += 1
    setResumeSessionId(session.id)
    setSelectedMode(session.mode)
  }

  const handleBack = () => {
    setSelectedMode(null)
    setResumeSessionId(null)
  }

  // ── Compare-models view ────────────────────────────────────────────────────
  if (compareOpen) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
            <GitCompare className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-foreground">Compare Models</span>
          <button
            onClick={() => setCompareOpen(false)}
            className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold text-muted-foreground hover:text-foreground transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            ← Back
          </button>
        </div>
        <ModelCompare />
      </div>
    )
  }

  // ── Active chat view ───────────────────────────────────────────────────────
  if (selectedMode) {
    const modeInfo = TUTOR_MODES.find((m) => m.id === selectedMode)
    const isResuming = resumeSessionId !== null
    const Icon = modeInfo?.icon ?? BookOpen

    return (
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Chat header bar */}
        <div
          className="flex items-center gap-3 pb-3 mb-3 shrink-0 border-b border-white/[0.06]"
        >
          {modeInfo && (
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: modeInfo.gradientCss,
                boxShadow: `0 0 14px ${modeInfo.glow}`,
              }}
            >
              <Icon className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="font-bold text-foreground">{modeInfo?.name}</span>
          {isResuming && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}
            >
              resuming
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {isResuming && (
              <button
                onClick={() => startMode(selectedMode)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold text-muted-foreground hover:text-foreground transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            )}
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold text-muted-foreground hover:text-foreground transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              ← Back
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <ChatWindow
            key={chatKey.current}
            initialMode={selectedMode}
            resumeSessionId={resumeSessionId ?? undefined}
          />
        </div>
      </div>
    )
  }

  // ── Mode selection view ────────────────────────────────────────────────────
  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-1">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">AI Tutor</span>
            {' '}🎓
          </h1>
          <p className="text-muted-foreground">Choose a mode to start learning.</p>
        </div>
        <button
          onClick={() => setCompareOpen(true)}
          className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all hover:scale-[1.03]"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc' }}
        >
          <GitCompare className="w-4 h-4" /> Compare Models
        </button>
      </div>

      {/* Mode grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {TUTOR_MODES.map((mode) => {
          const Icon = mode.icon
          return (
            <button
              key={mode.id}
              onClick={() => startMode(mode.id)}
              className="group text-left rounded-2xl p-5 transition-all duration-200 hover:scale-[1.03] hover:-translate-y-1"
              style={{
                background: mode.bg,
                border: `1px solid ${mode.border}`,
                boxShadow: `0 4px 24px ${mode.glow.replace('0.35', '0.08')}`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${mode.glow}`
                ;(e.currentTarget as HTMLElement).style.borderColor = mode.border.replace('0.25', '0.5')
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 24px ${mode.glow.replace('0.35', '0.08')}`
                ;(e.currentTarget as HTMLElement).style.borderColor = mode.border
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{
                  background: mode.bg.replace('0.1)', '0.25)'),
                  border: `1px solid ${mode.border}`,
                  boxShadow: `0 0 14px ${mode.glow.replace('0.35', '0.2')}`,
                }}
              >
                <Icon className="w-5 h-5" style={{ color: mode.iconColor }} />
              </div>
              <h3 className="font-bold text-sm text-foreground mb-1">{mode.name}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{mode.desc}</p>
              <div className="flex items-center text-xs font-semibold mt-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: mode.iconColor }}>
                Start <ChevronRight className="w-3 h-3 ml-0.5" />
              </div>
            </button>
          )
        })}
      </div>

      {/* Session history */}
      {sessions.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <History className="w-4 h-4" />
            Recent Sessions ({sessions.length})
            <ChevronRight className={cn('w-4 h-4 transition-transform', showHistory && 'rotate-90')} />
          </button>

          {showHistory && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sessions.map((s) => {
                const modeInfo = TUTOR_MODES.find((m) => m.id === s.mode)
                const Icon = modeInfo?.icon ?? BookOpen
                return (
                  <div
                    key={s.id}
                    className="group rounded-2xl p-4 transition-all hover:scale-[1.02]"
                    style={{
                      background: modeInfo ? modeInfo.bg : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${modeInfo ? modeInfo.border : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: modeInfo?.bg.replace('0.1', '0.25') ?? 'rgba(255,255,255,0.08)', border: `1px solid ${modeInfo?.border ?? 'rgba(255,255,255,0.1)'}` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: modeInfo?.iconColor ?? 'currentColor' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{modeInfo?.name ?? s.mode}</p>
                        {s.topic && <p className="text-xs text-muted-foreground truncate">{s.topic}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          {s.messageCount} msg{s.messageCount !== 1 ? 's' : ''} · {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <button
                        onClick={() => resumeSession(s)}
                        title="Resume"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
