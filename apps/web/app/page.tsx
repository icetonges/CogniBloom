import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { ArrowRight, Sparkles, BookOpen, Brain, BarChart3 } from 'lucide-react'

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            CogniBloom
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/sign-in">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 px-4 py-20 sm:py-28">
        <div className="container mx-auto text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-8 text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            AI-Powered Learning Companion
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold mb-6 leading-tight">
            Your Personal AI Tutor for{' '}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              K-12 Learning
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto">
            CogniBloom combines AI tutoring, journaling, knowledge management, and analytics to help
            students learn, grow, and achieve their academic goals.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2 w-full sm:w-auto text-base px-8 py-6">
                Start Learning Now
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 py-6">
                Learn More
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 sm:gap-12 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-primary">24/7</div>
              <div className="text-sm sm:text-base text-muted-foreground mt-1">AI Tutoring</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-secondary">10+</div>
              <div className="text-sm sm:text-base text-muted-foreground mt-1">Learning Modes</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-primary">∞</div>
              <div className="text-sm sm:text-base text-muted-foreground mt-1">Practice Problems</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-24 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-4xl sm:text-5xl font-bold text-center mb-14">Powerful Learning Features</h2>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-xl border border-border bg-card">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">AI Tutoring</h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                Get personalized tutoring in math, coding, language, science, and more. Our AI adapts
                to your learning style and pace.
              </p>
            </div>

            <div className="p-8 rounded-xl border border-border bg-card">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center mb-5">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Rich Journaling</h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                Write beautiful journals with Markdown, LaTeX, code blocks, and more. Organize your
                learning with tags and searches.
              </p>
            </div>

            <div className="p-8 rounded-xl border border-border bg-card sm:col-span-2 md:col-span-1">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Learning Analytics</h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                Track your progress with detailed analytics. See your mastery in each subject and get
                personalized recommendations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-24 bg-gradient-to-r from-primary to-secondary text-white">
        <div className="container mx-auto text-center px-4 sm:px-6">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">Ready to Transform Your Learning?</h2>
          <p className="text-xl sm:text-2xl mb-10 opacity-90 max-w-xl mx-auto">
            Join thousands of students using CogniBloom for their K-12 education.
          </p>
          <Link href="/sign-up">
            <Button size="lg" variant="secondary" className="gap-2 text-base px-8 py-6">
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/40 py-12 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10 text-sm">
            <div>
              <h4 className="font-semibold text-base mb-4">Product</h4>
              <ul className="space-y-2.5 text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Security</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-base mb-4">Company</h4>
              <ul className="space-y-2.5 text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Blog</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-base mb-4">Legal</h4>
              <ul className="space-y-2.5 text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">Privacy</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Terms</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Cookies</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-base mb-4">Follow</h4>
              <ul className="space-y-2.5 text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">Twitter</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">GitHub</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Discord</Link></li>
              </ul>
            </div>
          </div>

          {/* Daniel dedication */}
          <div className="border-t border-border pt-8 text-center space-y-2">
            <p className="text-base font-medium text-foreground">
              Dedicated to Daniel — curiosity is your superpower. Every question you ask makes you
              stronger. Keep blooming. 🌱
            </p>
            <p className="text-sm text-muted-foreground">
              &copy; 2026 CogniBloom. Built with love to fuel great minds.
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
