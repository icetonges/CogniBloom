'use client'

import { useCallback, useRef, useState } from 'react'
import type { ChatMessage } from '@/lib/ai/providers/types'

export interface GroundingSource {
  uri: string
  title: string
}

export interface ChatState {
  messages: Array<ChatMessage & { id: string }>
  isLoading: boolean
  error: string | null
  sessionId: string | null
  ragUsed: boolean
  tokensUsed: { input: number; output: number; total: number }
  groundingSources: GroundingSource[]
}

export interface UseChatOptions {
  sessionId?: string
  mode?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

interface StreamChunkData {
  type: 'content' | 'done'
  content?: string
  sessionId?: string
  ragUsed?: boolean
  tokensUsed?: { input: number; output: number; total: number }
  groundingSources?: GroundingSource[]
}

export function useChat(options: UseChatOptions = {}) {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
    sessionId: options.sessionId || null,
    ragUsed: false,
    tokensUsed: { input: 0, output: 0, total: 0 },
    groundingSources: [],
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return

      const userMessage: ChatMessage & { id: string } = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: message,
      }

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isLoading: true,
        error: null,
        ragUsed: false,
        groundingSources: [],
      }))

      abortControllerRef.current = new AbortController()

      try {
        const messagesForApi = state.messages
          .filter((m) => m.role !== 'system')
          .concat(userMessage)
          .map(({ id: _id, ...m }) => m)

        const response = await fetch('/api/tutor/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: state.sessionId,
            messages: messagesForApi,
            model: options.model,
            mode: options.mode,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) throw new Error(`API error: ${response.statusText}`)
        if (!response.body) throw new Error('No response body')

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let assistantContent = ''
        let newSessionId = state.sessionId

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            for (const line of chunk.split('\n')) {
              if (!line.startsWith('data: ')) continue
              const data: StreamChunkData = JSON.parse(line.slice(6))

              if (data.type === 'content' && data.content) {
                assistantContent += data.content
                setState((prev) => {
                  const messages = [...prev.messages]
                  const last = messages[messages.length - 1]
                  if (last?.role === 'assistant') {
                    last.content = assistantContent
                  } else {
                    messages.push({ id: `msg-${Date.now()}`, role: 'assistant', content: assistantContent })
                  }
                  return { ...prev, messages }
                })
              } else if (data.type === 'done') {
                if (data.sessionId) newSessionId = data.sessionId
                setState((prev) => ({
                  ...prev,
                  sessionId: newSessionId,
                  ragUsed: data.ragUsed ?? false,
                  tokensUsed: data.tokensUsed ?? prev.tokensUsed,
                  groundingSources: data.groundingSources ?? [],
                  isLoading: false,
                }))
              }
            }
          }
        } finally {
          reader.releaseLock()
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error
            ? error.name === 'AbortError' ? 'Message cancelled' : error.message
            : 'An unknown error occurred',
          isLoading: false,
        }))
      }
    },
    [state.messages, state.sessionId, options]
  )

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
    setState((prev) => ({ ...prev, isLoading: false }))
  }, [])

  const clearMessages = useCallback(() => {
    setState((prev) => ({ ...prev, messages: [], error: null, ragUsed: false, groundingSources: [] }))
  }, [])

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/tutor/sessions/${sessionId}?messages=true`)
      if (!res.ok) throw new Error('Failed to load session')
      const { data } = await res.json()
      setState((prev) => ({
        ...prev,
        sessionId,
        messages: (data.messages || []).map((msg: { role: string; content: string }, idx: number) => ({
          id: `msg-${idx}`,
          role: msg.role,
          content: msg.content,
        })),
      }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `Failed to load session: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }))
    }
  }, [])

  const createSession = useCallback(async (mode: string) => {
    const res = await fetch('/api/tutor/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
    if (!res.ok) throw new Error('Failed to create session')
    const { data } = await res.json()
    setState((prev) => ({ ...prev, sessionId: data.id }))
    return data.id
  }, [])

  return { ...state, sendMessage, cancel, clearMessages, loadSession, createSession }
}
