import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, TrendingUp, BookOpen, Award } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Welcome back!</h1>
        <p className="text-muted-foreground text-lg">
          Let&apos;s continue your learning journey with CogniBloom.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard
          icon={<BookOpen className="w-6 h-6 text-blue-600" />}
          title="Notes"
          value="0"
          subtitle="This week"
        />
        <StatCard
          icon={<Sparkles className="w-6 h-6 text-purple-600" />}
          title="Learning Streak"
          value="0"
          subtitle="Days"
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6 text-green-600" />}
          title="Progress"
          value="0%"
          subtitle="Overall"
        />
        <StatCard
          icon={<Award className="w-6 h-6 text-pink-600" />}
          title="Skills Mastered"
          value="0"
          subtitle="Subjects"
        />
      </div>

      {/* Main Content */}
      <div className="grid md:grid-cols-3 gap-8">
        {/* Chat Section */}
        <Card className="md:col-span-2 p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">AI Tutor</h2>
              <p className="text-muted-foreground">
                Get personalized tutoring in any subject. Ask questions, solve problems, and learn at
                your own pace.
              </p>
            </div>
            <Link href="/dashboard/chat">
              <Button className="w-full">Start Chat with AI</Button>
            </Link>
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/dashboard/notes/new">
              <Button variant="outline" className="w-full justify-start">
                <BookOpen className="w-4 h-4 mr-2" />
                New Note
              </Button>
            </Link>
            <Link href="/dashboard/quizzes">
              <Button variant="outline" className="w-full justify-start">
                <Award className="w-4 h-4 mr-2" />
                Take a Quiz
              </Button>
            </Link>
            <Link href="/dashboard/learning">
              <Button variant="outline" className="w-full justify-start">
                <Sparkles className="w-4 h-4 mr-2" />
                Today&apos;s Feed
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Recent Activity</h2>
        <div className="text-center py-8 text-muted-foreground">
          <p>No activity yet. Start learning to see your progress here!</p>
        </div>
      </Card>
    </div>
  )
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  value: string
  subtitle: string
}) {
  return (
    <Card className="p-6 flex items-start gap-4">
      <div className="mt-1">{icon}</div>
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </div>
    </Card>
  )
}
