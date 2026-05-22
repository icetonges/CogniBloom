'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChatWindow } from './ChatWindow'
import {
  BookOpen,
  Calculator,
  Code2,
  Globe,
  Beaker,
  HelpCircle,
  Brain,
  Trophy,
} from 'lucide-react'

const TUTOR_MODES = [
  {
    id: 'GENERAL',
    name: 'General Chat',
    description: 'Ask questions on any topic',
    icon: BookOpen,
  },
  {
    id: 'MATH',
    name: 'Math Tutor',
    description: 'Get help with mathematics',
    icon: Calculator,
  },
  {
    id: 'CODING',
    name: 'Code Assistant',
    description: 'Learn programming concepts',
    icon: Code2,
  },
  {
    id: 'LANGUAGE',
    name: 'Language Tutor',
    description: 'Improve your language skills',
    icon: Globe,
  },
  {
    id: 'SCIENCE',
    name: 'Science Tutor',
    description: 'Explore scientific concepts',
    icon: Beaker,
  },
  {
    id: 'HOMEWORK_HELPER',
    name: 'Homework Help',
    description: 'Get guidance on assignments',
    icon: HelpCircle,
  },
  {
    id: 'SOCRATIC_COACH',
    name: 'Socratic Coach',
    description: 'Learn through questioning',
    icon: Brain,
  },
  {
    id: 'QUIZ',
    name: 'Quiz Master',
    description: 'Test your knowledge',
    icon: Trophy,
  },
]

interface ChatPageProps {
  onModeChange?: (mode: string) => void
}

export function ChatPage({ onModeChange }: ChatPageProps) {
  const [selectedMode, setSelectedMode] = useState<string | null>(null)

  const handleModeSelect = (mode: string) => {
    setSelectedMode(mode)
    onModeChange?.(mode)
  }

  if (selectedMode) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            {TUTOR_MODES.find((m) => m.id === selectedMode)?.name}
          </h1>
          <Button
            variant="outline"
            onClick={() => setSelectedMode(null)}
          >
            Change Mode
          </Button>
        </div>
        <div className="flex-1">
          <ChatWindow initialMode={selectedMode} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">AI Tutor</h1>
        <p className="text-muted-foreground">
          Choose a tutor mode to get started
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {TUTOR_MODES.map((mode) => {
          const Icon = mode.icon
          return (
            <Card
              key={mode.id}
              className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleModeSelect(mode.id)}
            >
              <div className="space-y-3">
                <div className="p-3 bg-primary/10 w-fit rounded-lg">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{mode.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {mode.description}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleModeSelect(mode.id)
                  }}
                >
                  Start
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
