import { test, expect } from '@playwright/test'

/**
 * Notes CRUD flow — create, view, edit, search, and delete notes.
 */

test.describe('Notes page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/notes')
    // Wait for loading to complete
    await page.waitForLoadState('networkidle')
  })

  test('shows empty state or note grid', async ({ page }) => {
    // Either a note grid or an empty state is visible
    const hasNotes = await page.locator('[data-testid="note-card"]').count()
    if (hasNotes === 0) {
      await expect(page.getByText(/no notes yet/i)).toBeVisible()
    } else {
      await expect(page.locator('[data-testid="note-card"]').first()).toBeVisible()
    }
  })

  test('New Note button opens the editor', async ({ page }) => {
    await page.getByRole('button', { name: /new note/i }).click()
    // The note editor should appear
    await expect(page.getByPlaceholder(/note title/i)).toBeVisible({ timeout: 5000 })
  })

  test('can create a note and it appears in the list', async ({ page }) => {
    const title = `E2E test note ${Date.now()}`

    await page.getByRole('button', { name: /new note/i }).click()
    await page.getByPlaceholder(/note title/i).fill(title)

    // Type some content in the editor area
    const contentArea = page.getByPlaceholder(/start writing/i)
    await contentArea.fill('This is test note content for E2E.')

    // Save
    await page.getByRole('button', { name: /save/i }).click()

    // Should navigate back to the list and show the new note
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 })
  })

  test('search bar is visible and accepts input', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search notes/i)
    await expect(searchInput).toBeVisible()
    await searchInput.fill('algebra')
    // Clear button should appear
    await expect(page.locator('button').filter({ has: page.locator('svg') }).last()).toBeVisible()
  })
})

test.describe('Notes — quiz and flashcard quick-actions', () => {
  test('quiz URL params pre-fill the quiz page', async ({ page }) => {
    await page.goto('/dashboard/quiz?topic=Quadratic+Equations&subject=Mathematics')
    await page.waitForLoadState('networkidle')

    // The topic input should be pre-filled
    const topicInput = page.getByPlaceholder(/enter a topic/i)
    await expect(topicInput).toHaveValue(/quadratic equations/i, { timeout: 5000 })
  })
})
