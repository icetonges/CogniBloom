'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'

const EXTRACT_PROMPT = `This is a certificate, award, transcript, or academic document. Extract the following fields if present:

- title: The name of the certificate, award, course, or achievement (short, clear)
- description: What it was awarded for — include the course name, grade, score, or accomplishment if mentioned
- date: The issue or completion date in YYYY-MM-DD format (use best estimate if only month/year shown)
- issuer: The institution, organization, or platform that issued it

Return ONLY valid JSON with those four keys. If a field is not found, use an empty string.
Example: {"title":"Python Programming Certificate","description":"Completed Introduction to Programming in Python with distinction","date":"2025-06-01","issuer":"University of Cape Town"}`

export interface ExtractResult {
  title?: string
  description?: string
  date?: string
  issuer?: string
  error?: string
}

export async function extractCertificateInfo(formData: FormData): Promise<ExtractResult> {
  const file = formData.get('file') as File | null
  if (!file) return { error: 'No file provided' }

  const isPdf = file.type === 'application/pdf'
  const isImage = file.type.startsWith('image/')
  if (!isPdf && !isImage) return { error: 'Unsupported file type — upload a PDF or image' }

  const apiKey = process.env['GOOGLE_API_KEY'] ?? process.env['GEMINI_API_KEY']
  if (!apiKey) return { error: 'AI extraction not configured' }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const genAI = new GoogleGenerativeAI(apiKey)
    // Use lite model — fast, cheap, handles both PDF and images
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

    const mimeType = isPdf ? 'application/pdf' : (file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif')

    const result = await model.generateContent([
      { inlineData: { mimeType, data: buffer.toString('base64') } },
      EXTRACT_PROMPT,
    ])

    const text = result.response.text().trim()
    const match = text.match(/\{[\s\S]*?\}/)
    if (!match) return { error: 'Could not parse document' }

    const parsed = JSON.parse(match[0]) as Record<string, string>
    return {
      title: parsed['title'] ?? '',
      description: parsed['description'] && parsed['issuer']
        ? `${parsed['description']} — ${parsed['issuer']}`
        : parsed['description'] ?? parsed['issuer'] ?? '',
      date: parsed['date'] ?? '',
      issuer: parsed['issuer'] ?? '',
    }
  } catch (err) {
    console.error('[extractCertificate]', err)
    return { error: 'Extraction failed — fill in the fields manually' }
  }
}
