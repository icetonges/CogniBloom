'use client'

import { useCallback, useRef, useState } from 'react'
import type { ChatMessage } from '@/lib/ai/providers/types'

export interface ChatState {
  messages: Array<ChatMessage & { id: string }>
  isLoading: boolean
  error: string | null
  sessionId: string | null
  tokensUsed: {
    input: number
    output: number
    total: number
  }
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
  tokensUsed?: {
    input: number
    output: number
    total: number
  }
}

export function useChat(options: UseChatOptions = {}) {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
    sessionId: options.sessionId || null,
    tokensUsed: {
      input: 0,
      output: 0,
      total: 0,
    },
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  // Send a message and stream the response
  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) {
        return
      }

      // Add user message to state
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
      }))

      abortControllerRef.current = new AbortController()

      try {
        // Prepare request
        const messagesForApi = state.messages
          .filter((m) => m.role !== 'system')
          .concat(userMessage)
          .map(({ id, ...m }) => m)

        const requestBody = {
          sessionId: state.sessionId,
          messages: messagesForApi,
          model: options.model,
          mode: options.mode,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
        }

        // Make streaming request
        const response = await fetch('/api/tutor/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`)
        }

        if (!response.body) {
          throw new Error('No response body')
        }

        // Stream response
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let assistantContent = ''
        let newSessionId = state.sessionId

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data: StreamChunkData = JSON.parse(line.slice(6))

                if (data.type === 'content' && data.content) {
                  assistantContent += data.content

                  setState((prev) => {
                    const messages = [...prev.messages]
                    const lastMessage = messages[messages.length - 1]

                    if (
                      lastMessage &&
                      lastMessage.role === 'assistant'
                    ) {
                      lastMessage.content = assistantContent
                    } else {
                      messages.push({
                        id: `msg-${Date.now()}`,
                        role: 'assistant',
                        content: assistantContent,
                      })
                    }

                    return {
                      ...prev,
                      messages,
                    }
                  })
                } else if (data.type === 'done') {
                  if (data.sessionId) {
                    newSessionId = data.sessionId
                  }

                  if (data.tokensUsed) {
                    setState((prev) => ({
                      ...prev,
                      sessionId: newSessionId,
                      tokensUsed: data.tokensUsed!,
                      isLoading: false,
                    }))
                  }
                }
              }
            }
          }
        } finally {
          reader.releaseLock()
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            setState((prev) => ({
              ...prev,
              error: 'Message cancelled',
              isLoading: false,
            }))
          } else {
            setState((prev) => ({
              ...prev,
              error: error.message,
              isLoading: false,
            }))
          }
        } else {
          setState((prev) => ({
            ...prev,
            error: 'An unknown error occurred',
            isLoading: false,
          }))
        }
      }
    },
    [state.messages, state.sessionId, options]
  )

  // Cancel current message
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setState((prev) => ({
        ...prev,
        isLoading: false,
      }))
    }
  }, [])

  // Clear messages
  const clearMessages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [],
      error: null,
    }))
  }, [])

  // Load session messages
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(
        `/api/tutor/sessions/${sessionId}?messages=true`
      )
      if (!response.ok) {
        throw new Error('Failed to load session')
      }

      const { data } = await response.json()
      const messages = (data.messages || []).map((msg: any, idx: number) => ({
        id: `msg-${idx}`,
        role: msg.role,
        content: msg.content,
      }))

      setState((prev) => ({
        ...prev,
        sessionId,
        messages,
      }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `Failed to load session: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }))
    }
  }, [])

  // Create new session
  const createSession = useCallback(async (mode: string) => {
    try {
      const response = await fetch('/api/tutor/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode }),
      })

      if (!response.ok) {
        throw new Error('Failed to create session')
      }

      const { data } = await response.json()
      setState((prev) => ({
        ...prev,
        sessionId: data.id,
      }))

      return data.id
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error'
      setState((prev) => ({
        ...prev,
        error: `Failed to create session: ${message}`,
      }))
      throw error
    }
  }, [])

  return {
    ...state,
    sendMessage,
    cancel,
    clearMessages,
    loadSession,
    createSession,
  }
}
