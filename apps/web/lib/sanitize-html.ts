/**
 * Client-side HTML sanitizer using DOMPurify.
 * Call sanitizeHtml() only in client components (browser environment).
 */

let DOMPurify: typeof import('dompurify') | null = null

async function getDOMPurify() {
  if (!DOMPurify) {
    const mod = await import('dompurify')
    DOMPurify = mod.default
  }
  return DOMPurify
}

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'del', 'ins',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'hr', 'div', 'span',
  'mark', 'sup', 'sub',
]

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'id',
  'target', 'rel', 'width', 'height',
  'colspan', 'rowspan',
]

const PURIFY_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
  FORCE_BODY: true,
} as const

export async function sanitizeHtml(html: string): Promise<string> {
  if (typeof window === 'undefined') return html // SSR passthrough
  const purify = await getDOMPurify()
  return purify.sanitize(html, PURIFY_CONFIG)
}

/** Synchronous version — use only when DOMPurify is guaranteed loaded (after first async call) */
export function sanitizeHtmlSync(html: string): string {
  if (typeof window === 'undefined') return html
  if (!DOMPurify) return html // not loaded yet, return as-is (will be sanitized once loaded)
  return DOMPurify.sanitize(html, PURIFY_CONFIG)
}
