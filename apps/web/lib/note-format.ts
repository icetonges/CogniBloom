import { format, parseISO } from 'date-fns'

/** Convert subject to URL-safe slug segment: "AMC Math" → "amc-math" */
export function slugifySubject(subject: string | null | undefined): string {
  if (!subject?.trim()) return 'note'
  return (
    subject
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'note'
  )
}

/** Build the full note slug: "20260523-amc-math-047" */
export function buildNoteSlug(
  date: Date,
  subject: string | null | undefined,
  index: number,
): string {
  const datePrefix = format(date, 'yyyyMMdd')
  const subjectSlug = slugifySubject(subject)
  const indexStr = String(index).padStart(3, '0')
  return `${datePrefix}-${subjectSlug}-${indexStr}`
}

/** Display title: "May 23 2026 · AMC Math · #047" */
export function formatNoteTitle(note: {
  createdAt: string | Date
  subject?: string | null
  subjectIndex?: number | null
}): string {
  const date =
    typeof note.createdAt === 'string' ? parseISO(note.createdAt) : note.createdAt
  const dateStr = format(date, 'MMM d yyyy')
  const subject = note.subject?.trim() || 'Note'
  const index =
    note.subjectIndex != null
      ? `#${String(note.subjectIndex).padStart(3, '0')}`
      : null
  return index ? `${dateStr} · ${subject} · ${index}` : `${dateStr} · ${subject}`
}

/** Sidebar/compact label: "May 23 · AMC Math" */
export function formatSidebarLabel(note: {
  createdAt: string | Date
  subject?: string | null
}): string {
  const date =
    typeof note.createdAt === 'string' ? parseISO(note.createdAt) : note.createdAt
  const subject = note.subject?.trim() || 'Note'
  return `${format(date, 'MMM d')} · ${subject}`
}

/** Group key for timeline: "2026-05-23" */
export function getDateGroupKey(createdAt: string | Date): string {
  const date =
    typeof createdAt === 'string' ? parseISO(createdAt) : createdAt
  return format(date, 'yyyy-MM-dd')
}

/** Timeline heading: "May 23, 2026" */
export function formatTimelineHeading(dateKey: string): string {
  return format(parseISO(dateKey), 'MMMM d, yyyy')
}
