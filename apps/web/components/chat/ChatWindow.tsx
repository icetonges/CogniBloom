'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Send, AlertCircle, Brain, Trash2, ChevronDown, ExternalLink } from 'lucide-react'
import { useChat } from '@/hooks/useChat'
import { ChatMessage } from './ChatMessage'
import type { UseChatOptions } from '@/hooks/useChat'
import { cn } from '@/lib/utils'

const MODELS = [
  { id: 'gemini-2.0-flash',                  label: 'Gemini Flash',   provider: 'Google'    },
  { id: 'gemini-2.5-flash-preview-05-20',    label: 'Gemini 2.5',     provider: 'Google'    },
  { id: 'claude-haiku-4-5',                  label: 'Claude Haiku',   provider: 'Anthropic' },
  { id: 'llama-3.3-70b-versatile',           label: 'Llama 3.3 70B',  provider: 'Groq'      },
]

interface ChatWindowProps {
  options?: UseChatOptions
  initialMode?: string
  resumeSessionId?: string
}

function getPreferredModel(): string {
  try {
    const stored = localStorage.getItem('cognibloom_settings')
    if (stored) {
      const parsed = JSON.parse(stored) as { preferredModel?: string }
      if (MODELS.find((m) => m.id === parsed.preferredModel)) return parsed.preferredModel!
    }
  } catch { /* ignore */ }
  return MODELS[0].id
}

const QUICK_PROMPTS = [
  'Explain quadratic equations',
  'Help me with Python loops',
  'What is photosynthesis?',
  'How does gravity work?',
]

export function ChatWindow({ options, initialMode, resumeSessionId }: ChatWindowProps) {
  const [selectedModel, setSelectedModel] = useState(() =>
    typeof window !== 'undefined' ? getPreferredModel() : MODELS[0].id
  )
  const [isLoadingHistory, setIsLoadingHistory] = useState(!!resumeSessionId)
  const chat = useChat({ ...options, model: selectedModel, mode: initialMode ?? options?.mode })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.messages])

  useEffect(() => {
    if (resumeSessionId) {
      setIsLoadingHistory(true)
      chat.loadSession(resumeSessionId).catch(() => {}).finally(() => setIsLoadingHistory(false))
    }
  }, [resumeSessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!resumeSessionId && !chat.sessionId && initialMode) {
      chat.createSession(initialMode).catch(() => {})
    }
  }, [initialMode, chat.sessionId, resumeSessionId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div
      className="flex flex-col h-full rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0 border-b"
        style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-foreground">AI Tutor</span>
          {chat.ragUsed && (
            <span
              className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}
            >
              <Brain className="w-3 h-3" /> Using your notes
            </span>
          )}
          {chat.groundingSources.length > 0 && (
            <span
              className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.25)' }}
            >
              <ExternalLink className="w-3 h-3" /> Web grounded
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Model selector */}
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="appearance-none text-xs rounded-lg pl-2.5 pr-6 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'inherit',
              }}
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label} ({m.provider})</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>

          {chat.messages.length > 0 && (
            <button
              onClick={chat.clearMessages}
              title="Clear chat"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {isLoadingHistory ? (
          <div className="h-full flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading conversation…</span>
          </div>
        ) : chat.messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-4 max-w-sm px-4">
              <div
                className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1))',
                  border: '1px solid rgba(99,102,241,0.2)',
                }}
              >
                🎓
              </div>
              <div>
                <p className="font-bold text-lg">What would you like to learn?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ask anything — maths, coding, science, language.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center pt-1">
                {QUICK_PROMPTS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      if (textareaRef.current) {
                        textareaRef.current.value = s
                        autoResize()
                        textareaRef.current.focus()
                      }
                    }}
                    className="text-xs px-3 py-1.5 rounded-full font-medium transition-all hover:scale-105"
                    style={{
                      background: 'rgba(99,102,241,0.1)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      color: '#a5b4fc',
                    }}
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

            {/* Grounding sources */}
            {!chat.isLoading && chat.groundingSources.length > 0 && (
              <div className="pl-10">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Brain className="w-3 h-3" /> Sources from Google Search
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {chat.groundingSources.map((src, i) => (
                    <a
                      key={i}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-all hover:scale-[1.02] max-w-[220px]"
                      style={{ background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{src.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Thinking indicator */}
            {chat.isLoading && (
              <div className="flex gap-3 items-end">
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-muted border border-white/[0.08]">
                  <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                </div>
                <div
                  className="px-4 py-3 rounded-2xl rounded-bl-sm text-sm text-muted-foreground"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* ── Error ── */}
      {chat.error && (
        <div
          className="mx-4 mb-2 p-3 rounded-xl flex items-start gap-2"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{chat.error}</p>
        </div>
      )}

      {/* ── Input ── */}
      <div
        className="shrink-0 border-t p-3"
        style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Ask anything… (Enter to send, Shift+Enter for new line)"
            disabled={chat.isLoading}
            onChange={autoResize}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            className={cn(
              'flex-1 resize-none rounded-xl px-4 py-2.5 text-sm',
              'placeholder:text-muted-foreground/60 focus:outline-none',
              'max-h-40 overflow-y-auto disabled:opacity-50 transition-all'
            )}
            style={{
              height: '44px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.09)',
              color: 'inherit',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none' }}
          />

          <div className="flex flex-col gap-1.5">
            <button
              type="submit"
              disabled={chat.isLoading}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white transition-all hover:scale-105 disabled:opacity-50 shrink-0"
              style={{
                background: chat.isLoading ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: chat.isLoading ? 'none' : '0 4px 16px rgba(99,102,241,0.4)',
              }}
            >
              {chat.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
            {chat.isLoading && (
              <button
                type="button"
                onClick={chat.cancel}
                className="h-6 text-xs font-semibold rounded-lg px-2 transition-colors text-muted-foreground hover:text-foreground"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                Stop
              </button>
            )}
          </div>
        </form>

        {chat.tokensUsed.total > 0 && (
          <p className="text-[10px] text-muted-foreground/60 mt-1.5 ml-1">
            {chat.tokensUsed.total.toLocaleString()} tokens
            {chat.ragUsed && ' · grounded with your notes'}
            {chat.groundingSources.length > 0 && ` · ${chat.groundingSources.length} web source${chat.groundingSources.length !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>
    </div>
  )
}
