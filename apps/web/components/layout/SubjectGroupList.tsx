'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronRight, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SubjectCount { subject: string; count: number }

export function SubjectGroupList() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [subjects, setSubjects] = useState<SubjectCount[]>([])
  const [total, setTotal] = useState(0)
  const activeSubject = searchParams.get('subject') || ''

  useEffect(() => {
    fetch('/api/notes/subjects')
      .then((r) => r.json())
      .then(({ data, total: t }) => {
        if (Array.isArray(data)) setSubjects(data as SubjectCount[])
        if (typeof t === 'number') setTotal(t)
      })
      .catch(() => {})
  }, [pathname]) // refresh when navigating

  if (subjects.length === 0) return null

  const topSubjects = subjects.slice(0, 6)
  const moreCount = subjects.length - 6

  return (
    <div className="ml-3 mt-0.5 space-y-0.5">
      {/* All Notes link */}
      <Link
        href="/dashboard/notes"
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
          pathname === '/dashboard/notes' && !activeSubject
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground',
        )}
        style={
          pathname === '/dashboard/notes' && !activeSubject
            ? { background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.12)' }
            : {}
        }
      >
        <span className="flex-1">All Notes</span>
        <span className="text-[10px] opacity-60">{total}</span>
      </Link>

      {/* Subject links */}
      {topSubjects.map(({ subject, count }) => {
        const isActive = activeSubject === subject
        const href = `/dashboard/notes?subject=${encodeURIComponent(subject)}`
        return (
          <Link
            key={subject}
            href={href}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all truncate',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
            style={
              isActive
                ? { background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.12)' }
                : {}
            }
          >
            <BookOpen className="w-3 h-3 shrink-0 opacity-60" />
            <span className="flex-1 truncate">{subject}</span>
            <span className="text-[10px] opacity-60 shrink-0">{count}</span>
          </Link>
        )
      })}

      {moreCount > 0 && (
        <Link
          href="/dashboard/notes"
          className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <ChevronRight className="w-3 h-3" />
          <span>{moreCount} more subject{moreCount !== 1 ? 's' : ''}</span>
        </Link>
      )}
    </div>
  )
}
