'use client'

import { Card } from '@/components/ui/card'
import { Bot, User } from 'lucide-react'
import type { ChatMessage as ChatMessageType } from '@/lib/ai/providers/types'

interface ChatMessageProps {
  message: ChatMessageType & { id: string }
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={`flex ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      <Card
        className={`max-w-[80%] ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        }`}
      >
        <div className="flex items-start gap-3 p-4">
          {!isUser && (
            <Bot className="h-5 w-5 flex-shrink-0 mt-0.5" />
          )}

          <div className="flex-1 space-y-1">
            {isUser && (
              <p className="text-xs font-semibold opacity-75">
                You
              </p>
            )}
            <p className="text-sm leading-relaxed break-words">
              {message.content}
            </p>
          </div>

          {isUser && (
            <User className="h-5 w-5 flex-shrink-0 mt-0.5" />
          )}
        </div>
      </Card>
    </div>
  )
}
