import { z } from 'zod'

// Common validation schemas
export const emailSchema = z.string().email('Invalid email address')

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain a special character')

export const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be less than 100 characters')

export const uuidSchema = z.string().uuid('Invalid UUID')

export const urlSchema = z.string().url('Invalid URL')

// User validation schemas
export const createUserSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  grade: z.number().int().min(0).max(12).optional(),
  age: z.number().int().min(5).max(18).optional(),
  role: z.enum(['STUDENT', 'PARENT', 'ADMIN']).default('STUDENT'),
})

export const updateUserSchema = z.object({
  name: nameSchema.optional(),
  grade: z.number().int().min(0).max(12).optional(),
  age: z.number().int().min(5).max(18).optional(),
  interests: z.array(z.string()).optional(),
  learningStyle: z.string().optional(),
})

// Note validation schemas
export const createNoteSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters'),
  content: z.string().min(1, 'Content is required').max(50000, 'Content is too long'),
  tags: z.array(z.string()).optional().default([]),
  subject: z.string().optional(),
  isPublic: z.boolean().optional().default(false),
})

export const updateNoteSchema = createNoteSchema.partial()

// Chat validation schemas
export const chatMessageSchema = z.object({
  content: z.string().min(1, 'Message is required').max(10000, 'Message is too long'),
  role: z.enum(['user', 'assistant', 'system']),
})

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema),
  sessionId: uuidSchema.optional(),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().int().min(1).max(4000).optional().default(1024),
})

// Quiz validation schemas
export const quizAnswerSchema = z.object({
  questionId: uuidSchema,
  answer: z.string(),
})

export const submitQuizSchema = z.object({
  quizId: uuidSchema,
  answers: z.array(quizAnswerSchema),
})

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// File upload validation
export const fileUploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().int().positive(),
  fileType: z.enum(['pdf', 'docx', 'image', 'video', 'audio', 'text']),
})

// Utility function to validate and handle errors
export async function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; error: z.ZodError }> {
  try {
    const validatedData = await schema.parseAsync(data)
    return { success: true, data: validatedData as T }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error }
    }
    throw error
  }
}

// Format Zod errors for API responses
export function formatZodErrors(error: z.ZodError) {
  return error.errors.reduce(
    (acc, err) => {
      const path = err.path.join('.')
      acc[path] = err.message
      return acc
    },
    {} as Record<string, string>
  )
}
