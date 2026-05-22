'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, BookOpen, MessageSquare, BarChart3, Settings, Menu, X, Brain, Rss, Trophy, Upload, Layers, GitBranch } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', icon: BarChart3, label: 'Dashboard' },
  { href: '/dashboard/chat', icon: MessageSquare, label: 'AI Tutor' },
  { href: '/dashboard/notes', icon: BookOpen, label: 'Notes' },
  { href: '/dashboard/quiz', icon: Trophy, label: 'Quiz' },
  { href: '/dashboard/feed', icon: Rss, label: 'Daily Feed' },
  { href: '/dashboard/analytics', icon: Brain, label: 'Analytics' },
  { href: '/dashboard/knowledge-graph', icon: GitBranch, label: 'Knowledge Graph' },
  { href: '/dashboard/flashcards', icon: Layers, label: 'Flashcards', badge: 'flashcards-due' },
  { href: '/dashboard/uploads', icon: Upload, label: 'Uploads' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

function Sidebar({ onClose, flashcardsDue }: { onClose?: () => void; flashcardsDue: number }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-border h-16">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg" onClick={onClose}>
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            CogniBloom
          </span>
        </Link>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="md:hidden">
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label, badge }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          const showBadge = badge === 'flashcards-due' && flashcardsDue > 0
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="flex-1">{label}</span>
              {showBadge && (
                <span className="min-w-[1.25rem] h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center px-1">
                  {flashcardsDue > 99 ? '99+' : flashcardsDue}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom bar */}
      <div className="p-3 border-t border-border space-y-1">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
            D
          </div>
          <span className="text-sm font-medium">Daniel</span>
          <span className="ml-auto text-xs text-muted-foreground">🌱</span>
        </div>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [flashcardsDue, setFlashcardsDue] = useState(0)

  // Poll due flashcard count every 2 minutes
  useEffect(() => {
    const load = () => {
      fetch('/api/flashcards?due=true')
        .then((r) => r.json())
        .then(({ dueCount }) => { if (typeof dueCount === 'number') setFlashcardsDue(dueCount) })
        .catch(() => {})
    }
    load()
    const interval = setInterval(load, 120_000)
    return () => clearInterval(interval)
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
          'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transition-transform duration-200 md:static md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} flashcardsDue={flashcardsDue} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 h-16 px-4 border-b border-border bg-card md:hidden shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <Link href="/dashboard" className="flex items-center gap-2 font-bold">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              CogniBloom
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-6xl mx-auto py-6 px-4 md:px-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
