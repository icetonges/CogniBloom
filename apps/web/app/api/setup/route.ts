import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DANIEL_USER_ID, APP_USER } from '@/lib/user'

// POST /api/setup — one-time DB seeding, protected by CRON_SECRET
// Call once after first deployment: curl -X POST https://your-app/api/setup -H "x-cron-secret: $SECRET"
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (secret !== process.env['CRON_SECRET']) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const user = await db.user.upsert({
      where: { id: DANIEL_USER_ID },
      update: { updatedAt: new Date() },
      create: {
        id: DANIEL_USER_ID,
        email: APP_USER.email || 'daniel@cognibloom.app',
        name: APP_USER.name,
        role: 'STUDENT',
        emailVerified: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      user: { id: user.id, name: user.name, email: user.email },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Setup failed', details: String(error) },
      { status: 500 }
    )
  }
}

// GET /api/setup — health check (is daniel user present?)
export async function GET() {
  try {
    const user = await db.user.findUnique({ where: { id: DANIEL_USER_ID } })
    return NextResponse.json({
      ready: user !== null,
      userId: user?.id ?? null,
    })
  } catch {
    return NextResponse.json({ ready: false, userId: null })
  }
}
