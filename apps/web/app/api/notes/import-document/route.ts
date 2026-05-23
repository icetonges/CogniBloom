import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'
export const maxDuration = 120

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
 * Convert inline <svg> elements to base64 data-URI <img> tags.
 * TipTap's Image extension accepts <img allowBase64> but NOT raw <svg> nodes —
 * raw SVGs are stripped by TipTap's schema on insertion.
 */
function convertSvgToImg(html: string): string {
  return html.replace(/<svg\b[\s\S]*?<\/svg>/gi, (svg) => {
    // Ensure the SVG carries its namespace so browsers render it correctly
    const withNs = svg.includes('xmlns=')
      ? svg
      : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
    const b64 = Buffer.from(withNs).toString('base64')
    return `<img src="data:image/svg+xml;base64,${b64}" alt="figure" style="max-width:100%;display:block;margin:8px auto;" />`
  })
}

/**
 * Use Gemini 2.0 Flash vision to extract structured, science-compliant HTML.
 *
 * Output format is designed for TipTap compatibility:
 *   • Math (block)  → <div data-math-block data-latex="LaTeX">  (rendered by KaTeX)
 *   • Math (inline) → <span data-math-inline data-latex="LaTeX"> (rendered by KaTeX)
 *   • Figures/diagrams → <svg> (post-processed → base64 <img> by convertSvgToImg)
 *   • Chemistry, physics, geometry all use the above conventions
 */
async function extractViaGemini(
  buffer: Buffer,
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
  fileName: string
): Promise<{ html: string; title?: string }> {
  const apiKey = process.env['GOOGLE_API_KEY'] ?? process.env['GEMINI_API_KEY']
  if (!apiKey) throw new Error('No Google API key configured for vision extraction.')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const prompt = `You are a science-aware document extraction assistant. Extract ALL content from this document and return it as HTML that is compatible with a TipTap rich-text editor.

═══ TEXT STRUCTURE ═══
- Headings → <h1>, <h2>, <h3>
- Paragraphs → <p>
- Lists → <ul>/<ol> with <li>
- Tables → <table><tr><th>/<td>
- Numbered exam questions → <ol><li> preserving ALL question numbers, sub-parts, and answer choices

═══ MATH & FORMULAS (critical — use EXACTLY these tags) ═══
- Block equations (standalone line) → <div data-math-block data-latex="LATEX_HERE"></div>
  Example: <div data-math-block data-latex="x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"></div>
- Inline math (within a sentence) → <span data-math-inline data-latex="LATEX_HERE"></span>
  Example: The area is <span data-math-inline data-latex="A = \\pi r^2"></span> square units.
- Use standard LaTeX notation inside the data-latex attribute
- Chemistry formulas: use subscripts/superscripts in LaTeX — e.g. data-latex="H_2O", "CO_2", "Fe^{2+}"
- Physics equations: E=mc^2 → data-latex="E = mc^2", F=ma → data-latex="F = ma"
- DO NOT write raw formulas as plain text — always use the data-math tags above

═══ FIGURES & DIAGRAMS (critical — never skip) ═══
- Geometric figures, shapes, coordinate grids → generate an accurate <svg viewBox="0 0 200 200"> using <rect>, <circle>, <polygon>, <path>, <line>, <text>. Match the original proportions and shading (black fill for shaded regions, white/none for unshaded).
- Chemistry: Lewis structures, molecular diagrams, reaction arrows → <svg> with bonds as <line> elements
- Physics: circuit diagrams, free-body diagrams, wave diagrams → <svg>
- Graphs/charts with data → <svg> with axes, data points, labels
- If a figure is too complex to represent as SVG, use: <figure><figcaption>[Detailed description of the figure, including all measurements, labels, and visual relationships]</figcaption></figure>
- Place every figure INLINE at the exact position it appears — NEVER omit it

═══ SCIENCE-SPECIFIC RULES ═══
- Chemical equations: reactants and products with proper arrow → use LaTeX: data-latex="H_2 + O_2 \\rightarrow H_2O"
- Subscripts in chemical names (non-LaTeX context): use <sub> and <sup> tags → H<sub>2</sub>O
- Units: keep units with their values — m/s, kg·m/s², °C, etc.
- Greek letters in text (non-formula): use Unicode — α β γ δ θ π Σ Δ λ μ ω
- Significant figures, measurements: preserve exactly as shown

═══ OUTPUT ═══
- Do NOT wrap in <html>/<body>/<!DOCTYPE> tags
- Do NOT add any explanation — output ONLY the HTML
- If this is an exam/problem set: every question number, figure, formula, and answer choice must appear

Document filename: ${fileName}`

  const result = await model.generateContent([
    { inlineData: { mimeType, data: buffer.toString('base64') } },
    prompt,
  ])

  const raw = result.response.text().trim()
  let html = raw
    .replace(/^```(?:html)?\s*/im, '')
    .replace(/```\s*$/im, '')
    .trim()

  // Convert any <svg> blocks to base64 <img> so TipTap's Image extension accepts them
  html = convertSvgToImg(html)

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
 *
 * PDF pipeline:
 *   Primary  → Gemini vision (text + figures as SVG→img + math as KaTeX data-attrs)
 *   Fallback → pdf-parse plain text (if Gemini unavailable/fails)
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
        // Fallback: embed as base64 image
        const base64 = buffer.toString('base64')
        const html = `<img src="data:${file.type};base64,${base64}" alt="${escapeHtml(rawTitle)}" />`
        return NextResponse.json({ success: true, html, title: rawTitle })
      }
    }

    // ---- PDF ----------------------------------------------------------------
    if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
      // Primary: Gemini vision — text + figures + math, all TipTap-compatible
      try {
        const { html, title } = await extractViaGemini(buffer, 'application/pdf', name)
        return NextResponse.json({ success: true, html, title: title ?? rawTitle })
      } catch (geminiErr) {
        console.error('Gemini PDF vision error:', geminiErr)

        // Fallback: pdf-parse plain text (loses figures, better than nothing)
        try {
          const { default: pdfParse } = await import('pdf-parse')
          const data = await (pdfParse as unknown as (buf: Buffer) => Promise<{ text: string; numpages: number }>)(buffer)
          const cleaned = data.text.replace(/\s+/g, ' ').trim()
          if (cleaned.length >= 50) {
            const html = textToHtml(data.text)
            return NextResponse.json({
              success: true,
              html: `<p style="color:#f59e0b;font-size:0.8em">⚠ Figures and formulas could not be extracted (AI vision unavailable). Text only.</p>${html}`,
              title: rawTitle,
            })
          }
        } catch {
          // pdf-parse also failed
        }

        const msg = geminiErr instanceof Error ? geminiErr.message : 'Unknown error'
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
        const html = convertSvgToImg(result.value || '<p>(empty document)</p>')
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
