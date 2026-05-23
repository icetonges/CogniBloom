import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_SIZE = 25 * 1024 * 1024 // 25 MB

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function textToHtml(text: string): string {
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
 * Use Gemini 2.5 Flash vision to extract structured HTML from a PDF or image.
 * Handles scanned / image-only PDFs, math exams, diagrams, handwritten notes.
 */
async function extractViaGemini(
  buffer: Buffer,
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
  fileName: string
): Promise<{ html: string; title?: string }> {
  const apiKey = process.env['GOOGLE_API_KEY'] ?? process.env['GEMINI_API_KEY']
  if (!apiKey) throw new Error('No Google API key configured for vision extraction.')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `You are a document extraction assistant. Extract ALL text content from this document and return it as clean HTML.

Rules:
- Preserve headings as <h1>, <h2>, <h3>
- Preserve paragraphs as <p>
- Preserve lists as <ul>/<ol> with <li> items
- Preserve tables as <table><tr><th>/<td> structure
- For math/formulas: write as plain text (e.g. x^2 + y^2 = r^2)
- For numbered problems/questions: use <ol><li> for the question list
- Do NOT wrap in <html>/<body>/<!DOCTYPE> tags
- Do NOT include any explanation -- output ONLY the HTML content
- If the document is a test/exam, preserve all question numbers and answer choices

Document filename: ${fileName}`

  const result = await model.generateContent([
    { inlineData: { mimeType, data: buffer.toString('base64') } },
    prompt,
  ])

  const raw = result.response.text().trim()
  const html = raw
    .replace(/^```(?:html)?\s*/im, '')
    .replace(/```\s*$/im, '')
    .trim()

  const titleMatch = html.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/i)
  const title = titleMatch
    ? titleMatch[1].replace(/<[^>]+>/g, '').trim()
    : fileName.replace(/\.(pdf|docx?|txt|png|jpe?g|webp|gif)$/i, '').replace(/[-_]/g, ' ').trim()

  return { html: html || '<p>(No content could be extracted)</p>', title }
}

/**
 * POST /api/notes/import-document
 * Accepts multipart/form-data with a single `file` field.
 * Supports: .txt, .pdf, .docx, images
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
    const rawTitle = name
      .replace(/\.(pdf|docx?|txt|png|jpe?g|webp|gif)$/i, '')
      .replace(/[-_]/g, ' ')
      .trim()

    // ---- TXT ----------------------------------------------------------------
    if (lowerName.endsWith('.txt') || file.type === 'text/plain') {
      const text = buffer.toString('utf-8')
      const html = textToHtml(text)
      return NextResponse.json({ success: true, html, title: rawTitle })
    }

    // ---- Image files --------------------------------------------------------
    if (file.type.startsWith('image/')) {
      try {
        const mime = file.type as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
        const { html, title } = await extractViaGemini(buffer, mime, name)
        return NextResponse.json({ success: true, html, title: title ?? rawTitle })
      } catch (err) {
        console.error('Image vision extraction error:', err)
        // Graceful fallback: embed as base64 image
        const base64 = buffer.toString('base64')
        const html = `<img src="data:${file.type};base64,${base64}" alt="${escapeHtml(rawTitle)}" />`
        return NextResponse.json({ success: true, html, title: rawTitle })
      }
    }

    // ---- PDF ----------------------------------------------------------------
    if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
      // Stage 1: fast text extraction (works for PDFs with a text layer)
      let textHtml = ''
      try {
        const { default: pdfParse } = await import('pdf-parse')
        const data = await (pdfParse as unknown as (buf: Buffer) => Promise<{ text: string; numpages: number }>)(buffer)
        const cleaned = data.text.replace(/\s+/g, ' ').trim()
        if (cleaned.length >= 100) {
          textHtml = textToHtml(data.text)
        }
      } catch {
        // pdf-parse failed -- fall through to Gemini vision
      }

      if (textHtml) {
        return NextResponse.json({ success: true, html: textHtml, title: rawTitle })
      }

      // Stage 2: image-based / scanned / encrypted PDF -> Gemini vision
      try {
        const { html, title } = await extractViaGemini(buffer, 'application/pdf', name)
        return NextResponse.json({ success: true, html, title: title ?? rawTitle })
      } catch (err) {
        console.error('Gemini PDF vision error:', err)
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json(
          { error: `Could not extract PDF content. ${msg}` },
          { status: 422 }
        )
      }
    }

    // ---- DOCX ---------------------------------------------------------------
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

    // ---- DOC (legacy) -------------------------------------------------------
    if (lowerName.endsWith('.doc')) {
      return NextResponse.json(
        { error: 'Legacy .doc format is not supported. Please save as .docx and try again.' },
        { status: 422 }
      )
    }

    return NextResponse.json(
      { error: 'Unsupported file type. Supported formats: PDF, DOCX, TXT, PNG, JPG' },
      { status: 400 }
    )
  } catch (err) {
    console.error('Document import error:', err)
    return NextResponse.json({ error: 'Failed to process document' }, { status: 500 })
  }
}
