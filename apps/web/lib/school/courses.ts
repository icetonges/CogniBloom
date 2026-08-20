/**
 * Daniel Shang — Frost MS, Grade 7, 2026-2027 student schedule (STU202).
 *
 * Period 2 and period 6 are semester courses, so they swap at the S1→S2
 * boundary (start of Q3). Everything else is year-long.
 *
 * Course-code suffixes: `AA` = Advanced Academic (FCPS AAP Level IV),
 * `HN` = Honors — Algebra 1 HN carries high-school credit in 7th grade.
 */

import type { DateKey } from './calendar'
import { quarterOf } from './calendar'

export type MeetCode = 'ABG' | 'AB' | 'AG'
export type Term = 'YR' | 'S1' | 'S2'
export type Rigor = 'standard' | 'advanced' | 'honors'

export interface Course {
  /** Stable slug used in URLs, note tags and prep state. */
  id: string
  period: number
  term: Term
  /** FCPS course number. */
  code: string
  sectionId: string
  name: string
  short: string
  teacher: string
  room: string
  meets: MeetCode
  rigor: Rigor
  /** Subject bucket — lines up with the Notes/Flashcards subject filters. */
  subject: string
  emoji: string
  /** Tailwind-friendly accent, used consistently across planner/map/prep. */
  accent: string
  /** Physical things to have in the bag for this class. */
  materials: string[]
  /** Not a timed block — administrative/homeroom designator. */
  untimed?: boolean
  /** This class sits in the lunch double-block. */
  lunchBlock?: boolean
}

export const LUNCH_SLOT = 'A' as const

export const COURSES: readonly Course[] = [
  {
    id: 'us-history',
    period: 1,
    term: 'YR',
    code: '235502',
    sectionId: '235502-07',
    name: 'US History 7 AA',
    short: 'US History',
    teacher: 'Kirby, L.',
    room: 'E106',
    meets: 'ABG',
    rigor: 'advanced',
    subject: 'History',
    emoji: '🏛️',
    accent: '#f59e0b',
    materials: ['2" binder — History tab', 'Chromebook (charged)'],
  },
  {
    id: 'engineering',
    period: 2,
    term: 'S1',
    code: '846432',
    sectionId: '846432-2A',
    name: 'Engr 1 Design & Model',
    short: 'Engineering',
    teacher: 'Fox, B.',
    room: 'G112',
    meets: 'AG',
    rigor: 'standard',
    subject: 'Engineering',
    emoji: '📐',
    accent: '#38bdf8',
    materials: ['Engineering notebook', 'Pencil + ruler', 'Chromebook'],
  },
  {
    id: 'coding',
    period: 2,
    term: 'S2',
    code: '616032',
    sectionId: '616032-2B',
    name: 'Coding & Innov Tech',
    short: 'Coding',
    teacher: 'Fuller, C.',
    room: 'F122',
    meets: 'AG',
    rigor: 'standard',
    subject: 'Computer Science',
    emoji: '💻',
    accent: '#22d3ee',
    materials: ['Chromebook (charged)', 'Headphones'],
  },
  {
    id: 'algebra',
    period: 3,
    term: 'YR',
    code: '313036',
    sectionId: '313036-11',
    name: 'Algebra 1 HN',
    short: 'Algebra 1',
    teacher: 'Warren, T.',
    room: 'D104',
    meets: 'AB',
    rigor: 'honors',
    subject: 'Math',
    emoji: '📊',
    accent: '#a78bfa',
    materials: ['2" binder — Algebra tab', 'Graph paper', 'Scientific calculator', 'Chromebook'],
  },
  {
    id: 'ta-activity',
    period: 4,
    term: 'YR',
    code: '994700',
    sectionId: '994700-10',
    name: 'TA / Activity Gr 7',
    short: 'TA / Advisory',
    teacher: 'Kirby, L.',
    room: 'E106',
    meets: 'ABG',
    rigor: 'standard',
    subject: 'Advisory',
    emoji: '🧭',
    accent: '#94a3b8',
    materials: ['Planner', 'Anything due today'],
  },
  {
    id: 'french',
    period: 5,
    term: 'YR',
    code: '511300',
    sectionId: '511300-01',
    name: 'French 1 Part A',
    short: 'French 1',
    teacher: 'Beardsley, M.',
    room: 'D212',
    meets: 'AB',
    rigor: 'standard',
    subject: 'French',
    emoji: '🇫🇷',
    accent: '#f472b6',
    materials: ['2" binder — French tab', 'Vocab flashcards', 'Chromebook'],
    lunchBlock: true,
  },
  {
    id: 'pe-s1',
    period: 6,
    term: 'S1',
    code: '712033',
    sectionId: '712033-14',
    name: 'Health & PE 7',
    short: 'Health & PE',
    teacher: 'Shields, J.',
    room: 'Gym 2',
    meets: 'AG',
    rigor: 'standard',
    subject: 'Health & PE',
    emoji: '🏃',
    accent: '#34d399',
    materials: ['Gym clothes', 'Sneakers', 'Water bottle', 'Lock for locker'],
    lunchBlock: true,
  },
  {
    id: 'pe-s2',
    period: 6,
    term: 'S2',
    code: '712034',
    sectionId: '712034-14',
    name: 'Health & PE 7',
    short: 'Health & PE',
    teacher: 'Shields, J.',
    room: 'Gym 2',
    meets: 'AG',
    rigor: 'standard',
    subject: 'Health & PE',
    emoji: '🏃',
    accent: '#34d399',
    materials: ['Gym clothes', 'Sneakers', 'Water bottle', 'Lock for locker'],
    lunchBlock: true,
  },
  {
    id: 'english',
    period: 7,
    term: 'YR',
    code: '111002',
    sectionId: '111002-07',
    name: 'English 7 AA',
    short: 'English',
    teacher: 'Champagne, J.',
    room: 'E109',
    meets: 'AB',
    rigor: 'advanced',
    subject: 'English',
    emoji: '📖',
    accent: '#fb923c',
    materials: ['2" binder — English tab', 'Independent reading book', 'Chromebook'],
  },
  {
    id: 'life-science',
    period: 8,
    term: 'YR',
    code: '411502',
    sectionId: '411502-06',
    name: 'Life Science AA',
    short: 'Life Science',
    teacher: 'Bolton, S.',
    room: 'C110',
    meets: 'AG',
    rigor: 'advanced',
    subject: 'Science',
    emoji: '🧬',
    accent: '#4ade80',
    materials: ['2" binder — Science tab', 'Lab notebook', 'Chromebook'],
  },
  {
    id: 'team',
    period: 9,
    term: 'YR',
    code: '003700',
    sectionId: '003700-03',
    name: 'Team Designator 7th Gr',
    short: 'Team',
    teacher: 'Genesis / Joo, S.',
    room: 'StuSer',
    meets: 'ABG',
    rigor: 'standard',
    subject: 'Advisory',
    emoji: '👥',
    accent: '#64748b',
    materials: [],
    untimed: true,
  },
] as const

/** Everything Daniel should have in the bag every single day. */
export const EVERYDAY_KIT: readonly string[] = [
  '2-inch binder (all subject tabs)',
  'Chromebook — charged',
  'Charger',
  'Pencil case: 2 pencils, eraser, blue/black pen, highlighter',
  'Water bottle',
  'Student ID / lunch code',
] as const

// ── Lookups ─────────────────────────────────────────────────────────────────

export function courseById(id: string): Course | undefined {
  return COURSES.find((c) => c.id === id)
}

/** Which semester a date falls in — S1 = quarters 1-2, S2 = quarters 3-4. */
export function semesterOf(key: DateKey): 'S1' | 'S2' {
  const q = quarterOf(key)
  return q && q.n >= 3 ? 'S2' : 'S1'
}

/** The courses actually enrolled on a given date (resolves the S1/S2 swap). */
export function coursesOn(key: DateKey): Course[] {
  const sem = semesterOf(key)
  return COURSES.filter((c) => c.term === 'YR' || c.term === sem)
}

/** Does this course meet on a blue / gray day? */
export function meetsOn(course: Course, dayType: 'blue' | 'gray'): boolean {
  if (course.meets === 'ABG') return true
  return dayType === 'blue' ? course.meets === 'AB' : course.meets === 'AG'
}

/** All distinct rooms Daniel ever visits — used to highlight the floor plan. */
export const MY_ROOMS: readonly string[] = Array.from(new Set(COURSES.map((c) => c.room)))
