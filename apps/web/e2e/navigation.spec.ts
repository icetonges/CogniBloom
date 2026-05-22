import { test, expect } from '@playwright/test'

/**
 * Core navigation smoke tests — verify that all main pages load
 * without JavaScript errors and with expected UI landmarks.
 */

test.describe('Landing page', () => {
  test('loads with hero content and CTA', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/CogniBloom/i)
    await expect(page.getByRole('heading', { name: /learn anything/i })).toBeVisible()
    // Primary CTA buttons link to dashboard
    const ctaLinks = page.getByRole('link', { name: /open dashboard/i })
    await expect(ctaLinks.first()).toBeVisible()
  })

  test('feature cards are rendered', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('AI Tutor Chat')).toBeVisible()
    await expect(page.getByText('Smart Notes')).toBeVisible()
    await expect(page.getByText('Flashcards')).toBeVisible()
  })

  test('navigates to dashboard when CTA is clicked', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /open dashboard/i }).first().click()
    await expect(page).toHaveURL(/\/dashboard/)
  })
})

test.describe('Dashboard', () => {
  test('loads and shows key sections', async ({ page }) => {
    await page.goto('/dashboard')
    // Main heading
    await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible()
  })

  test('sidebar nav links are present', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('link', { name: /notes/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /flashcards/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /quiz/i }).first()).toBeVisible()
  })
})

test.describe('Dashboard sub-pages', () => {
  test('notes page loads', async ({ page }) => {
    await page.goto('/dashboard/notes')
    await expect(page.getByRole('heading', { name: /my notes/i })).toBeVisible()
  })

  test('flashcards page loads', async ({ page }) => {
    await page.goto('/dashboard/flashcards')
    await expect(page.getByRole('heading', { name: /flashcards/i })).toBeVisible()
  })

  test('quiz page loads', async ({ page }) => {
    await page.goto('/dashboard/quiz')
    await expect(page.getByText(/quiz/i)).toBeVisible()
  })

  test('feed page loads', async ({ page }) => {
    await page.goto('/dashboard/feed')
    await expect(page.getByRole('heading', { name: /knowledge feed/i })).toBeVisible()
  })

  test('uploads page loads', async ({ page }) => {
    await page.goto('/dashboard/uploads')
    await expect(page.getByRole('heading', { name: /file uploads/i })).toBeVisible()
  })

  test('analytics page loads', async ({ page }) => {
    await page.goto('/dashboard/analytics')
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible()
  })

  test('settings page loads', async ({ page }) => {
    await page.goto('/dashboard/settings')
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
  })

  test('chat page loads', async ({ page }) => {
    await page.goto('/dashboard/chat')
    await expect(page.getByText(/tutor/i)).toBeVisible()
  })
})
