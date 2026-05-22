import { Card } from '@/components/ui/card'
import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings ⚙️</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      <Card className="p-8 text-center space-y-3">
        <Settings className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="font-semibold">Coming soon</p>
        <p className="text-sm text-muted-foreground">
          Profile preferences, notification settings, and subscription management will appear here.
        </p>
      </Card>
    </div>
  )
}
