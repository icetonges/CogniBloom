import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ApiError, ApiResponse } from './types'

// Combine Tailwind classes intelligently
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// API response helpers
export function successResponse<T>(data: T, message?: string, meta?: unknown): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  }
}

export function errorResponse(
  error: string | Error,
  statusCode = 400
): {
  response: ApiResponse<null>
  status: number
} {
  const message = typeof error === 'string' ? error : error.message

  return {
    response: {
      success: false,
      error: message,
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    status: statusCode,
  }
}

// Error factory
export class AppError extends Error {
  constructor(
    public code: string,
    public override message: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }

  toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details as Record<string, unknown> | undefined,
    }
  }
}

// Common errors
export const Errors = {
  UNAUTHORIZED: () =>
    new AppError('UNAUTHORIZED', 'You are not authorized to access this resource', 401),
  NOT_FOUND: (resource: string) =>
    new AppError('NOT_FOUND', `${resource} not found`, 404),
  BAD_REQUEST: (message: string) => new AppError('BAD_REQUEST', message, 400),
  INTERNAL_ERROR: () =>
    new AppError('INTERNAL_ERROR', 'An internal server error occurred', 500),
  VALIDATION_ERROR: (details: unknown) =>
    new AppError('VALIDATION_ERROR', 'Validation failed', 422, details),
  RATE_LIMIT: () =>
    new AppError('RATE_LIMIT', 'Too many requests. Please try again later', 429),
  CONFLICT: (message: string) => new AppError('CONFLICT', message, 409),
}

// String utilities
export function truncate(str: string, length: number) {
  return str.length > length ? `${str.substring(0, length)}...` : str
}

export function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Date utilities
export function formatDate(date: Date, format: 'short' | 'long' = 'short') {
  const options: Intl.DateTimeFormatOptions =
    format === 'short'
      ? { year: 'numeric', month: 'short', day: 'numeric' }
      : { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }

  return new Intl.DateTimeFormat('en-US', options).format(date)
}

export function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`
  }
  return `${secs}s`
}

// Async utilities
export async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number
    delayMs?: number
    backoff?: boolean
  } = {}
): Promise<T> {
  const { retries = 3, delayMs = 1000, backoff = true } = options

  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === retries - 1) throw error

      const wait = backoff ? delayMs * Math.pow(2, i) : delayMs
      await delay(wait)
    }
  }

  throw new Error('Retry failed')
}

// Number utilities
export function formatNumber(num: number, decimals = 0) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

export function percentage(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100)
}

// Array utilities
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

export function unique<T>(array: T[], key?: (item: T) => unknown): T[] {
  if (!key) {
    return Array.from(new Set(array))
  }

  const seen = new Set()
  return array.filter((item) => {
    const k = key(item)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// Object utilities
export function pick<T, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>
  keys.forEach((key) => {
    result[key] = obj[key]
  })
  return result
}

export function omit<T extends Record<string, unknown>, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  const result = { ...obj }
  keys.forEach((key) => {
    delete result[key]
  })
  return result as Omit<T, K>
}

// Type guards
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value)
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
