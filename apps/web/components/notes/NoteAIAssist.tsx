'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  RotateCcw,
  ChevronDown,
  User,
  Zap,
  HelpCircle,
  BookOpen,
  Target,
  Compass,
  MessageSquare,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MODELS, DEFAULT_MODEL_ID } from '@/lib/ai/models'

// Models available in the note chat picker (free/fast first)
const CHAT_MODELS = MODELS.filter((m) => ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct', 'claude-haiku-4-5-20251001', 'claude-sonnet-4-6'].includes(m.id))

// ── Types ──────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

interface NoteAIAssistProps {
  noteId: string
  noteTitle: string
}

// ── Preset prompts ─────────────────────────────────────────────────────────────

const PRESETS = [
  {
    icon: BookOpen,
    label: 'Summarize',
    prompt: 'Can you give me a clear summary of the key points in this note?',
    color: '#6366f1',
  },
  {
    icon: HelpCircle,
    label: 'Quiz Me',
    prompt: 'Quiz me on this note! Ask me 3 questions to test my understanding.',
    color: '#8b5cf6',
  },
  {
    icon: Target,
    label: 'Knowledge Gaps',
    prompt: "What parts of this note might I find confusing or have gaps in my understanding? What should I make sure I really understand?",
    color: '#ec4899',
  },
  {
    icon: Compass,
    label: 'Study Next',
    prompt: 'Based on this note, what topics should I study next to build on this knowledge?',
    color: '#f59e0b',
  },
  {
    icon: Zap,
    label: 'Simplify',
    prompt: 'Can you explain the main ideas in this note in the simplest way possible, like you\'re explaining to someone who has never heard of this before?',
    color: '#10b981',
  },
  {
    icon: MessageSquare,
    label: 'Real-world Use',
    prompt: 'How does what\'s in this note connect to real life? Give me some interesting examples!',
    color: '#0ea5e9',
  },
]

// ── Markdown-ish renderer (lightweight, no heavy dep) ─────────────────────────
// Renders bold, inline code, and line breaks. Full markdown can be swapped in.

function MessageContent({ content }: { content: string }) {
  // Convert basic markdown to HTML fragments via a simple line-by-line pass
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  const renderInline = (text: string) => {
    // Bold **text** and `code`
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            className="rounded px-1 py-0.5 text-xs font-mono"
            style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}
          >
            {part.slice(1, -1)}
          </code>
        )
      }
      return part
    })
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Numbered list item
    if (/^\d+\.\s/.test(line)) {
      const listItems: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+\.\s/, ''))
        i++
      }
      elements.push(
        <ol key={key++} className="list-decimal list-inside space-y-1 my-2 text-sm">
          {listItems.map((item, idx) => (
            <li key={idx} className="text-muted-foreground">{renderInline(item)}</li>
          ))}
        </ol>
      )
      continue
    }

    // Bullet list
    if (/^[-•]\s/.test(line)) {
      const listItems: string[] = []
      while (i < lines.length && /^[-•]\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^[-•]\s/, ''))
        i++
      }
      elements.push(
        <ul key={key++} className="list-disc list-inside space-y-1 my-2 text-sm">
          {listItems.map((item, idx) => (
            <li key={idx} className="text-muted-foreground">{renderInline(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    // Heading ## or ###
    if (line.startsWith('### ')) {
      elements.push(
        <p key={key++} className="font-bold text-sm mt-3 mb-1" style={{ color: '#a5b4fc' }}>
          {renderInline(line.slice(4))}
        </p>
      )
    } else if (line.startsWith('## ')) {
      elements.push(
        <p key={key++} className="font-bold text-base mt-3 mb-1" style={{ color: '#a5b4fc' }}>
          {renderInline(line.slice(3))}
        </p>
      )
    } else if (line === '') {
      elements.push(<div key={key++} className="h-2" />)
    } else {
      elements.push(
        <p key={key++} className="text-sm leading-relaxed text-muted-foreground">
          {renderInline(line)}
        </p>
      )
    }

    i++
  }

  return <div className="space-y-0.5">{elements}</div>
}

// ── Streaming cursor ───────────────────────────────────────────────────────────

function StreamingCursor() {
  return (
    <span
      className="inline-block w-1.5 h-4 ml-0.5 rounded-sm animate-pulse"
      style={{ background: '#6366f1', verticalAlign: 'middle' }}
    />
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function NoteAIAssist({ noteId, noteTitle }: NoteAIAssistProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPresets, setShowPresets] = useState(true)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID)
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const modelPickerRef = useRef<HTMLDivElement>(null)

  // Close model picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setModelPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    setError(null)
    setShowPresets(false)
    setInput('')

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed }
    const assistantId = crypto.randomUUID()

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', isStreaming: true },
    ])
    setIsLoading(true)

    const history = messages.map((m) => ({ role: m.role, content: m.content }))

    try {
      const controller = new AbortController()
      abortRef.current = controller

      const res = await fetch(`/api/notes/${noteId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history, model: selectedModel }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const json = await res.json() as { error?: string }
        throw new Error(json.error ?? `Request failed (${res.status})`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: 'content' | 'done' | 'error'
              content?: string
              error?: string
            }
            if (event.type === 'content' && event.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + event.content! }
                    : m
                )
              )
            } else if (event.type === 'done') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, isStreaming: false } : m
                )
              )
            } else if (event.type === 'error') {
              throw new Error(event.error ?? 'AI error')
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg)
      setMessages((prev) => prev.filter((m) => m.id !== assistantId))
    } finally {
      setIsLoading(false)
      abortRef.current = null
      // Mark streaming done in case done event wasn't received
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
      )
    }
  }, [isLoading, messages, noteId, selectedModel])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearChat = () => {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
    setShowPresets(true)
    setInput('')
    setIsLoading(false)
  }

  const isEmpty = messages.length === 0

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'rgba(99,102,241,0.04)',
        border: '1px solid rgba(99,102,241,0.18)',
        height: '100%',
        minHeight: '480px',
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(99,102,241,0.12)', background: 'rgba(99,102,241,0.06)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 12px rgba(99,102,241,0.4)' }}
          >
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-none">AI Note Assistant</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-none truncate max-w-[120px]">
              {noteTitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Model picker */}
          <div ref={modelPickerRef} className="relative">
            <button
              onClick={() => setModelPickerOpen((o) => !o)}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc' }}
              title="Select AI model"
            >
              <span className="max-w-[80px] truncate">
                {CHAT_MODELS.find((m) => m.id === selectedModel)?.name ?? 'Model'}
              </span>
              {modelPickerOpen
                ? <ChevronUp className="w-3 h-3" />
                : <ChevronDown className="w-3 h-3" />
              }
            </button>
            {modelPickerOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-50 rounded-xl overflow-hidden shadow-2xl min-w-[200px]"
                style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.3)' }}
              >
                <div className="p-2 space-y-0.5">
                  {CHAT_MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedModel(m.id); setModelPickerOpen(false) }}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors',
                        selectedModel === m.id
                          ? 'text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]'
                      )}
                      style={selectedModel === m.id ? { background: 'rgba(99,102,241,0.15)' } : {}}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{m.name}</p>
                        <p className="text-[10px] opacity-60 truncate">{m.providerLabel} · {m.contextWindow}</p>
                      </div>
                      {m.isFree && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981' }}>
                          FREE
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="px-3 py-2 text-[9px] text-muted-foreground/50" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  Auto-fallback: if primary fails, next model is tried
                </div>
              </div>
            )}
          </div>

          {!isEmpty && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              style={{ border: '1px solid rgba(99,102,241,0.2)' }}
              title="Clear chat"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
        {/* Welcome state */}
        {isEmpty && (
          <div className="flex flex-col items-center text-center py-4 gap-2">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))', border: '1px solid rgba(99,102,241,0.3)' }}
            >
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <p className="font-bold text-sm">Ask me anything about this note!</p>
            <p className="text-xs text-muted-foreground max-w-[220px]">
              I&apos;ve read the whole note and I&apos;m ready to help you understand, practice, and go deeper.
            </p>
          </div>
        )}

        {/* Preset prompts */}
        {showPresets && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1" style={{ background: 'rgba(99,102,241,0.15)' }} />
              <button
                onClick={() => setShowPresets(false)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Quick starts <ChevronDown className="w-3 h-3" />
              </button>
              <div className="h-px flex-1" style={{ background: 'rgba(99,102,241,0.15)' }} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map(({ icon: Icon, label, prompt, color }) => (
                <button
                  key={label}
                  onClick={() => sendMessage(prompt)}
                  disabled={isLoading}
                  className="flex items-center gap-2 text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: `${color}10`,
                    border: `1px solid ${color}30`,
                    color,
                  }}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation messages */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex gap-2.5', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
          >
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={
                msg.role === 'assistant'
                  ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 8px rgba(99,102,241,0.3)' }
                  : { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }
              }
            >
              {msg.role === 'assistant' ? (
                <Bot className="w-3.5 h-3.5 text-white" />
              ) : (
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>

            {/* Bubble */}
            <div
              className={cn('max-w-[85%] rounded-2xl px-4 py-3', msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm')}
              style={
                msg.role === 'user'
                  ? { background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.25))', border: '1px solid rgba(99,102,241,0.3)' }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {msg.role === 'user' ? (
                <p className="text-sm leading-relaxed">{msg.content}</p>
              ) : msg.content ? (
                <div>
                  <MessageContent content={msg.content} />
                  {msg.isStreaming && <StreamingCursor />}
                </div>
              ) : msg.isStreaming ? (
                <div className="flex items-center gap-2 py-1">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ background: '#6366f1', animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">Thinking…</span>
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {/* Error */}
        {error && (
          <div
            className="rounded-xl px-4 py-3 text-xs font-medium text-red-300"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            ⚠️ {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input bar ── */}
      <div
        className="px-4 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(99,102,241,0.12)', background: 'rgba(99,102,241,0.04)' }}
      >
        {/* Show presets toggle when hidden */}
        {!showPresets && !isEmpty && (
          <button
            onClick={() => setShowPresets(true)}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            <Sparkles className="w-3 h-3" />
            Show quick prompts
          </button>
        )}
        <div
          className="flex items-end gap-2 rounded-xl px-3 py-2"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              // Auto-resize
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about this note…"
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent resize-none text-sm placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50 leading-relaxed"
            style={{ minHeight: '24px', maxHeight: '120px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 12px rgba(99,102,241,0.4)' }}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 text-white" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/50 text-center mt-1.5">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
