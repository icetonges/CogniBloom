import { NextRequest, NextResponse, after } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { z } from 'zod'
import { awardXP, XP } from '@/lib/gamification'

const saveSchema = z.object({
  topic: z.string().min(1),
  subject: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  questions: z.array(z.object({
    id: z.string(),
    question: z.string(),
    correctId: z.string(),
    selectedId: z.string(),
    isCorrect: z.boolean(),
    explanation: z.string(),
    options: z.array(z.object({ id: z.string(), text: z.string() })),
  })),
  timeTakenSeconds: z.number().optional(),
})

// POST /api/quiz/save — persist a completed quiz attempt
export async function POST(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const body = await request.json()
    const validated = saveSchema.parse(body)

    const correctAnswers = validated.questions.filter((q) => q.isCorrect).length
    const total = validated.questions.length
    const score = total > 0 ? (correctAnswers / total) * 100 : 0

    const quiz = await db.quiz.create({
      data: {
        userId,
        title: `${validated.topic} Quiz`,
        subject: validated.subject ?? validated.topic,
        difficulty: validated.difficulty,
        isAiGenerated: true,
        generatedFromTopic: validated.topic,
        totalQuestions: total,
        correctAnswers,
        score,
        timeSpent: validated.timeTakenSeconds,
        status: 'completed',
        completedAt: new Date(),
        questions: {
          create: validated.questions.map((q, idx) => ({
            questionIndex: idx,
            type: 'multiple_choice',
            question: q.question,
            correctAnswer: q.correctId,
            studentAnswer: q.selectedId,
            isCorrect: q.isCorrect,
            score: q.isCorrect ? 1 : 0,
            explanation: q.explanation,
            options: {
              create: q.options.map((opt, oi) => ({
                optionIndex: oi,
                text: opt.text,
                isCorrect: opt.id === q.correctId,
              })),
            },
          })),
        },
      },
    })

    // Update LearningProfile mastery scores (upsert)
    if (validated.subject) {
      const profile = await db.learningProfile.findUnique({ where: { userId } })
      const currentScores = (profile?.masteryScores as Record<string, number>) ?? {}
      const prev = currentScores[validated.subject] ?? 0
      // Exponential moving average — weights new result at 30%
      const updated = prev * 0.7 + (score / 100) * 0.3

      await db.learningProfile.upsert({
        where: { userId },
        update: {
          masteryScores: { ...currentScores, [validated.subject]: Math.round(updated * 100) / 100 },
          totalPracticeAnswered: { increment: total },
        },
        create: {
          userId,
          masteryScores: { [validated.subject]: Math.round((score / 100) * 100) / 100 },
          totalPracticeAnswered: total,
        },
      })
    }

    // Award XP after response — perfect score earns a bonus
    const isPerfect = correctAnswers === total && total > 0
    after(() => awardXP(userId, XP.QUIZ_COMPLETED + (isPerfect ? XP.QUIZ_PERFECT_BONUS : 0)))

    return NextResponse.json({
      success: true,
      data: { quizId: quiz.id, score: Math.round(score), correctAnswers, total },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/quiz/save — list past quizzes
export async function GET(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)

    const quizzes = await db.quiz.findMany({
      where: { userId, status: 'completed' },
      orderBy: { completedAt: 'desc' },
      take: limit,
      select: {
        id: true, title: true, subject: true, difficulty: true,
        score: true, totalQuestions: true, correctAnswers: true,
        timeSpent: true, completedAt: true, generatedFromTopic: true,
      },
    })

    return NextResponse.json({ success: true, data: quizzes })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
