import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import {
  ArrowRight, Sparkles, BookOpen, Brain, BarChart3,
  MessageSquare, Trophy, Rss, CheckCircle2, Zap, Shield, Clock,
} from 'lucide-react'

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* ── Navigation ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              CogniBloom
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="gap-1.5">
                Get Started <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/8 via-background to-background px-4 py-20 sm:py-32">
        {/* subtle grid overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />

        <div className="relative container mx-auto text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary mb-6 text-sm font-medium border border-primary/20">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Learning — Designed for K-12
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold mb-6 leading-[1.1] tracking-tight">
            The smartest way to{' '}
            <span className="bg-gradient-to-r from-primary via-purple-500 to-secondary bg-clip-text text-transparent">
              learn anything
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto">
            CogniBloom gives K-12 students an AI tutor that knows their notes, generates personalised quizzes,
            and tracks their progress — all in one beautiful app.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2 w-full sm:w-auto px-8 text-base">
                Start for free <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 text-base">
                Sign in to dashboard
              </Button>
            </Link>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap justify-center gap-8 sm:gap-16 text-center">
            {[
              { stat: '24/7', label: 'AI Tutor available' },
              { stat: '8+', label: 'Tutor modes' },
              { stat: '∞', label: 'Practice quizzes' },
              { stat: '3', label: 'AI providers' },
            ].map(({ stat, label }) => (
              <div key={label}>
                <div className="text-3xl sm:text-4xl font-bold text-primary">{stat}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature showcase ───────────────────────────────────────── */}
      <section id="features" className="py-20 sm:py-28 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">Everything a student needs</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Six powerful tools — one seamless platform.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: <MessageSquare className="w-6 h-6" />,
                color: 'bg-blue-500/10 text-blue-500',
                title: 'AI Tutor Chat',
                desc: 'Chat with Gemini, Claude, or Llama. The AI reads your own notes and uses them as context for hyper-personalised answers.',
                badge: 'RAG-powered',
              },
              {
                icon: <BookOpen className="w-6 h-6" />,
                color: 'bg-purple-500/10 text-purple-500',
                title: 'Smart Notes',
                desc: 'Write in Markdown with LaTeX math and code blocks. Notes are auto-embedded into a vector database for semantic search.',
                badge: 'pgvector search',
              },
              {
                icon: <Trophy className="w-6 h-6" />,
                color: 'bg-amber-500/10 text-amber-500',
                title: 'AI Quizzes',
                desc: 'Type any topic and get a tailored multiple-choice quiz in seconds. Instant feedback + explanations on every answer.',
                badge: 'Instant',
              },
              {
                icon: <Rss className="w-6 h-6" />,
                color: 'bg-green-500/10 text-green-500',
                title: 'Daily Learning Feed',
                desc: 'A fresh batch of facts, challenges, vocabulary, puzzles, and study tips generated every day just for you.',
                badge: 'Daily refresh',
              },
              {
                icon: <BarChart3 className="w-6 h-6" />,
                color: 'bg-pink-500/10 text-pink-500',
                title: 'Learning Analytics',
                desc: 'See your 7-day activity, notes by subject, streak counter, and AI usage — all in clear, visual charts.',
                badge: 'Progress tracking',
              },
              {
                icon: <Brain className="w-6 h-6" />,
                color: 'bg-indigo-500/10 text-indigo-500',
                title: '8 Tutor Modes',
                desc: 'Math, Coding, Language, Science, Homework Helper, Socratic Coach, Quiz mode — each with a tailored AI persona.',
                badge: 'Adaptive AI',
              },
            ].map(({ icon, color, title, desc, badge }) => (
              <div
                key={title}
                className="group p-6 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all"
              >
                <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4`}>
                  {icon}
                </div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-lg">{title}</h3>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0 mt-0.5">{badge}</span>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">Up and running in 60 seconds</h2>
            <p className="text-muted-foreground text-lg">No setup. No credit card required.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '1', icon: '✍️', title: 'Create your account', desc: 'Sign up free with your email. No credit card needed.' },
              { step: '2', icon: '📝', title: 'Add your notes', desc: 'Write notes in Markdown. The AI learns from them automatically.' },
              { step: '3', icon: '🚀', title: 'Start learning', desc: 'Chat with your AI tutor, take quizzes, read the daily feed.' },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} className="text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-2xl mx-auto">
                  {icon}
                </div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest">Step {step}</div>
                <h3 className="font-bold text-lg">{title}</h3>
                <p className="text-muted-foreground text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why CogniBloom ─────────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
            <div className="space-y-6">
              <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
                Built for how students <span className="text-primary">actually</span> learn
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Most AI tools give generic answers. CogniBloom reads <em>your own notes</em> and
                tailors every response to your exact knowledge gaps — like a private tutor who has
                studied your textbooks.
              </p>
              <ul className="space-y-3">
                {[
                  'AI answers grounded in your own notes (RAG)',
                  'Works across Gemini, Claude, and Llama models',
                  'Dark mode, mobile-friendly, fast',
                  'Streak tracking keeps you consistent',
                  'Free to start — no credit card',
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <Link href="/sign-up">
                <Button size="lg" className="gap-2 mt-2">
                  Try it free <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>

            {/* Mock chat preview */}
            <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/50">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-2 text-xs text-muted-foreground">AI Tutor · Gemini Flash</span>
                <span className="ml-auto text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Brain className="w-3 h-3" /> Using your notes
                </span>
              </div>
              <div className="p-4 space-y-4 text-sm">
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[75%]">
                    Can you explain quadratic equations?
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%] text-muted-foreground leading-relaxed">
                    Based on your notes on algebra, a quadratic equation has the form{' '}
                    <code className="bg-background px-1 rounded text-foreground">ax² + bx + c = 0</code>.
                    The solutions are found using the <strong className="text-foreground">quadratic formula</strong>...
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[75%]">
                    Can you quiz me on this? 🎯
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 text-muted-foreground">
                    Sure! What are the solutions to <code className="bg-background px-1 rounded text-foreground">x² - 5x + 6 = 0</code>?
                  </div>
                </div>
              </div>
              <div className="px-4 pb-4">
                <div className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                  Ask anything...
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust badges ───────────────────────────────────────────── */}
      <section className="py-12 border-t border-border bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap justify-center gap-8 sm:gap-16 text-sm text-muted-foreground">
            {[
              { icon: <Shield className="w-5 h-5" />, text: 'Privacy first — your notes stay yours' },
              { icon: <Zap className="w-5 h-5" />, text: 'Streaming AI — no waiting' },
              { icon: <Clock className="w-5 h-5" />, text: 'Available 24/7, any device' },
              { icon: <CheckCircle2 className="w-5 h-5" />, text: 'Free to start' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-2">
                <span className="text-primary">{icon}</span>
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-gradient-to-br from-primary/90 to-secondary/90 text-white">
        <div className="container mx-auto text-center px-4 sm:px-6 max-w-2xl">
          <div className="text-5xl mb-4">🌱</div>
          <h2 className="text-3xl sm:text-5xl font-bold mb-4">Ready to bloom?</h2>
          <p className="text-lg opacity-90 mb-8">
            Join Daniel and thousands of K-12 students who are learning smarter with AI.
          </p>
          <Link href="/sign-up">
            <Button size="lg" variant="secondary" className="gap-2 px-10 text-base font-semibold">
              Start learning free <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <p className="text-sm opacity-70 mt-4">No credit card required · Takes 30 seconds</p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="bg-card py-12 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between gap-8 mb-10">
            <div className="max-w-xs">
              <div className="flex items-center gap-2 font-bold text-lg mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  CogniBloom
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI-powered K-12 learning platform. Personalised tutoring, smart notes, and analytics in one place.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
              <div>
                <h4 className="font-semibold mb-3">Product</h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li><Link href="#features" className="hover:text-foreground transition-colors">Features</Link></li>
                  <li><Link href="/sign-up" className="hover:text-foreground transition-colors">Get Started</Link></li>
                  <li><Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Legal</h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li><Link href="#" className="hover:text-foreground transition-colors">Privacy</Link></li>
                  <li><Link href="#" className="hover:text-foreground transition-colors">Terms</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Connect</h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li><Link href="https://github.com/icetonges/CogniBloom" className="hover:text-foreground transition-colors">GitHub</Link></li>
                  <li><Link href="#" className="hover:text-foreground transition-colors">Discord</Link></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-8 text-center space-y-1.5">
            <p className="text-sm font-medium">
              Dedicated to <span className="text-primary font-bold">Daniel</span> — curiosity is your{' '}
              <strong>superpower</strong>. Every question you ask makes you stronger. Keep blooming. 🌱
            </p>
            <p className="text-xs text-muted-foreground">
              &copy; 2026 CogniBloom. Built with love to fuel great minds.
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
