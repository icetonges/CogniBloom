import { NextRequest, NextResponse } from 'next/server'
import { AVAILABLE_MODELS } from '@/lib/ai/router'

interface TutorModeInfo {
  id: string
  name: string
  description: string
  defaultModel: string
}

const TUTOR_MODES: TutorModeInfo[] = [
  {
    id: 'GENERAL',
    name: 'General Chat',
    description: 'Ask questions on any topic and get comprehensive answers',
    defaultModel: 'claude-sonnet-4.6',
  },
  {
    id: 'MATH',
    name: 'Math Tutor',
    description:
      'Get step-by-step help with mathematics problems and concepts',
    defaultModel: 'claude-sonnet-4.6',
  },
  {
    id: 'CODING',
    name: 'Code Assistant',
    description:
      'Learn programming concepts, debug code, and write better software',
    defaultModel: 'claude-opus-4.6',
  },
  {
    id: 'LANGUAGE',
    name: 'Language Tutor',
    description:
      'Improve your language skills with conversations and exercises',
    defaultModel: 'claude-sonnet-4.6',
  },
  {
    id: 'SCIENCE',
    name: 'Science Tutor',
    description:
      'Explore scientific concepts, experiments, and real-world applications',
    defaultModel: 'claude-sonnet-4.6',
  },
  {
    id: 'HOMEWORK_HELPER',
    name: 'Homework Help',
    description:
      'Get guidance on assignments without just providing answers',
    defaultModel: 'claude-sonnet-4.6',
  },
  {
    id: 'SOCRATIC_COACH',
    name: 'Socratic Coach',
    description: 'Learn through thoughtful questioning and critical thinking',
    defaultModel: 'claude-sonnet-4.6',
  },
  {
    id: 'QUIZ',
    name: 'Quiz Master',
    description: 'Test your knowledge with interactive quizzes and feedback',
    defaultModel: 'claude-haiku-4.5',
  },
]

// GET /api/tutor/modes - Get available tutor modes and models
export async function GET(_request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      data: {
        modes: TUTOR_MODES,
        models: AVAILABLE_MODELS,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
