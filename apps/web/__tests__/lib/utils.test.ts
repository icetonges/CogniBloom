import {
  cn,
  successResponse,
  errorResponse,
  AppError,
  Errors,
  truncate,
  slugify,
  formatDate,
  formatTime,
  percentage,
  chunk,
  unique,
  pick,
  omit,
  isDefined,
  isString,
  isNumber,
  isObject,
} from '@/lib/utils'

// ─── cn ──────────────────────────────────────────────────────────────────────

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('deduplicates conflicting tailwind classes (last wins)', () => {
    const result = cn('text-red-500', 'text-blue-500')
    expect(result).toBe('text-blue-500')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'nope', 'yes')).toBe('base yes')
  })

  it('handles undefined / null gracefully', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b')
  })
})

// ─── successResponse / errorResponse ─────────────────────────────────────────

describe('successResponse', () => {
  it('returns success:true with data', () => {
    const res = successResponse({ id: '1' })
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ id: '1' })
    expect(res.meta).toHaveProperty('timestamp')
  })

  it('includes optional message', () => {
    const res = successResponse(null, 'Created')
    expect(res.message).toBe('Created')
  })

  it('merges extra meta fields', () => {
    const res = successResponse([], undefined, { total: 42 })
    expect((res.meta as { total: number }).total).toBe(42)
  })
})

describe('errorResponse', () => {
  it('returns success:false with error string', () => {
    const { response, status } = errorResponse('Not found', 404)
    expect(response.success).toBe(false)
    expect(response.error).toBe('Not found')
    expect(status).toBe(404)
  })

  it('accepts an Error object', () => {
    const { response } = errorResponse(new Error('Boom'))
    expect(response.error).toBe('Boom')
  })

  it('defaults to status 400', () => {
    const { status } = errorResponse('oops')
    expect(status).toBe(400)
  })
})

// ─── AppError ─────────────────────────────────────────────────────────────────

describe('AppError', () => {
  it('creates an error with code and statusCode', () => {
    const err = new AppError('NOT_FOUND', 'Gone', 404)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.statusCode).toBe(404)
    expect(err.message).toBe('Gone')
    expect(err.name).toBe('AppError')
  })

  it('toApiError returns a plain object', () => {
    const err = new AppError('BAD', 'Bad input', 400, { field: 'email' })
    const api = err.toApiError()
    expect(api.code).toBe('BAD')
    expect(api.statusCode).toBe(400)
    expect(api.details).toEqual({ field: 'email' })
  })
})

describe('Errors', () => {
  it('UNAUTHORIZED returns 401', () => {
    const err = Errors.UNAUTHORIZED()
    expect(err.statusCode).toBe(401)
    expect(err.code).toBe('UNAUTHORIZED')
  })

  it('NOT_FOUND includes resource name', () => {
    const err = Errors.NOT_FOUND('Note')
    expect(err.message).toContain('Note')
    expect(err.statusCode).toBe(404)
  })

  it('BAD_REQUEST passes message through', () => {
    const err = Errors.BAD_REQUEST('Missing field')
    expect(err.message).toBe('Missing field')
    expect(err.statusCode).toBe(400)
  })

  it('INTERNAL_ERROR returns 500', () => {
    expect(Errors.INTERNAL_ERROR().statusCode).toBe(500)
  })

  it('RATE_LIMIT returns 429', () => {
    expect(Errors.RATE_LIMIT().statusCode).toBe(429)
  })

  it('CONFLICT returns 409', () => {
    const err = Errors.CONFLICT('Already exists')
    expect(err.statusCode).toBe(409)
    expect(err.message).toBe('Already exists')
  })
})

// ─── truncate ─────────────────────────────────────────────────────────────────

describe('truncate', () => {
  it('returns string unchanged when within limit', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('truncates and appends ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello...')
  })

  it('handles exact-length string', () => {
    expect(truncate('hello', 5)).toBe('hello')
  })
})

// ─── slugify ──────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('strips special characters', () => {
    expect(slugify('Café & Résumé!')).toBe('caf-rsum')
  })

  it('collapses multiple hyphens', () => {
    expect(slugify('a  b  c')).toBe('a-b-c')
  })

  it('trims leading/trailing hyphens', () => {
    expect(slugify('  hello  ')).toBe('hello')
  })
})

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a date in short format', () => {
    const d = new Date('2024-06-15')
    const result = formatDate(d, 'short')
    expect(result).toContain('2024')
    expect(result).toContain('Jun')
  })

  it('formats a date in long format', () => {
    const d = new Date('2024-06-15T10:30:00')
    const result = formatDate(d, 'long')
    expect(result).toContain('June')
    expect(result).toContain('2024')
  })

  it('defaults to short format', () => {
    const d = new Date('2024-01-01')
    const result = formatDate(d)
    expect(result).not.toContain(':') // no time in short
  })
})

// ─── formatTime ───────────────────────────────────────────────────────────────

describe('formatTime', () => {
  it('formats seconds only', () => {
    expect(formatTime(45)).toBe('45s')
  })

  it('formats minutes and seconds', () => {
    expect(formatTime(90)).toBe('1m 30s')
  })

  it('formats hours and minutes', () => {
    expect(formatTime(3661)).toBe('1h 1m')
  })

  it('handles zero', () => {
    expect(formatTime(0)).toBe('0s')
  })
})

// ─── percentage ───────────────────────────────────────────────────────────────

describe('percentage', () => {
  it('returns correct percentage', () => {
    expect(percentage(50, 200)).toBe(25)
  })

  it('rounds to nearest integer', () => {
    expect(percentage(1, 3)).toBe(33)
  })

  it('returns 0 when total is 0', () => {
    expect(percentage(5, 0)).toBe(0)
  })

  it('returns 100 when value equals total', () => {
    expect(percentage(10, 10)).toBe(100)
  })
})

// ─── chunk ────────────────────────────────────────────────────────────────────

describe('chunk', () => {
  it('splits array into equal chunks', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]])
  })

  it('handles uneven split', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('handles empty array', () => {
    expect(chunk([], 3)).toEqual([])
  })

  it('handles chunk size larger than array', () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]])
  })
})

// ─── unique ───────────────────────────────────────────────────────────────────

describe('unique', () => {
  it('removes duplicates from primitive array', () => {
    expect(unique([1, 2, 2, 3])).toEqual([1, 2, 3])
  })

  it('uses key function for objects', () => {
    const items = [{ id: 1, v: 'a' }, { id: 2, v: 'b' }, { id: 1, v: 'c' }]
    expect(unique(items, (i) => i.id)).toHaveLength(2)
  })

  it('handles empty array', () => {
    expect(unique([])).toEqual([])
  })
})

// ─── pick ─────────────────────────────────────────────────────────────────────

describe('pick', () => {
  it('picks specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 }
    expect(pick(obj, 'a', 'c')).toEqual({ a: 1, c: 3 })
  })

  it('handles single key', () => {
    expect(pick({ x: 10, y: 20 }, 'x')).toEqual({ x: 10 })
  })
})

// ─── omit ─────────────────────────────────────────────────────────────────────

describe('omit', () => {
  it('omits specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 } as Record<string, number>
    expect(omit(obj, 'b')).toEqual({ a: 1, c: 3 })
  })

  it('omits multiple keys', () => {
    const obj = { a: 1, b: 2, c: 3 } as Record<string, number>
    expect(omit(obj, 'a', 'c')).toEqual({ b: 2 })
  })
})

// ─── Type guards ──────────────────────────────────────────────────────────────

describe('isDefined', () => {
  it('returns true for non-null/undefined values', () => {
    expect(isDefined(0)).toBe(true)
    expect(isDefined('')).toBe(true)
    expect(isDefined(false)).toBe(true)
  })

  it('returns false for null and undefined', () => {
    expect(isDefined(null)).toBe(false)
    expect(isDefined(undefined)).toBe(false)
  })
})

describe('isString', () => {
  it('returns true for strings', () => {
    expect(isString('hello')).toBe(true)
    expect(isString('')).toBe(true)
  })

  it('returns false for non-strings', () => {
    expect(isString(42)).toBe(false)
    expect(isString(null)).toBe(false)
    expect(isString({})).toBe(false)
  })
})

describe('isNumber', () => {
  it('returns true for valid numbers', () => {
    expect(isNumber(42)).toBe(true)
    expect(isNumber(0)).toBe(true)
    expect(isNumber(-1.5)).toBe(true)
  })

  it('returns false for NaN', () => {
    expect(isNumber(NaN)).toBe(false)
  })

  it('returns false for non-numbers', () => {
    expect(isNumber('42')).toBe(false)
    expect(isNumber(null)).toBe(false)
  })
})

describe('isObject', () => {
  it('returns true for plain objects', () => {
    expect(isObject({ a: 1 })).toBe(true)
    expect(isObject({})).toBe(true)
  })

  it('returns false for arrays, null, primitives', () => {
    expect(isObject([])).toBe(false)
    expect(isObject(null)).toBe(false)
    expect(isObject('hello')).toBe(false)
    expect(isObject(42)).toBe(false)
  })
})
