'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, Send, AlertCircle } from 'lucide-react'
import { useChat } from '@/hooks/useChat'
import { ChatMessage } from './ChatMessage'
import type { UseChatOptions } from '@/hooks/useChat'

interface ChatWindowProps {
  options?: UseChatOptions
  initialMode?: string
}

export function ChatWindow({ options, initialMode }: ChatWindowProps) {
  const chat = useChat(options)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.messages])

  // Create session on mount if needed
  useEffect(() => {
    if (!chat.sessionId && initialMode) {
      chat.createSession(initialMode).catch((err) => {
        console.error('Failed to create session:', err)
      })
    }
  }, [initialMode, chat.sessionId])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const message = inputRef.current?.value.trim()
    if (!message || !inputRef.current) return

    inputRef.current.value = ''
    await chat.sendMessage(message)
  }

  return (
    <div className="flex flex-col h-full bg-background rounded-lg border">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <h2 className="text-lg font-semibold">AI Tutor</h2>
        <p className="text-sm text-muted-foreground">
          {options?.mode ? `Mode: ${options.mode}` : 'General mode'}
        </p>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chat.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-muted-foreground mb-2">
                No messages yet. Start the conversation!
              </p>
            </div>
          </div>
        ) : (
          <>
            {chat.messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {chat.isLoading && (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>AI is thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error Display */}
      {chat.error && (
        <Card className="mx-4 mb-4 p-3 border-destructive bg-destructive/10">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Error</p>
              <p className="text-sm text-destructive/90">{chat.error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Input Area */}
      <div className="border-t bg-card p-4">
        <form onSubmit={handleSendMessage} className="space-y-3">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="Type your message..."
              disabled={chat.isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !chat.isLoading) {
                  e.preventDefault()
                  handleSendMessage(e as any)
                }
              }}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={chat.isLoading || !inputRef.current?.value.trim()}
              size="icon"
            >
              {chat.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
            {chat.isLoading && (
              <Button
                type="button"
                variant="outline"
                onClick={() => chat.cancel()}
              >
                Cancel
              </Button>
            )}
          </div>

          {/* Token Usage Display */}
          {chat.tokensUsed.total > 0 && (
            <div className="text-xs text-muted-foreground">
              Tokens: {chat.tokensUsed.input} input, {chat.tokensUsed.output}{' '}
              output ({chat.tokensUsed.total} total)
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
