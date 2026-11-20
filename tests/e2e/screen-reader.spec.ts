import { expect, test } from '@playwright/test'
import { replay, upcoming, wave } from '../../src/game/engine.ts'
import { deck, expectEnd, open, play, playButton, right, strings, wrong } from './helpers.ts'

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

test('the score heading takes focus when the end screen appears', async ({ page }) => {
  await open(page)
  await play(page)
  await expect(page.getByRole('heading', { level: 2 })).toBeFocused()
})

test('a keyboard-only player finishes level 1 through the rock twins', async ({ page }) => {
  await open(page)
  const g = await play(page, { by: 'keys' })
  await expectEnd(page, g)
  expect(g.decisions).toHaveLength(deck.levels[0].sequence.length)
})

const live = (page: import('@playwright/test').Page) => page.locator('.ftg-sr')

test('a live region announces a hit on an anchor wave', async ({ page }) => {
  await open(page)
  await play(page, { limit: 3 })
  await expect(live(page)).toHaveText(l.hit)
})

test('a live region announces a miss on an anchor wave', async ({ page }) => {
  await open(page)
  await play(page, { limit: 3, pick: (g) => (g.decisions.length === 2 ? wrong(deck, g) : right(deck, g)) })
  await expect(live(page)).toHaveText(l.miss)
})

test('only the answers of an anchor wave carry the bad label', async ({ page }) => {
  await open(page)
  await playButton(page).click()
  const bad = page.getByRole('button', { name: l.bad })
  await expect(bad).toHaveCount(0)
  await play(page, { limit: 2, begun: true })
  await expect(bad).toHaveCount(wave(deck, upcoming(deck, replay(deck, 1, 'standard', [0, 0]))!).answers.length)
})
