'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sparkles, BookOpen, MessageSquare, BarChart3, Settings,
  Menu, X, Brain, Rss, Trophy, Upload, Layers, GitBranch, Medal, Flame, Plus, Home,
  CalendarDays,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SubjectGroupList } from '@/components/layout/SubjectGroupList'

const navItems = [
  { href: '/dashboard/planner',         icon: CalendarDays,  label: 'Planner',           color: 'text-cyan-400'   },
  { href: '/dashboard/notes/new',       icon: BookOpen,      label: 'Notes',            color: 'text-emerald-400'},
  { href: '/dashboard/review',          icon: Brain,         label: 'Daily Review',      color: 'text-fuchsia-400', badge: 'review-due' },
  { href: '/dashboard/overview',         icon: BarChart3,     label: 'Dashboard',        color: 'text-blue-400'   },
  { href: '/dashboard/chat',            icon: MessageSquare, label: 'AI Tutor',          color: 'text-violet-400' },
  { href: '/dashboard/flashcards',      icon: Layers,        label: 'Flashcards',        color: 'text-rose-400',   badge: 'flashcards-due' },
  { href: '/dashboard/quiz',            icon: Trophy,        label: 'Quiz',              color: 'text-amber-400'  },
  { href: '/dashboard/feed',            icon: Rss,           label: 'Daily Feed',        color: 'text-sky-400'    },
  { href: '/dashboard/analytics',       icon: Brain,         label: 'Analytics',         color: 'text-pink-400'   },
  { href: '/dashboard/knowledge-graph', icon: GitBranch,     label: 'Knowledge Graph',   color: 'text-teal-400'   },
  { href: '/dashboard/achievements',    icon: Medal,         label: 'Achievements',      color: 'text-yellow-400' },
  { href: '/dashboard/uploads',         icon: Upload,        label: 'Uploads',           color: 'text-orange-400' },
  { href: '/dashboard/settings',        icon: Settings,      label: 'Settings',          color: 'text-slate-400'  },
]

interface UserStats { level: number; pct: number; streak: number }

function Sidebar({
  onClose, flashcardsDue, reviewDue, userStats,
}: { onClose?: () => void; flashcardsDue: number; reviewDue: number; userStats: UserStats | null }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full">
      {/* ── Logo ── */}
      <div className="flex items-center justify-between px-4 py-4 h-16 border-b border-white/[0.05] dark:border-white/[0.04]">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 0 18px rgba(99,102,241,0.5)',
            }}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-lg tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            CogniBloom
          </span>
        </Link>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="md:hidden">
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label, badge, color }) => {
          // Notes nav item is special: active whenever pathname is under /dashboard/notes
          const notesItem = href === '/dashboard/notes/new'
          const active = notesItem
            ? pathname.startsWith('/dashboard/notes')
            : pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          const badgeCount = badge === 'flashcards-due' ? flashcardsDue : badge === 'review-due' ? reviewDue : 0
          const showBadge = !!badge && badgeCount > 0

          return (
            <div key={href}>
              <Link
                href={href}
                onClick={onClose}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                  active
                    ? 'bg-primary/[0.10] dark:bg-primary/[0.12] text-primary shadow-[inset_0_0_0_1px_rgba(99,102,241,0.18)]'
                    : 'text-muted-foreground hover:bg-muted/50 dark:hover:bg-white/[0.04] hover:text-foreground'
                )}
              >
                {/* Left accent bar */}
                {active && (
                  <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-primary shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                )}

                <Icon
                  className={cn(
                    'w-4 h-4 shrink-0 transition-colors',
                    active ? 'text-primary' : cn(color, 'group-hover:opacity-100 opacity-70')
                  )}
                />
                <span className="flex-1">{label}</span>
                {/* Notes: show inline + button so label click = new note, + = new note too */}
                {notesItem && (
                  <span
                    className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/20"
                    title="New note"
                  >
                    <Plus className="w-3 h-3" />
                  </span>
                )}
                {showBadge && (
                  <span className="min-w-[1.25rem] h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center px-1 shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </Link>
              {href === '/dashboard/notes/new' && (
                <Suspense fallback={null}>
                  <SubjectGroupList />
                </Suspense>
              )}
            </div>
          )
        })}
      </nav>

      {/* ── Bottom: home link + theme + user widget ── */}
      <div className="p-3 border-t border-white/[0.05] dark:border-white/[0.04] space-y-2">
        {/* Back to landing page */}
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 dark:hover:bg-white/[0.04] transition-colors group"
        >
          <Home className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
          <span>Back to Home</span>
        </Link>

        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs font-medium text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>

        {/* Daniel widget */}
        <div className="rounded-xl p-3 bg-primary/[0.06] dark:bg-primary/[0.08] border border-primary/[0.12]">
          <div className="flex items-center gap-3">
            {/* Avatar + level badge */}
            <div className="relative shrink-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 0 14px rgba(99,102,241,0.45)',
                }}
              >
                D
              </div>
              {userStats && (
                <div className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full bg-amber-500 flex items-center justify-center text-[9px] font-black text-white border-2 border-card dark:border-[#080d1a]">
                  {userStats.level}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold truncate">Daniel</span>
                {userStats && userStats.streak > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-500">
                    <Flame className="w-2.5 h-2.5" />
                    {userStats.streak}
                  </span>
                )}
              </div>
              {/* XP mini-bar */}
              {userStats ? (
                <div className="mt-1.5 h-1 rounded-full bg-primary/15 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${userStats.pct}%`,
                      background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
                      boxShadow: '0 0 6px rgba(99,102,241,0.6)',
                    }}
                  />
                </div>
              ) : (
                <div className="mt-1.5 h-1 rounded-full bg-muted/40" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [flashcardsDue, setFlashcardsDue] = useState(0)
  const [reviewDue, setReviewDue] = useState(0)
  const [userStats, setUserStats] = useState<UserStats | null>(null)

  // Flashcard + note-review due counts — refreshed every 2 min
  useEffect(() => {
    const load = () => {
      fetch('/api/flashcards?due=true')
        .then((r) => r.json())
        .then(({ dueCount }) => { if (typeof dueCount === 'number') setFlashcardsDue(dueCount) })
        .catch(() => {})
      fetch('/api/review')
        .then((r) => r.json())
        .then((res) => { if (res?.stats && typeof res.stats.dueCount === 'number') setReviewDue(res.stats.dueCount) })
        .catch(() => {})
    }
    load()
    const t = setInterval(load, 120_000)
    return () => clearInterval(t)
  }, [])

  // Level / XP / streak for sidebar widget
  useEffect(() => {
    fetch('/api/gamification')
      .then((r) => r.json())
      .then((d) =>
        setUserStats({ level: d.level ?? 1, pct: d.progressPct ?? 0, streak: d.streak ?? 0 })
      )
      .catch(() => {})
  }, [])

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 border-r transition-transform duration-200 md:static md:translate-x-0',
          'bg-card dark:bg-[#080d1a] border-border dark:border-white/[0.04]',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Sidebar
          onClose={() => setSidebarOpen(false)}
          flashcardsDue={flashcardsDue}
          reviewDue={reviewDue}
          userStats={userStats}
        />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="flex items-center gap-3 h-16 px-4 border-b bg-card dark:bg-[#080d1a] border-border dark:border-white/[0.04] md:hidden shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-black text-base bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              CogniBloom
            </span>
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto dark:bg-[#060c18]">
          <div className="container max-w-6xl mx-auto py-6 px-4 md:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
