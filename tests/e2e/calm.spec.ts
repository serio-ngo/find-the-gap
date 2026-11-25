import { expect, test } from '@playwright/test'
import { open, strings } from './helpers.ts'

const calm = (page: import('@playwright/test').Page) => page.getByRole('button', { name: strings.labels.en.calm })

test('reduced motion makes the root calm and the toggle flips it', async ({ page }) => {
  await open(page)
  const root = page.locator('.ftg')
  await expect(root).toHaveAttribute('data-calm', '')
  await expect(calm(page)).toHaveAttribute('aria-pressed', 'true')
  await calm(page).click()
  await expect(calm(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(root).not.toHaveAttribute('data-calm', '')
  await calm(page).click()
  await expect(root).toHaveAttribute('data-calm', '')
})
