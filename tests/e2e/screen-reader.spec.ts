import { expect, test } from '@playwright/test'
import { deck, displayed, expectEnd, open, play, playButton, right, strings, wrong } from './helpers.ts'

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

test('anchor choices have neutral names before the shot and announce a hit after it', async ({ page }) => {
  for (const lang of ['en', 'pl'] as const) {
    await open(page, lang)
    await playButton(page, lang).click()
    const g = await play(page, { lang, limit: 2, begun: true })
    const names = await page.locator('.ftg-rocks button').evaluateAll((buttons) => buttons.map((button) => button.ariaLabel))
    const bad = { en: 'bad datum', pl: 'zła dana' }[lang]
    expect(names.filter((name) => name?.trim()).length).toBeGreaterThanOrEqual(4)
    expect.soft(names.join('\n')).not.toContain(bad)
    const slot = displayed(deck, g).findIndex((o) => o.sourceIndex === right(deck, g))
    await page.locator(`[data-rock="${slot}"]`).dispatchEvent('click')
    await expect(live(page)).toHaveText(strings.labels[lang].hit)
  }
})
