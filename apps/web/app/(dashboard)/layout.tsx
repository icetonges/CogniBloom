import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { Sparkles, BookOpen, MessageSquare, BarChart3, Settings } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
            <Sparkles className="w-6 h-6 text-blue-600" />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              CogniBloom
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <NavLink href="/dashboard" icon={<BarChart3 className="w-5 h-5" />} label="Dashboard" />
          <NavLink href="/dashboard/notes" icon={<BookOpen className="w-5 h-5" />} label="Notes" />
          <NavLink href="/dashboard/chat" icon={<MessageSquare className="w-5 h-5" />} label="Chat" />
          <NavLink
            href="/dashboard/learning"
            icon={<Sparkles className="w-5 h-5" />}
            label="Learning"
          />
          <NavLink href="/dashboard/quizzes" icon={<BarChart3 className="w-5 h-5" />} label="Quizzes" />
        </nav>

        {/* Settings & User */}
        <div className="p-4 border-t border-border space-y-2">
          <NavLink href="/dashboard/settings" icon={<Settings className="w-5 h-5" />} label="Settings" />
          <div className="flex items-center justify-between p-2 rounded-lg">
            <span className="text-sm font-medium">Account</span>
            <UserButton />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto py-8 px-6">{children}</div>
      </main>
    </div>
  )
}

function NavLink({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </Link>
  )
}
