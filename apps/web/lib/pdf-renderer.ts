/**
 * PDF page renderer using MuPDF WASM.
 *
 * mupdf is a pure WASM port of the MuPDF library — no native C deps,
 * no DOMMatrix, works in Vercel serverless Node.js functions.
 *
 * Usage:
 *   const pages = await renderPdfPages(pdfBuffer)
 *   // pages[0].png  → Buffer (PNG bytes)
 *   // pages[0].pageIndex → 0-based page number
 */

export interface RenderedPage {
  pageIndex: number
  png: Buffer        // raw PNG bytes — pass directly to CLIP embedImage()
  base64: string     // base64 PNG — store in DB, pass to Gemini Vision at query time
  width: number
  height: number
}

/**
 * Render every page of a PDF to a PNG at 150 DPI (good for CLIP, not huge).
 * Returns one RenderedPage per page.
 */
export async function renderPdfPages(pdfBuffer: Buffer): Promise<RenderedPage[]> {
  // Dynamic import — mupdf is ESM and heavy; only load when needed
  const mupdf = await import('mupdf')

  const doc = mupdf.Document.openDocument(
    new Uint8Array(pdfBuffer),
    'application/pdf'
  )

  const pageCount = doc.countPages()
  const results: RenderedPage[] = []

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i)

    // 150 DPI: scale = DPI / 72  (PDFs are 72 DPI native)
    const scale = 150 / 72
    const matrix = mupdf.Matrix.scale(scale, scale)

    const pixmap = page.toPixmap(
      matrix,
      mupdf.ColorSpace.DeviceRGB,
      false,  // no alpha
      true    // anti-alias
    )

    const pngBytes = pixmap.asPNG()
    const png = Buffer.from(pngBytes)

    results.push({
      pageIndex: i,
      png,
      base64: png.toString('base64'),
      width: pixmap.getWidth(),
      height: pixmap.getHeight(),
    })

    // Free memory for this page
    pixmap.destroy()
    page.destroy()
  }

  doc.destroy()
  return results
}

/**
 * Detect if extracted text for a page contains figure descriptions.
 * Used to decide which pages need CLIP embedding.
 */
export function pageHasFigures(pageText: string): boolean {
  return /\[FIGURE:/i.test(pageText)
}
