'use client'

import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import 'katex/dist/katex.min.css'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        // headings
        'prose-headings:font-bold prose-headings:text-foreground',
        // body text
        'prose-p:text-foreground prose-p:leading-relaxed',
        // code
        'prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:text-foreground',
        'prose-pre:bg-muted prose-pre:rounded-lg prose-pre:overflow-auto',
        // lists
        'prose-li:text-foreground',
        // links
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        // blockquote
        'prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground',
        // table
        'prose-table:text-sm prose-th:text-foreground prose-td:text-foreground',
        // hr
        'prose-hr:border-border',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          // Open links in new tab
          a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
