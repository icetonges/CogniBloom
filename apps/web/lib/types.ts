// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
  meta?: {
    total?: number
    page?: number
    limit?: number
    timestamp?: string
  }
}

export type ApiError = {
  code: string
  message: string
  details?: Record<string, unknown>
  statusCode: number
}

// User types
export interface UserProfile {
  id: string
  email: string
  name: string
  clerkId: string
  role: 'STUDENT' | 'PARENT' | 'ADMIN'
  grade?: number
  age?: number
  learningStyle?: string
  interests: string[]
  createdAt: Date
  updatedAt: Date
}

// Tutor session types
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  fileUrl?: string
  imageUrl?: string
  citations?: Citation[]
}

export interface Citation {
  id: string
  title: string
  url: string
  source: string
  trustScore: number
}

// Note types
export interface Note {
  id: string
  userId: string
  title: string
  content: string
  tags: string[]
  subject?: string
  isPublic: boolean
  isBookmarked: boolean
  hasMath: boolean
  hasCode: boolean
  hasImages: boolean
  createdAt: Date
  updatedAt: Date
}

// Quiz types
export interface QuizQuestion {
  id: string
  type: 'multiple_choice' | 'short_answer' | 'code' | 'essay'
  question: string
  richContent?: string
  options?: Option[]
  correctAnswer: string
  explanation?: string
  studentAnswer?: string
  isCorrect?: boolean
  score?: number
}

export interface Option {
  id: string
  text: string
  isCorrect: boolean
}

// Learning profile types
export interface LearningMetrics {
  totalLessonsCompleted: number
  totalPracticeAnswered: number
  averageAccuracy: number
  currentStreak: number
  longestStreak: number
  masteryScores: Record<string, number>
  weakAreas: string[]
  strongAreas: string[]
}

// Daily feed types
export interface FeedItem {
  id: string
  type: string
  title: string
  description: string
  content: string
  subject: string
  difficulty: string
  gradeLevel: number[]
  estimatedTime: number
  isAiGenerated: boolean
  sourceUrl?: string
  credibility: number
  createdAt: Date
  expiresAt: Date
}

// Subscription types
export interface SubscriptionInfo {
  id: string
  userId: string
  plan: 'FREE' | 'PLUS' | 'PREMIUM'
  status: 'active' | 'cancelled' | 'past_due'
  monthlyQuota: number
  usedThisMonth: number
  currentPeriodStart: Date
  currentPeriodEnd: Date
}

// AI Provider types
export interface AIProviderConfig {
  name: 'anthropic' | 'google' | 'groq'
  model: string
  apiKey: string
  baseUrl?: string
}

export interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  temperature?: number
  maxTokens?: number
  topP?: number
}

export interface ChatResponse {
  id: string
  content: string
  role: 'assistant'
  tokensUsed: number
  processingTime: number
  citations?: Citation[]
}

export interface EmbeddingResponse {
  embedding: number[]
  model: string
  tokensUsed: number
}

// Audit log types
export interface AuditLogEntry {
  id: string
  userId: string
  action: string
  resource: string
  resourceId?: string
  changes: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}

// Helper type for async operations
export type AsyncResult<T> =
  | {
      success: true
      data: T
    }
  | {
      success: false
      error: ApiError
    }

// Pagination
export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}
