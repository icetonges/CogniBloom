# CogniBloom Development Guide

## Quick Reference

### Starting Development

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your values

# Setup database
pnpm db:migrate

# Start dev server
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Project Architecture

### Folder Organization

```
apps/web/
├── app/                 # Next.js App Router
│   ├── (auth)/         # Authentication routes
│   ├── (dashboard)/    # Protected routes
│   └── api/            # API routes
├── components/         # React components
│   └── ui/            # shadcn/ui components
├── lib/               # Utilities & business logic
│   ├── ai/           # AI provider abstraction (Phase 2)
│   ├── db.ts         # Database client
│   ├── types.ts      # TypeScript types
│   ├── utils.ts      # Utility functions
│   └── validation.ts # Zod schemas
├── hooks/            # Custom React hooks
├── prisma/           # Database schema
└── public/           # Static assets
```

## Development Standards

### Code Style

- **Language**: TypeScript (strict mode)
- **Formatting**: Prettier (100 char width)
- **Linting**: ESLint + Next.js rules
- **Component Pattern**: Functional + hooks

### Naming Conventions

```typescript
// Components: PascalCase
export function UserProfile() {}

// Utilities: camelCase
export function formatDate(date: Date) {}

// Types: PascalCase
interface UserProfile {}
type Status = 'active' | 'inactive'

// Enums: PascalCase
enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3
```

### File Structure

```typescript
// 1. Imports
import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// 2. Types
interface Props {
  disabled?: boolean
}

// 3. Constants
const TIMEOUT_MS = 5000

// 4. Component
export function MyComponent({ disabled }: Props) {
  // implementation
}

// 5. Exports
export default MyComponent
```

## Database Operations

### Using Prisma

```typescript
import { db } from '@/lib/db'

// Read
const user = await db.user.findUnique({
  where: { id: '123' },
})

// Create
const newUser = await db.user.create({
  data: {
    email: 'user@example.com',
    name: 'User',
    clerkId: 'clerk_123',
  },
})

// Update
const updated = await db.user.update({
  where: { id: '123' },
  data: { name: 'Updated' },
})

// Delete
await db.user.delete({
  where: { id: '123' },
})

// List with pagination
const users = await db.user.findMany({
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' },
})
```

### Migrations

```bash
# Create migration
pnpm db:migrate dev --name add_new_field

# Apply migrations
pnpm db:migrate

# Check status
pnpm db:studio
```

## API Development

### Creating an API Route

```typescript
// app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { validateData, userSchema } from '@/lib/validation'
import { successResponse, errorResponse } from '@/lib/utils'
import { Errors } from '@/lib/utils'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication
    const { userId } = await auth()
    if (!userId) {
      const { response, status } = errorResponse(Errors.UNAUTHORIZED())
      return NextResponse.json(response, { status })
    }

    // Fetch data
    const user = await db.user.findUnique({
      where: { id: params.id },
    })

    if (!user) {
      const { response, status } = errorResponse(Errors.NOT_FOUND('User'))
      return NextResponse.json(response, { status })
    }

    // Return success
    return NextResponse.json(successResponse(user))
  } catch (error) {
    console.error('Error:', error)
    const { response, status } = errorResponse(Errors.INTERNAL_ERROR())
    return NextResponse.json(response, { status })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      const { response, status } = errorResponse(Errors.UNAUTHORIZED())
      return NextResponse.json(response, { status })
    }

    const body = await request.json()
    const validation = await validateData(userSchema, body)

    if (!validation.success) {
      const { response, status } = errorResponse(
        Errors.VALIDATION_ERROR(validation.error.flatten())
      )
      return NextResponse.json(response, { status })
    }

    const updated = await db.user.update({
      where: { id: params.id },
      data: validation.data,
    })

    return NextResponse.json(successResponse(updated))
  } catch (error) {
    console.error('Error:', error)
    const { response, status } = errorResponse(Errors.INTERNAL_ERROR())
    return NextResponse.json(response, { status })
  }
}
```

## Frontend Development

### Creating a Component

```typescript
// components/UserCard.tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useCallback } from 'react'
import type { User } from '@/lib/types'

interface UserCardProps {
  user: User
  onEdit?: (user: User) => void
}

export function UserCard({ user, onEdit }: UserCardProps) {
  const handleEdit = useCallback(() => {
    onEdit?.(user)
  }, [user, onEdit])

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{user.email}</p>
        <Button onClick={handleEdit} variant="outline" className="w-full">
          Edit Profile
        </Button>
      </CardContent>
    </Card>
  )
}
```

### Creating a Custom Hook

```typescript
// hooks/useUser.ts
import { useCallback, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import type { User } from '@/lib/types'

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const { userId } = useAuth()

  const fetchUser = useCallback(async () => {
    if (!userId) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/users/${userId}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error)
      }

      setUser(data.data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [userId])

  return { user, loading, error, fetchUser }
}
```

## Testing

### Unit Tests

```typescript
// __tests__/lib/utils.test.ts
import { formatDate, truncate } from '@/lib/utils'

describe('utils', () => {
  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-01-15')
      expect(formatDate(date, 'short')).toBe('Jan 15, 2024')
    })
  })

  describe('truncate', () => {
    it('should truncate long strings', () => {
      const result = truncate('This is a very long string', 10)
      expect(result).toBe('This is a ...')
    })
  })
})
```

### E2E Tests

```typescript
// e2e/home.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display hero section', async ({ page }) => {
    const heading = page.locator('h1')
    await expect(heading).toContainText('Your Personal AI Tutor')
  })

  test('should have sign up button', async ({ page }) => {
    const button = page.locator('button', { hasText: 'Get Started' })
    await expect(button).toBeVisible()
  })
})
```

## Common Tasks

### Add a New Database Model

1. Update `prisma/schema.prisma`
2. Create migration: `pnpm db:migrate dev --name add_model`
3. Update types in `lib/types.ts`
4. Add validation schemas in `lib/validation.ts`

### Add a New API Endpoint

1. Create file in `app/api/path/route.ts`
2. Implement GET/POST/PUT/DELETE handlers
3. Use validation for input
4. Return proper error responses
5. Add tests in `e2e/` or `__tests__/`

### Add a New Component

1. Create file in `components/`
2. Use functional component with TypeScript
3. Use shadcn/ui components where appropriate
4. Extract custom styling to CSS
5. Write Storybook story if complex

### Add a New Hook

1. Create file in `hooks/useXxx.ts`
2. Handle loading and error states
3. Use useCallback for memoization
4. Document with JSDoc comments
5. Write tests

## Performance Tips

### Frontend
- Use `React.memo` for expensive components
- Use `useCallback` to prevent unnecessary re-renders
- Lazy load components with `dynamic()`
- Optimize images with Next.js `Image` component
- Use CSS-in-JS (TailwindCSS) for better tree-shaking

### Backend
- Use database indexes on frequently queried fields
- Implement pagination for list endpoints
- Cache responses when appropriate
- Use transactions for multi-step operations
- Monitor query performance

### General
- Monitor Core Web Vitals
- Use Vercel Analytics
- Implement proper error tracking
- Log important events
- Profile regularly

## Debugging Tips

### Enable Debug Logging

```bash
DEBUG=* pnpm dev
```

### Check Database

```bash
pnpm db:studio
```

### React DevTools

- Install React DevTools browser extension
- Use DevTools to inspect components
- Check component props and state

### Network Debugging

- Open browser DevTools > Network tab
- Check API request/response
- Verify headers and status codes

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/description

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push to origin
git push origin feature/description

# Create pull request on GitHub
# Request review
# Make changes if needed
# Merge to main
```

## Deployment Checklist

- ✅ All tests passing
- ✅ No linting errors
- ✅ TypeScript builds without errors
- ✅ Environment variables configured
- ✅ Database migrations applied
- ✅ Code reviewed
- ✅ Tests cover critical paths
- ✅ No console errors in production build

## Useful Links

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs/)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Clerk Docs](https://clerk.com/docs)

## Getting Help

1. Check existing documentation
2. Search GitHub issues
3. Ask in team channels
4. Create detailed bug reports
5. Check PR templates

## Quick Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Run production build

# Code Quality
pnpm lint             # Run ESLint
pnpm type-check       # Check TypeScript
pnpm format           # Format code
pnpm test             # Run tests
pnpm test:watch       # Watch mode tests

# Database
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Prisma Studio
pnpm db:seed          # Seed database

# Cleanup
pnpm clean            # Remove build artifacts
pnpm deps:check       # Check dependency updates
```

## Next Steps

For Phase 2 development:
1. Implement AI provider abstraction
2. Add rich note editor
3. Create note API endpoints
4. Build chat interface
5. Add vector retrieval

See `docs/PHASE_1_SETUP.md` for detailed roadmap.
