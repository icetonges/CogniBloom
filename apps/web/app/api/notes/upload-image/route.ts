import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

// POST /api/notes/upload-image
// Accepts multipart/form-data with field "image" (File).
// Returns { url: string } — a path that can be embedded in notes.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum 10 MB.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Build a unique filename: uuid + original extension
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const filename = `${randomUUID()}.${ext}`

    // Save to public/uploads/notes/ (served statically by Next.js)
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'notes')
    await mkdir(uploadDir, { recursive: true })
    await writeFile(join(uploadDir, filename), buffer)

    const url = `/uploads/notes/${filename}`
    return NextResponse.json({ success: true, url })
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
