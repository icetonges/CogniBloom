'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChatWindow } from './ChatWindow'
import { formatDistanceToNow } from 'date-fns'
import {
  BookOpen, Calculator, Code2, Globe, Beaker,
  HelpCircle, Brain, Trophy, History, ChevronRight, Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const TUTOR_MODES = [
  { id: 'GENERAL',          name: 'General Chat',    desc: 'Ask questions on any topic',      icon: BookOpen,    color: 'text-blue-500',   bg: 'bg-blue-500/10'   },
  { id: 'MATH',             name: 'Math Tutor',      desc: 'Get help with mathematics',        icon: Calculator,  color: 'text-green-500',  bg: 'bg-green-500/10'  },
  { id: 'CODING',           name: 'Code Assistant',  desc: 'Learn programming concepts',       icon: Code2,       color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { id: 'LANGUAGE',         name: 'Language Tutor',  desc: 'Improve your language skills',     icon: Globe,       color: 'text-cyan-500',   bg: 'bg-cyan-500/10'   },
  { id: 'SCIENCE',          name: 'Science Tutor',   desc: 'Explore scientific concepts',      icon: Beaker,      color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'HOMEWORK_HELPER',  name: 'Homework Help',   desc: 'Get guidance on assignments',      icon: HelpCircle,  color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { id: 'SOCRATIC_COACH',   name: 'Socratic Coach',  desc: 'Learn through questioning',        icon: Brain,       color: 'text-pink-500',   bg: 'bg-pink-500/10'   },
  { id: 'QUIZ',             name: 'Quiz Master',     desc: 'Test your knowledge',              icon: Trophy,      color: 'text-amber-500',  bg: 'bg-amber-500/10'  },
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
  const [sessions, setSessions] = useState<Session[]>([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    fetch('/api/tutor/sessions?limit=6')
      .then((r) => r.json())
      .then(({ data }) => { if (Array.isArray(data)) setSessions(data as Session[]) })
      .catch(() => {})
  }, [])

  if (selectedMode) {
    const modeInfo = TUTOR_MODES.find((m) => m.id === selectedMode)
    return (
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        <div className="flex items-center gap-3 pb-3 border-b mb-3 shrink-0">
          {modeInfo && (
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', modeInfo.bg)}>
              <modeInfo.icon className={cn('w-4 h-4', modeInfo.color)} />
            </div>
          )}
          <span className="font-semibold">{modeInfo?.name}</span>
          <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={() => setSelectedMode(null)}>
            <Plus className="w-3.5 h-3.5" /> New session
          </Button>
        </div>
        <div className="flex-1 min-h-0">
          <ChatWindow initialMode={selectedMode} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">AI Tutor 🎓</h1>
        <p className="text-muted-foreground">Choose a mode or continue a recent session.</p>
      </div>

      {/* Mode grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {TUTOR_MODES.map((mode) => {
          const Icon = mode.icon
          return (
            <Card
              key={mode.id}
              className="p-4 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
              onClick={() => setSelectedMode(mode.id)}
            >
              <div className="space-y-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', mode.bg)}>
                  <Icon className={cn('w-5 h-5', mode.color)} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{mode.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{mode.desc}</p>
                </div>
                <div className="flex items-center text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Start <ChevronRight className="w-3 h-3 ml-0.5" />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Recent sessions */}
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
                  <Card
                    key={s.id}
                    className="p-3 cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => setSelectedMode(s.mode)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', modeInfo?.bg ?? 'bg-muted')}>
                        <Icon className={cn('w-4 h-4', modeInfo?.color ?? 'text-muted-foreground')} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{modeInfo?.name ?? s.mode}</p>
                        {s.topic && <p className="text-xs text-muted-foreground truncate">{s.topic}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {s.messageCount} msg{s.messageCount !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
