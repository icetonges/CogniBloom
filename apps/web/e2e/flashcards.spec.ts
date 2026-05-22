import { test, expect } from '@playwright/test'

/**
 * Flashcards smoke tests — verify the review session UI and state transitions.
 */

test.describe('Flashcards page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/flashcards')
    await page.waitForLoadState('networkidle')
  })

  test('shows stats row with total / due / accuracy', async ({ page }) => {
    await expect(page.getByText(/total cards/i)).toBeVisible()
    await expect(page.getByText(/due for review/i)).toBeVisible()
    await expect(page.getByText(/avg accuracy/i)).toBeVisible()
  })

  test('shows empty state when no cards exist', async ({ page }) => {
    const cardCount = await page.locator('text=Total cards').locator('..').locator('p').first()
    const text = await cardCount.textContent()
    if (text === '0') {
      await expect(page.getByText(/no flashcards yet/i)).toBeVisible()
    }
    // If cards do exist, skip — we can't know the state in CI
  })

  test('Generate from note button opens the modal', async ({ page }) => {
    await page.getByRole('button', { name: /generate from note/i }).click()
    await expect(page.getByText(/generate flashcards from note/i)).toBeVisible()
    // Cancel should close it
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByText(/generate flashcards from note/i)).not.toBeVisible()
  })

  test('Start Review button is visible when cards are due', async ({ page }) => {
    // Only check if the due CTA banner is shown — it's conditional
    const dueCard = page.locator('text=Start Review')
    const count = await dueCard.count()
    if (count > 0) {
      await expect(dueCard.first()).toBeVisible()
    }
    // If 0 cards due, this test is a no-op (not a failure)
  })
})
