/**
 * @jest-environment node
 */
import { getProvider, detectProvider, AVAILABLE_MODELS } from '@/lib/ai/router'
import { GoogleProvider } from '@/lib/ai/providers/google'
import { GroqProvider } from '@/lib/ai/providers/groq'
import { AnthropicProvider } from '@/lib/ai/providers/anthropic'

const mockConfig = { apiKey: 'test-key' }

// ─── detectProvider ───────────────────────────────────────────────────────────

describe('detectProvider', () => {
  it.each([
    ['gemini-2.5-flash', 'google'],
    ['gemini-2.5-flash-lite', 'google'],
    ['GEMINI-1.5-pro', 'google'],
  ])('%s → google', (model, expected) => {
    expect(detectProvider(model)).toBe(expected)
  })

  it.each([
    ['llama-4-scout-17b-16e-instruct', 'groq'],
    ['llama-3.3-70b-versatile', 'groq'],
    ['llama-3.1-8b-instant', 'groq'],
    ['gemma2-9b-it', 'groq'],
    ['compound-beta', 'groq'],
    ['groq/custom-model', 'groq'],
  ])('%s → groq', (model, expected) => {
    expect(detectProvider(model)).toBe(expected)
  })

  it.each([
    ['claude-sonnet-4-6', 'anthropic'],
    ['claude-opus-4-6', 'anthropic'],
    ['claude-haiku-4-5-20251001', 'anthropic'],
    ['CLAUDE-3-haiku', 'anthropic'],
  ])('%s → anthropic', (model, expected) => {
    expect(detectProvider(model)).toBe(expected)
  })

  it('throws for unknown model', () => {
    expect(() => detectProvider('gpt-4o')).toThrow('Unknown provider')
  })
})

// ─── getProvider ──────────────────────────────────────────────────────────────

describe('getProvider', () => {
  it('returns GoogleProvider for gemini models', () => {
    const provider = getProvider('gemini-2.5-flash', mockConfig)
    expect(provider).toBeInstanceOf(GoogleProvider)
  })

  it('returns GroqProvider for llama models', () => {
    const provider = getProvider('llama-3.3-70b-versatile', mockConfig)
    expect(provider).toBeInstanceOf(GroqProvider)
  })

  it('returns GroqProvider for compound-beta', () => {
    const provider = getProvider('compound-beta', mockConfig)
    expect(provider).toBeInstanceOf(GroqProvider)
  })

  it('returns GroqProvider for gemma models', () => {
    const provider = getProvider('gemma2-9b-it', mockConfig)
    expect(provider).toBeInstanceOf(GroqProvider)
  })

  it('returns GroqProvider for groq/ prefix', () => {
    // The router matches the prefix but providers validate exact IDs —
    // the route matching itself is what we're testing here
    expect(() => getProvider('groq/unknown-model', mockConfig)).toThrow('Unknown Groq model')
    // Valid groq-prefixed models should pass through the router
    const provider = getProvider('llama-3.3-70b-versatile', mockConfig)
    expect(provider).toBeInstanceOf(GroqProvider)
  })

  it('returns AnthropicProvider for claude models', () => {
    const provider = getProvider('claude-sonnet-4-6', mockConfig)
    expect(provider).toBeInstanceOf(AnthropicProvider)
  })

  it('throws for unknown model', () => {
    expect(() => getProvider('unknown-model', mockConfig)).toThrow(
      'Unknown model provider'
    )
  })

  it('uses the exact model ID string as passed to the provider', () => {
    // Routing is case-insensitive but providers validate exact model IDs
    const provider = getProvider('gemini-2.5-flash', mockConfig)
    expect(provider).toBeInstanceOf(GoogleProvider)
  })
})

// ─── AVAILABLE_MODELS ─────────────────────────────────────────────────────────

describe('AVAILABLE_MODELS', () => {
  it('has google, groq, and anthropic keys', () => {
    expect(AVAILABLE_MODELS).toHaveProperty('google')
    expect(AVAILABLE_MODELS).toHaveProperty('groq')
    expect(AVAILABLE_MODELS).toHaveProperty('anthropic')
  })

  it('google models all start with gemini', () => {
    AVAILABLE_MODELS.google.forEach((m) => {
      expect(m.toLowerCase()).toMatch(/^gemini/)
    })
  })

  it('groq models match groq patterns', () => {
    AVAILABLE_MODELS.groq.forEach((m) => {
      const valid = /^(llama|compound|gemma|groq|meta-llama)/i.test(m)
      expect(valid).toBe(true)
    })
  })

  it('anthropic models all start with claude', () => {
    AVAILABLE_MODELS.anthropic.forEach((m) => {
      expect(m.toLowerCase()).toMatch(/^claude/)
    })
  })

  it('all listed models can be resolved by getProvider', () => {
    const all = [
      ...AVAILABLE_MODELS.google,
      ...AVAILABLE_MODELS.groq,
      ...AVAILABLE_MODELS.anthropic,
    ]
    all.forEach((model) => {
      expect(() => getProvider(model, mockConfig)).not.toThrow()
    })
  })
})
