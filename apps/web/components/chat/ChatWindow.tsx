'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Send, AlertCircle, Brain, Trash2, ChevronDown, ExternalLink } from 'lucide-react'
import { useChat } from '@/hooks/useChat'
import { ChatMessage } from './ChatMessage'
import type { UseChatOptions } from '@/hooks/useChat'
import { cn } from '@/lib/utils'

const MODELS = [
  { id: 'gemini-2.0-flash', label: 'Gemini Flash', provider: 'Google' },
  { id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5', provider: 'Google' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku', provider: 'Anthropic' },
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', provider: 'Groq' },
]

interface ChatWindowProps {
  options?: UseChatOptions
  initialMode?: string
}

function getPreferredModel(): string {
  try {
    const stored = localStorage.getItem('cognibloom_settings')
    if (stored) {
      const parsed = JSON.parse(stored) as { preferredModel?: string }
      const found = MODELS.find((m) => m.id === parsed.preferredModel)
      if (found) return found.id
    }
  } catch { /* ignore */ }
  return MODELS[0].id
}

export function ChatWindow({ options, initialMode }: ChatWindowProps) {
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== 'undefined') return getPreferredModel()
    return MODELS[0].id
  })
  const chat = useChat({ ...options, model: selectedModel, mode: initialMode ?? options?.mode })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.messages])

  useEffect(() => {
    if (!chat.sessionId && initialMode) {
      chat.createSession(initialMode).catch(() => {})
    }
  }, [initialMode, chat.sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const msg = textareaRef.current?.value.trim()
    if (!msg || chat.isLoading) return
    if (textareaRef.current) textareaRef.current.value = ''
    autoResize()
    await chat.sendMessage(msg)
  }

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  return (
    <div className="flex flex-col h-full bg-background rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold">AI Tutor</span>
          {chat.ragUsed && (
            <span className="flex items-center gap-1 text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">
              <Brain className="w-3 h-3" />
              Using your notes
            </span>
          )}
          {chat.groundingSources.length > 0 && (
            <span className="flex items-center gap-1 text-xs bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
              <ExternalLink className="w-3 h-3" />
              Web grounded
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Model selector */}
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="appearance-none text-xs bg-muted text-foreground border border-border rounded-lg pl-2 pr-6 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.provider})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>
          {chat.messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={chat.clearMessages} title="Clear chat">
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chat.messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-3 max-w-sm">
              <div className="text-4xl">🎓</div>
              <p className="font-semibold text-lg">What would you like to learn?</p>
              <p className="text-sm text-muted-foreground">
                Ask me anything — maths, coding, science, language. I&apos;ll use your notes for context.
              </p>
              <div className="flex flex-wrap gap-2 justify-center pt-2">
                {['Explain quadratic equations', 'Help me with Python loops', 'What is photosynthesis?'].map((s) => (
                  <button
                    key={s}
                    onClick={() => { if (textareaRef.current) { textareaRef.current.value = s; autoResize(); textareaRef.current.focus() } }}
                    className="text-xs bg-muted hover:bg-muted/80 text-muted-foreground px-3 py-1.5 rounded-full transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {chat.messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {!chat.isLoading && chat.groundingSources.length > 0 && (
              <div className="pl-1">
                <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Brain className="w-3 h-3" /> Sources from Google Search
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {chat.groundingSources.map((src, i) => (
                    <a
                      key={i}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full hover:bg-blue-500/20 transition-colors max-w-[220px]"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{src.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            {chat.isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error */}
      {chat.error && (
        <div className="mx-4 mb-2 p-3 rounded-lg border border-destructive/40 bg-destructive/10 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{chat.error}</p>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-card p-3">
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Ask anything..."
            disabled={chat.isLoading}
            onChange={autoResize}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            className={cn(
              'flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm',
              'placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
              'max-h-40 overflow-y-auto disabled:opacity-50 transition-colors'
            )}
            style={{ height: '40px' }}
          />
          <div className="flex flex-col gap-1">
            <Button type="submit" size="icon" disabled={chat.isLoading} className="h-10 w-10 shrink-0">
              {chat.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
            {chat.isLoading && (
              <Button type="button" variant="outline" size="sm" onClick={chat.cancel} className="text-xs h-7">
                Stop
              </Button>
            )}
          </div>
        </form>
        {chat.tokensUsed.total > 0 && (
          <p className="text-xs text-muted-foreground mt-1.5 ml-1">
            {chat.tokensUsed.total.toLocaleString()} tokens used
            {chat.ragUsed && ' · grounded with your notes'}
            {chat.groundingSources.length > 0 && ` · ${chat.groundingSources.length} web source${chat.groundingSources.length !== 1 ? 's' : ''}`}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5 ml-1">
          Shift+Enter for new line · Enter to send
        </p>
      </div>
    </div>
  )
}
