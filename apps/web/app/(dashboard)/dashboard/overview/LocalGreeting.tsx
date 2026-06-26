'use client'

/**
 * Renders the greeting line ("🌅 Good morning" / "☀️ Good afternoon" / "🌙 Good evening")
 * using the device's local clock — correct wherever the user is traveling.
 * Intentionally a separate client component so the parent overview page
 * can remain a server component for all its data fetching.
 */
export function LocalGreeting() {
  const hour = new Date().getHours() // local time on the user's device
  const emoji   = hour < 12 ? '🌅' : hour < 18 ? '☀️' : '🌙'
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return (
    <p className="text-sm font-semibold text-muted-foreground mb-1">
      {emoji} {greeting}
    </p>
  )
}
