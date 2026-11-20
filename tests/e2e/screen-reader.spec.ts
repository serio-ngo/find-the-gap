import { expect, test } from '@playwright/test'
import { deck, expectEnd, open, play, strings, wrong } from './helpers.ts'

const l = strings.labels.en

test('every button and link has an accessible name and the canvas is hidden from screen readers', async ({ page }) => {
  await open(page)
  await expect(page.locator('canvas')).toHaveAttribute('aria-hidden', 'true')
  const named = async () => {
    const all = [...(await page.getByRole('button').all()), ...(await page.getByRole('link').all())]
    expect(all.length).toBeGreaterThan(0)
    for (const e of all) await expect(e).toHaveAccessibleName(/\S/)
  }
  await named()
  await play(page)
  await named()
})

test('a keyboard-only player finishes level 1 through the rock twins', async ({ page }) => {
  await open(page)
  const g = await play(page, { by: 'keys' })
  await expectEnd(page, g)
  expect(g.decisions).toHaveLength(deck.levels[0].sequence.length)
})

test('a live region announces a hit', async ({ page }) => {
  await open(page)
  await play(page, { limit: 1 })
  await expect(page.getByRole('status').filter({ hasText: l.hit })).toHaveCount(1)
})

test('a live region announces a miss', async ({ page }) => {
  await open(page)
  await play(page, { limit: 1, pick: (g) => wrong(deck, g) })
  await expect(page.getByRole('status').filter({ hasText: l.miss })).toHaveCount(1)
})
