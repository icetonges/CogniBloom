import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'
import { DEFAULT_MODEL_ID, MODELS } from '@/lib/ai/models'

const VALID_MODEL_IDS = new Set(MODELS.map((model) => model.id))

function normalizeModelId(modelId: unknown): string {
  return typeof modelId === 'string' && VALID_MODEL_IDS.has(modelId)
    ? modelId
    : DEFAULT_MODEL_ID
}

// GET /api/settings — returns Daniel's preferences (upserts defaults if missing)
export async function GET() {
  try {
    const userId = DANIEL_USER_ID

    const prefs = await db.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        preferredModel: DEFAULT_MODEL_ID,
        responseLength: 'medium',
        includeExamples: true,
        grade: 'Year 9',
        subjects: ['Math', 'Science'],
        emailFrequency: 'daily',
      },
      update: {},
    })

    if (!VALID_MODEL_IDS.has(prefs.preferredModel)) {
      const updated = await db.userPreferences.update({
        where: { userId },
        data: { preferredModel: DEFAULT_MODEL_ID },
      })
      return NextResponse.json({ success: true, data: updated })
    }

    return NextResponse.json({ success: true, data: prefs })
  } catch {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

// PATCH /api/settings — partial update of preferences
export async function PATCH(request: NextRequest) {
  try {
    const userId = DANIEL_USER_ID
    const body = await request.json() as Record<string, unknown>

    // Whitelist of allowed fields
    const allowed: (keyof typeof body)[] = [
      'preferredModel',
      'responseLength',
      'includeExamples',
      'includeVisuals',
      'grade',
      'subjects',
      'emailFrequency',
      'pushNotifications',
      'darkMode',
      'fontSize',
    ]

    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }
    if ('preferredModel' in data) data['preferredModel'] = normalizeModelId(data['preferredModel'])

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }

    const prefs = await db.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        ...data,
      } as Parameters<typeof db.userPreferences.create>[0]['data'],
      update: data,
    })

    return NextResponse.json({ success: true, data: prefs })
  } catch {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
