import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_SIZE = 25 * 1024 * 1024 // 25 MB

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function textToHtml(text: string): string {
  // Split on double newlines (paragraphs), handle single newlines as <br>
  return text
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((para) => {
      const escaped = escapeHtml(para.trim()).replace(/\n/g, '<br>')
      return `<p>${escaped}</p>`
    })
    .join('')
}

/**
 * POST /api/notes/import-document
 * Accepts multipart/form-data with a single `file` field.
 * Supports: .txt, .pdf, .docx
 * Returns: { success: true, html: string, title?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 25 MB)' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const name = file.name
    const lowerName = name.toLowerCase()
    // Derive a clean title from filename
    const rawTitle = name.replace(/\.(pdf|docx?|txt)$/i, '').replace(/[-_]/g, ' ').trim()

    // ── TXT ──────────────────────────────────────────────────────────────────
    if (lowerName.endsWith('.txt') || file.type === 'text/plain') {
      const text = buffer.toString('utf-8')
      const html = textToHtml(text)
      return NextResponse.json({ success: true, html, title: rawTitle })
    }

    // ── PDF ──────────────────────────────────────────────────────────────────
    if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
      try {
        const { default: pdfParse } = await import('pdf-parse')
        const data = await (pdfParse as unknown as (buf: Buffer) => Promise<{ text: string; numpages: number }>)(buffer)
        const html = textToHtml(data.text)
        return NextResponse.json({ success: true, html, title: rawTitle, pages: data.numpages })
      } catch (err) {
        console.error('PDF parse error:', err)
        return NextResponse.json({ error: 'Failed to parse PDF. The file may be encrypted or image-only.' }, { status: 422 })
      }
    }

    // ── DOCX ─────────────────────────────────────────────────────────────────
    if (
      lowerName.endsWith('.docx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      try {
        const mammoth = await import('mammoth')
        const result = await mammoth.convertToHtml({ buffer })
        const html = result.value || '<p>(empty document)</p>'
        return NextResponse.json({ success: true, html, title: rawTitle })
      } catch (err) {
        console.error('DOCX parse error:', err)
        return NextResponse.json({ error: 'Failed to parse DOCX file.' }, { status: 422 })
      }
    }

    // ── DOC (legacy) ─────────────────────────────────────────────────────────
    if (lowerName.endsWith('.doc')) {
      return NextResponse.json(
        { error: 'Legacy .doc format is not supported. Please save as .docx and try again.' },
        { status: 422 }
      )
    }

    return NextResponse.json(
      { error: 'Unsupported file type. Supported formats: PDF, DOCX, TXT' },
      { status: 400 }
    )
  } catch (err) {
    console.error('Document import error:', err)
    return NextResponse.json({ error: 'Failed to process document' }, { status: 500 })
  }
}
