import { NextRequest, NextResponse } from 'next/server'
import { DANIEL_USER_ID } from '@/lib/user'
import { db } from '@/lib/db'

// GET /api/uploads/[id] — return extractedText for the viewer
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = DANIEL_USER_ID
    const { id } = await params
    const upload = await db.upload.findFirst({
      where: { id, userId },
      select: {
        id: true,
        filename: true,
        fileType: true,
        fileSize: true,
        status: true,
        createdAt: true,
        extractedText: true,
        _count: { select: { chunks: true } },
      },
    })
    if (!upload) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: upload })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
