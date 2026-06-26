import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /notes/view/[slug]
// Serves the self-contained published HTML page directly to the browser.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const note = await db.note.findFirst({
    where: { publishedSlug: slug },
    select: { publishedHtml: true },
  })

  if (!note?.publishedHtml) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Not Found</title></head>
       <body style="font-family:sans-serif;background:#060c18;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;">
         <h1 style="font-size:2rem;">404 — Note not found</h1>
         <p style="color:#64748b;">This note has not been published yet.</p>
         <a href="/dashboard/notes" style="color:#6366f1;text-decoration:none;">← Back to notes</a>
       </body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  return new NextResponse(note.publishedHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // no-store prevents Vercel CDN and browser from caching the HTML blob,
      // so republishing a note is reflected immediately without a cache purge.
      'Cache-Control': 'no-store',
    },
  })
}
