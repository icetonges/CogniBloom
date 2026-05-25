/**
 * Lightweight RSS 2.0 / Atom 1.0 parser for server-side use.
 * No external dependencies — parses XML with regex extraction.
 * Handles CDATA sections, HTML entities, and both feed formats.
 */

export interface RssItem {
  title: string
  description: string
  link: string
  pubDate?: string
  author?: string
  imageUrl?: string
}

/** Strip HTML tags and decode common entities */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Extract inner text from a tag (handles CDATA) */
function extractTag(block: string, tag: string): string {
  const pattern = new RegExp(
    `<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*<\\/${tag}>`,
    'i'
  )
  const m = block.match(pattern)
  return m ? stripHtml(m[1]!.trim()) : ''
}

/** Extract a tag attribute value */
function extractAttr(block: string, tag: string, attr: string): string {
  const pattern = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["']`, 'i')
  const m = block.match(pattern)
  return m ? m[1]!.trim() : ''
}

/** Try to find an image URL in an RSS item block */
function findImage(block: string): string {
  // <media:thumbnail url="..."> or <media:content url="..."> or <enclosure url="..." type="image/...">
  const patterns = [
    /media:thumbnail[^>]+url=["']([^"']+)["']/i,
    /media:content[^>]+url=["']([^"']+)["'][^>]+type=["']image/i,
    /<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image/i,
    /<img[^>]+src=["']([^"']+)["']/i,
  ]
  for (const p of patterns) {
    const m = block.match(p)
    if (m) return m[1]!
  }
  return ''
}

/**
 * Parse an RSS 2.0 or Atom 1.0 XML string into a list of items.
 * Returns at most `limit` items (default 10).
 */
export function parseRss(xml: string, limit = 10): RssItem[] {
  const items: RssItem[] = []

  // Detect format: RSS uses <item>, Atom uses <entry>
  const isAtom = xml.includes('<feed') && xml.includes('<entry')
  const blockPattern = isAtom
    ? /<entry[^>]*>([\s\S]*?)<\/entry>/gi
    : /<item[^>]*>([\s\S]*?)<\/item>/gi

  let match: RegExpExecArray | null
  while ((match = blockPattern.exec(xml)) !== null && items.length < limit) {
    const block = match[1]!

    const title = extractTag(block, 'title') || 'Untitled'

    // Link: RSS uses <link>, Atom can use <link href="..."> or <link>text</link>
    let link = extractAttr(block, 'link', 'href') || extractTag(block, 'link')
    if (!link) link = ''

    // Description: RSS uses <description>, Atom uses <summary> or <content>
    const description =
      extractTag(block, 'description') ||
      extractTag(block, 'summary') ||
      extractTag(block, 'content') ||
      ''

    const pubDate =
      extractTag(block, 'pubDate') ||
      extractTag(block, 'published') ||
      extractTag(block, 'updated') ||
      undefined

    const author =
      extractTag(block, 'author') ||
      extractTag(block, 'dc:creator') ||
      undefined

    const imageUrl = findImage(block) || undefined

    items.push({
      title: title.slice(0, 200),
      description: description.slice(0, 800),
      link,
      pubDate,
      author,
      imageUrl,
    })
  }

  return items
}

/** Fetch and parse an RSS/Atom feed URL. Returns [] on any error. */
export async function fetchRss(url: string, limit = 10): Promise<RssItem[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CogniBloom-FeedBot/1.0' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const xml = await res.text()
    return parseRss(xml, limit)
  } catch (err) {
    console.warn(`[rss] fetchRss(${url}) failed:`, err)
    return []
  }
}
