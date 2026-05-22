import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { ArrowRight, Sparkles, BookOpen, Brain, BarChart3 } from 'lucide-react'

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
          <div className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            CogniBloom
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 px-4 py-16 sm:py-24">
        <div className="container mx-auto text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary mb-6 text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            AI-Powered Learning Companion
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Your Personal AI Tutor for{' '}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              K-12 Learning
            </span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground mb-8 leading-relaxed max-w-2xl mx-auto">
            CogniBloom combines AI tutoring, journaling, knowledge management, and analytics to help
            students learn, grow, and achieve their academic goals.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2 w-full sm:w-auto">
                Start Learning Now
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Learn More
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 sm:gap-8 text-center">
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-primary">24/7</div>
              <div className="text-xs sm:text-sm text-muted-foreground">AI Tutoring</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-secondary">10+</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Learning Modes</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-primary">∞</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Practice Problems</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 sm:py-20 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">Powerful Learning Features</h2>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-border bg-card">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Brain className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">AI Tutoring</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Get personalized tutoring in math, coding, language, science, and more. Our AI adapts
                to your learning style and pace.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center mb-4">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">Rich Journaling</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Write beautiful journals with Markdown, LaTeX, code blocks, and more. Organize your
                learning with tags and searches.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card sm:col-span-2 md:col-span-1">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">Learning Analytics</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Track your progress with detailed analytics. See your mastery in each subject and get
                personalized recommendations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-primary to-secondary text-white">
        <div className="container mx-auto text-center px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Transform Your Learning?</h2>
          <p className="text-base sm:text-lg mb-8 opacity-90 max-w-xl mx-auto">
            Join thousands of students using CogniBloom for their K-12 education.
          </p>
          <Link href="/sign-up">
            <Button size="lg" variant="secondary" className="gap-2">
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/50 py-8 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8 text-sm">
            <div>
              <h4 className="font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Security</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Blog</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">Privacy</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Terms</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Cookies</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Follow</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">Twitter</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">GitHub</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Discord</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
            &copy; 2024 CogniBloom. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  )
}
