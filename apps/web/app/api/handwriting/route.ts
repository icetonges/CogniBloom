import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// POST /api/handwriting — transcribe a handwritten-ink PNG into text using
// Gemini vision. Body: { image: "data:image/png;base64,...." }
// Returns: { success, text }
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { image?: string }
    const image = body.image ?? ''
    const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(image)
    if (!m) {
      return NextResponse.json({ error: 'image data URL required' }, { status: 400 })
    }
    const mimeType = m[1]
    const base64 = m[2]

    const apiKey = process.env['GOOGLE_API_KEY'] ?? process.env['GEMINI_API_KEY']
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Handwriting recognition is not configured (no Google API key).' },
        { status: 503 }
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt =
      'You are a precise handwriting transcription engine. Transcribe the ' +
      'handwritten note in this image into clean digital text. Preserve line ' +
      'breaks, math, and symbols as written. If a word is unclear, give your ' +
      'best reading. Return ONLY the transcribed text — no preamble, no quotes, ' +
      'no commentary. If the image is blank, return an empty string.'

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType, data: base64 } },
    ])

    const text = (result.response.text() ?? '').trim()
    return NextResponse.json({ success: true, text })
  } catch (err) {
    console.error('[POST /api/handwriting]', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
