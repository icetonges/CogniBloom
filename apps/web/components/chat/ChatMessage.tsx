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
  const re = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(raw)) !== null) {
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

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**'))
      return <strong key={i} className="font-bold">{p.slice(2, -2)}</strong>
    if (p.startsWith('*') && p.endsWith('*'))
      return <em key={i}>{p.slice(1, -1)}</em>
    if (p.startsWith('`') && p.endsWith('`'))
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-black/20 dark:bg-white/10 font-mono text-[0.82em] text-foreground">
          {p.slice(1, -1)}
        </code>
      )
    return <span key={i}>{p}</span>
  })
}

function TextSegment({ content, isUser }: { content: string; isUser: boolean }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-1 leading-relaxed">
      {lines.map((line, i) => {
        const t = line.trimStart()
        if (t.startsWith('### ')) return <p key={i} className="font-bold text-base mt-2">{renderInline(t.slice(4))}</p>
        if (t.startsWith('## '))  return <p key={i} className="font-bold text-lg mt-3">{renderInline(t.slice(3))}</p>
        if (t.startsWith('# '))   return <p key={i} className="font-bold text-xl mt-3">{renderInline(t.slice(2))}</p>
        if (t.startsWith('- ') || t.startsWith('* '))
          return (
            <div key={i} className="flex gap-2">
              <span className={cn('mt-1 shrink-0 text-xs', isUser ? 'text-white/70' : 'text-muted-foreground')}>•</span>
              <span>{renderInline(t.slice(2))}</span>
            </div>
          )
        const nm = t.match(/^(\d+)\.\s(.*)/)
        if (nm)
          return (
            <div key={i} className="flex gap-2">
              <span className={cn('shrink-0 text-xs font-bold', isUser ? 'text-white/70' : 'text-muted-foreground')}>{nm[1]}.</span>
              <span>{renderInline(nm[2])}</span>
            </div>
          )
        if (t === '') return <div key={i} className="h-1" />
        return <p key={i}>{renderInline(line)}</p>
      })}
    </div>
  )
}

function CodeBlock({ content, language }: { content: string; language: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl overflow-hidden my-2 border border-white/[0.08]" style={{ background: '#0d1117' }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]" style={{ background: '#161b22' }}>
        <span className="text-xs font-mono text-slate-400">{language || 'code'}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className="font-mono text-[13px] leading-relaxed text-slate-300">{content}</code>
      </pre>
    </div>
  )
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const segments = parseContent(message.content)

  return (
    <div className={cn('flex gap-3 items-end', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mb-0.5',
          isUser
            ? 'bg-gradient-to-br from-primary to-secondary shadow-[0_0_12px_rgba(99,102,241,0.4)]'
            : 'bg-muted border border-white/[0.08]'
        )}
      >
        {isUser
          ? <User className="w-3.5 h-3.5 text-white" />
          : <Bot className="w-3.5 h-3.5 text-muted-foreground" />
        }
      </div>

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
          isUser ? 'rounded-br-sm' : 'rounded-bl-sm'
        )}
        style={
          isUser
            ? {
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white',
                boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
              }
            : {
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'inherit',
              }
        }
      >
        {segments.map((seg, i) =>
          seg.type === 'code' ? (
            <CodeBlock key={i} content={seg.content} language={seg.language ?? 'text'} />
          ) : (
            <TextSegment key={i} content={seg.content} isUser={isUser} />
          )
        )}
      </div>
    </div>
  )
}
