import { ThemeToggle } from '@/components/ui/theme-toggle'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar with theme toggle */}
      <div className="flex justify-between items-center px-6 py-4">
        <span className="text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          CogniBloom
        </span>
        <ThemeToggle />
      </div>

      {/* Centered auth card */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">{children}</div>
      </div>

      {/* Footer */}
      <div className="text-center pb-6 text-sm text-muted-foreground">
        &copy; 2026 CogniBloom — Keep learning, keep growing.
      </div>
    </div>
  )
}
