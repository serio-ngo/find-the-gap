import { expect, test } from '@playwright/test'
import { Run, collected, expectEnd, open, playButton, strings, suites } from './helpers.ts'

test('every accusation drops one item into the HUD collection, in standard and in calm mode', async ({ page }) => {
  await open(page)
  await playButton(page).click()
  const calm = page.getByRole('button', { name: strings.labels.en.calm })
  const root = page.locator('.ftg')
  await expect(calm).toHaveAttribute('aria-pressed', 'true')
  await calm.click()
  await expect(root).not.toHaveAttribute('data-calm', '')
  expect(await collected(page, '.ftg-hud')).toBe(0)
  const r = new Run(page)
  await r.accuseIn(suites[0]!)
  await expect.poll(() => collected(page, '.ftg-hud')).toBe(1)
  await calm.click()
  await expect(root).toHaveAttribute('data-calm', '')
  await r.accuseIn(suites[1]!)
  await expect.poll(() => collected(page, '.ftg-hud')).toBe(2)
})

test('the end screen shows the collection of the whole game', async ({ page }) => {
  await open(page)
  await playButton(page).click()
  const r = new Run(page)
  await r.finish()
  await expectEnd(page)
  expect(await collected(page, '.ftg-end')).toBe(r.accused.size)
  await expect(page.locator('.ftg-end .ftg-item').first()).toHaveAccessibleName(/\S+: \d+/)
})
