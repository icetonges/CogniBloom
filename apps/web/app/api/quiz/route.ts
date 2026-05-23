import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { chatWithFallback } from '@/lib/ai/fallback'

const generateSchema = z.object({
  topic: z.string().min(1).max(200),
  subject: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  count: z.number().int().min(1).max(10).default(5),
  model: z.string().optional(),
})

export interface QuizQuestion {
  id: string
  question: string
  options: { id: string; text: string }[]
  correctId: string
  explanation: string
}

// POST /api/quiz — generate a quiz via AI
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { topic, subject, difficulty, count, model } = generateSchema.parse(body)

    const prompt = `Generate a ${difficulty} difficulty quiz about "${topic}"${subject ? ` (subject: ${subject})` : ''} for a K-12 student.

Create exactly ${count} multiple-choice questions. Return ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "id": "q1",
      "question": "Question text here?",
      "options": [
        { "id": "a", "text": "Option A" },
        { "id": "b", "text": "Option B" },
        { "id": "c", "text": "Option C" },
        { "id": "d", "text": "Option D" }
      ],
      "correctId": "a",
      "explanation": "Brief explanation of why this is correct."
    }
  ]
}

Rules:
- Each question must have exactly 4 options (a, b, c, d)
- correctId must be one of: a, b, c, d
- Keep questions clear and age-appropriate
- Vary question types (definitions, application, reasoning)
- Return ONLY the JSON, no markdown, no extra text`

    const response = await chatWithFallback(
      { messages: [{ role: 'user', content: prompt }], temperature: 0.7, maxTokens: 2000 },
      model // user-selected model goes first in the chain
    )

    // Strip markdown code fences if present
    const raw = response.content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(raw) as { questions: QuizQuestion[] }

    return NextResponse.json({
      success: true,
      data: {
        topic,
        subject,
        difficulty,
        questions: parsed.questions,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'AI returned invalid JSON — please retry' }, { status: 502 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
