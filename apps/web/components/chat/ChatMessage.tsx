'use client'

import { Bot, User, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ChatMessage as ChatMessageType } from '@/lib/ai/providers/types'

interface ChatMessageProps {
  message: ChatMessageType & { id: string }
}

interface ContentSegment {
  type: 'text' | 'code'
  content: string
  language?: string
}

function parseContent(raw: string): ContentSegment[] {
  const segments: ContentSegment[] = []
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: raw.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'code', language: match[1] || 'text', content: match[2].trimEnd() })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < raw.length) {
    segments.push({ type: 'text', content: raw.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: raw }]
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Bold **text** and *italic* and `inline code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1 py-0.5 rounded bg-muted text-foreground font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function TextSegment({ content }: { content: string }) {
  const lines = content.split('\n')

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trimStart()

        // Heading
        if (trimmed.startsWith('### ')) {
          return <p key={i} className="font-bold text-base mt-2">{renderInlineMarkdown(trimmed.slice(4))}</p>
        }
        if (trimmed.startsWith('## ')) {
          return <p key={i} className="font-bold text-lg mt-3">{renderInlineMarkdown(trimmed.slice(3))}</p>
        }
        if (trimmed.startsWith('# ')) {
          return <p key={i} className="font-bold text-xl mt-3">{renderInlineMarkdown(trimmed.slice(2))}</p>
        }

        // Bullet
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-muted-foreground">•</span>
              <span>{renderInlineMarkdown(trimmed.slice(2))}</span>
            </div>
          )
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s(.*)/)
        if (numMatch) {
          return (
            <div key={i} className="flex gap-2">
              <span className="shrink-0 text-muted-foreground">{numMatch[1]}.</span>
              <span>{renderInlineMarkdown(numMatch[2])}</span>
            </div>
          )
        }

        // Blank line → spacer
        if (trimmed === '') {
          return <div key={i} className="h-1" />
        }

        return <p key={i}>{renderInlineMarkdown(line)}</p>
      })}
    </div>
  )
}

function CodeBlock({ content, language }: { content: string; language: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden my-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border">
        <span className="text-xs font-mono text-muted-foreground">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto bg-muted/30">
        <code className="font-mono text-sm leading-relaxed">{content}</code>
      </pre>
    </div>
  )
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const segments = parseContent(message.content)

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted border border-border'
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted text-foreground rounded-tl-sm'
        )}
      >
        {segments.map((seg, i) =>
          seg.type === 'code' ? (
            <CodeBlock key={i} content={seg.content} language={seg.language ?? 'text'} />
          ) : (
            <TextSegment key={i} content={seg.content} />
          )
        )}
      </div>
    </div>
  )
}
