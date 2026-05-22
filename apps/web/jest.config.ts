import type { Config } from 'jest'
import nextJest from 'next/jest'

const createJestConfig = nextJest({
  dir: './',
})

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/e2e/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: [
    // Pure utility libraries — fully testable
    'lib/utils.ts',
    'lib/flashcards.ts',
    'lib/ai/router.ts',
    'lib/ai/providers/types.ts',
    // Hooks — testable via @testing-library/react
    'hooks/**/*.{ts,tsx}',
    // Exclude generated/config/DB/AI network code that needs integration setup
    '!lib/db.ts',
    '!lib/email.ts',
    '!lib/user.ts',
    '!lib/validation.ts',
    '!lib/types.ts',
    '!lib/stripe.ts',
    '!lib/ai/embeddings.ts',
    '!lib/ai/index.ts',
    '!lib/ai/manager.ts',
    '!lib/ai/rag.ts',
    '!lib/ai/providers/anthropic.ts',
    '!lib/ai/providers/base.ts',
    '!lib/ai/providers/google.ts',
    '!lib/ai/providers/groq.ts',
    '!app/api/**/*',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  // Thresholds apply to the scoped files above (lib utils + hooks)
  // Raise these as test coverage grows
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
}

export default createJestConfig(config)
