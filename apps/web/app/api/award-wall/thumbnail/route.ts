import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const MAX_FILE_SIZE = 20 * 1024 * 1024  // 20 MB

/**
 * POST /api/award-wall/thumbnail
 *
 * Accepts a PDF file upload, renders page 1 to PNG using MuPDF WASM,
 * returns a base64 JPEG thumbnail suitable for storing in localStorage.
 *
 * Body: multipart/form-data  { file: File }
 * Response: { thumbnail: string }   (data:image/jpeg;base64,...)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.type !== 'application/pdf')
      return NextResponse.json({ error: 'PDF files only' }, { status: 415 })
    if (file.size > MAX_FILE_SIZE)
      return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 413 })

    const buffer = Buffer.from(await file.arrayBuffer())

    // Render only page 1 using mupdf WASM
    const mupdf = await import('mupdf')
    const doc = mupdf.Document.openDocument(new Uint8Array(buffer), 'application/pdf')
    const page = doc.loadPage(0)  // page 1

    // 120 DPI is sharp enough for a thumbnail and keeps file size small
    const scale = 120 / 72
    const matrix = mupdf.Matrix.scale(scale, scale)
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true)
    const pngBytes = pixmap.asPNG()

    pixmap.destroy()
    page.destroy()
    doc.destroy()

    // Convert PNG buffer → JPEG base64 data URL using sharp or canvas
    // Since sharp isn't available, use PNG base64 directly (still compact enough for thumbnails)
    const pngBase64 = Buffer.from(pngBytes).toString('base64')
    const thumbnail = `data:image/png;base64,${pngBase64}`

    return NextResponse.json({ thumbnail })
  } catch (err) {
    console.error('[award-wall/thumbnail]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
