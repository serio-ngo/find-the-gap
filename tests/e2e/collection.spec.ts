import { expect, test } from '@playwright/test'
import { begin } from '../../src/game/engine.ts'
import { collected, deck, expectEnd, open, play, playButton, strings } from './helpers.ts'

test('every pick drops one item into the HUD collection, in standard and in calm mode', async ({ page }) => {
  await open(page)
  await playButton(page).click()
  const calm = page.getByRole('button', { name: strings.labels.en.calm })
  const root = page.locator('.ftg')
  await expect(calm).toHaveAttribute('aria-pressed', 'true')
  await calm.click()
  await expect(root).not.toHaveAttribute('data-calm', '')
  expect(await collected(page, '.ftg-hud')).toBe(0)
  let g = await play(page, { begun: true, start: begin(deck, 1, 'standard'), limit: 1 })
  await expect.poll(() => collected(page, '.ftg-hud')).toBe(1)
  await calm.click()
  await expect(root).toHaveAttribute('data-calm', '')
  g = await play(page, { begun: true, start: g, limit: 2 })
  await expect.poll(() => collected(page, '.ftg-hud')).toBe(2)
})

test('the end screen shows the collection of the whole game', async ({ page }) => {
  await open(page)
  const g = await play(page)
  await expectEnd(page)
  expect(await collected(page, '.ftg-end')).toBe(g.decisions.length)
  await expect(page.locator('.ftg-end .ftg-item').first()).toHaveAccessibleName(/\S+: \d+/)
})
