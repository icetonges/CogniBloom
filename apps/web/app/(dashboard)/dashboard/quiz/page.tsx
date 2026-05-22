'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loader2, Sparkles, CheckCircle2, XCircle, RotateCcw, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { QuizQuestion } from '@/app/api/quiz/route'

type Difficulty = 'easy' | 'medium' | 'hard'

interface QuizState {
  questions: QuizQuestion[]
  topic: string
  difficulty: Difficulty
  current: number
  answers: Record<string, string>   // questionId → chosen option id
  revealed: Record<string, boolean> // questionId → revealed
  finished: boolean
}

const SUBJECT_SUGGESTIONS = [
  { label: 'Algebra', emoji: '📐' },
  { label: 'Python basics', emoji: '🐍' },
  { label: 'World War II', emoji: '📜' },
  { label: 'Photosynthesis', emoji: '🌿' },
  { label: 'Shakespeare', emoji: '🎭' },
  { label: 'Newton\'s laws', emoji: '🍎' },
  { label: 'Fractions', emoji: '½' },
  { label: 'Solar system', emoji: '🪐' },
]

export default function QuizPage() {
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [count, setCount] = useState(5)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quiz, setQuiz] = useState<QuizState | null>(null)

  const generateQuiz = async () => {
    if (!topic.trim()) return
    setIsGenerating(true)
    setError(null)
    setQuiz(null)

    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), difficulty, count }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Failed to generate quiz')
      }
      const { data } = await res.json()
      setQuiz({
        questions: data.questions,
        topic: data.topic,
        difficulty: data.difficulty,
        current: 0,
        answers: {},
        revealed: {},
        finished: false,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setIsGenerating(false)
    }
  }

  const choose = (questionId: string, optionId: string) => {
    if (!quiz || quiz.revealed[questionId]) return
    setQuiz((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        answers: { ...prev.answers, [questionId]: optionId },
        revealed: { ...prev.revealed, [questionId]: true },
      }
    })
  }

  const next = () => {
    if (!quiz) return
    if (quiz.current + 1 >= quiz.questions.length) {
      setQuiz((prev) => prev ? { ...prev, finished: true } : prev)
    } else {
      setQuiz((prev) => prev ? { ...prev, current: prev.current + 1 } : prev)
    }
  }

  const reset = () => setQuiz(null)

  const score = quiz
    ? quiz.questions.filter((q) => quiz.answers[q.id] === q.correctId).length
    : 0

  // ── Results screen ──────────────────────────────────────────────────
  if (quiz?.finished) {
    const pct = Math.round((score / quiz.questions.length) * 100)
    const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '👏' : '💪'
    const message =
      pct >= 80 ? 'Outstanding work, Daniel!' :
      pct >= 60 ? 'Great effort — keep it up!' :
      'Good try! Review and try again!'

    return (
      <div className="max-w-xl mx-auto space-y-6">
        <Card className="p-8 text-center space-y-4">
          <div className="text-6xl">{emoji}</div>
          <h2 className="text-2xl font-bold">{message}</h2>
          <p className="text-muted-foreground">
            You scored <span className="text-primary font-bold text-xl">{score}/{quiz.questions.length}</span> ({pct}%)
            on <em>{quiz.topic}</em>
          </p>
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className={cn('h-3 rounded-full transition-all', pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-400')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <Button onClick={generateQuiz} className="gap-2">
              <RotateCcw className="w-4 h-4" /> Try again
            </Button>
            <Button variant="outline" onClick={reset}>New quiz</Button>
          </div>
        </Card>

        {/* Answer review */}
        <div className="space-y-3">
          <h3 className="font-semibold text-muted-foreground">Review answers</h3>
          {quiz.questions.map((q, i) => {
            const chosen = quiz.answers[q.id]
            const correct = chosen === q.correctId
            return (
              <Card key={q.id} className={cn('p-4', correct ? 'border-green-500/40' : 'border-red-400/40')}>
                <p className="font-medium mb-2 text-sm">{i + 1}. {q.question}</p>
                <div className="flex items-start gap-2 text-sm">
                  {correct
                    ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  }
                  <div>
                    <p>{correct ? 'Correct!' : `You chose: ${q.options.find(o => o.id === chosen)?.text ?? '—'}`}</p>
                    {!correct && <p className="text-green-600 dark:text-green-400">Correct: {q.options.find(o => o.id === q.correctId)?.text}</p>}
                    <p className="text-muted-foreground mt-1 text-xs">{q.explanation}</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Active quiz ──────────────────────────────────────────────────
  if (quiz) {
    const q = quiz.questions[quiz.current]
    const chosen = quiz.answers[q.id]
    const revealed = quiz.revealed[q.id]
    const progress = ((quiz.current + (revealed ? 1 : 0)) / quiz.questions.length) * 100

    return (
      <div className="max-w-xl mx-auto space-y-5">
        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Question {quiz.current + 1} of {quiz.questions.length}</span>
            <span className="flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5" />
              {score} correct
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <Card className="p-6 space-y-5">
          <h2 className="text-base font-semibold leading-snug">{q.question}</h2>

          <div className="space-y-2">
            {q.options.map((opt) => {
              const isChosen = chosen === opt.id
              const isCorrect = opt.id === q.correctId
              let variant = 'outline' as 'outline' | 'default'
              let extra = ''
              if (revealed) {
                if (isCorrect) extra = 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-300'
                else if (isChosen) extra = 'border-red-400 bg-red-400/10 text-red-600 dark:text-red-400'
                else extra = 'opacity-50'
              } else if (isChosen) {
                variant = 'default'
              }
              return (
                <button
                  key={opt.id}
                  onClick={() => choose(q.id, opt.id)}
                  disabled={revealed}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-lg border text-sm transition-all',
                    'hover:bg-muted/60 disabled:cursor-default',
                    variant === 'default' ? 'border-primary bg-primary/10' : 'border-border bg-background',
                    extra
                  )}
                >
                  <span className="font-mono text-xs mr-2 opacity-60">{opt.id.toUpperCase()}.</span>
                  {opt.text}
                </button>
              )
            })}
          </div>

          {revealed && (
            <div className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
              💡 {q.explanation}
            </div>
          )}

          {revealed && (
            <Button onClick={next} className="w-full">
              {quiz.current + 1 < quiz.questions.length ? 'Next question →' : 'See results'}
            </Button>
          )}
        </Card>
      </div>
    )
  }

  // ── Quiz setup screen ──────────────────────────────────────────
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Quiz 🧠</h1>
        <p className="text-muted-foreground mt-1">Generate a personalised quiz on any topic in seconds.</p>
      </div>

      <Card className="p-6 space-y-5">
        {/* Topic */}
        <div>
          <label className="text-sm font-medium block mb-1.5">Topic or subject</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generateQuiz()}
            placeholder="e.g. Quadratic equations, World War II, Python loops..."
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
          {/* Suggestions */}
          <div className="flex flex-wrap gap-2 mt-2">
            {SUBJECT_SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => setTopic(s.label)}
                className="text-xs bg-muted hover:bg-muted/70 text-muted-foreground px-2.5 py-1 rounded-full transition-colors"
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <label className="text-sm font-medium block mb-1.5">Difficulty</label>
          <div className="flex gap-2">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={cn(
                  'flex-1 py-2 rounded-lg border text-sm capitalize transition-all',
                  difficulty === d
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border bg-background hover:bg-muted'
                )}
              >
                {d === 'easy' ? '🟢' : d === 'medium' ? '🟡' : '🔴'} {d}
              </button>
            ))}
          </div>
        </div>

        {/* Question count */}
        <div>
          <label className="text-sm font-medium block mb-1.5">Questions: <span className="text-primary">{count}</span></label>
          <input
            type="range" min={3} max={10} value={count}
            onChange={(e) => setCount(parseInt(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>3</span><span>10</span></div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={generateQuiz}
          disabled={!topic.trim() || isGenerating}
          className="w-full gap-2"
          size="lg"
        >
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating quiz...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Generate Quiz</>
          )}
        </Button>
      </Card>
    </div>
  )
}
