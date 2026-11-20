import { expect, test } from '@playwright/test'
import { score } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'
import { open, play, strings } from './helpers.ts'

const fixture = decks.fixture

test('?deck=fixture plays to its own end without a duel', async ({ page }) => {
  await open(page, 'en', 1, '?deck=fixture')
  const g = await play(page, { deck: fixture })
  await expect(page.locator('.ftg')).toHaveAttribute('data-phase', 'end')
  const title = page.getByRole('heading', { level: 2 })
  await expect(title).toHaveText(new RegExp(`^${strings.visible.en.you} ${score(g)}/\\d+$`))
  await expect(title).not.toContainText('🤖')
  await expect(page.locator('.ftg-table tr')).toHaveCount(g.decisions.length)
  expect(g.decisions).toHaveLength(fixture.levels[0].sequence.length)
})

test('saves keep levels and decks apart', async ({ page }) => {
  await open(page, 'en', 1)
  await play(page)
  await open(page, 'en', 2)
  await play(page, { level: 2 })
  await open(page, 'en', 1, '?deck=fixture')
  await play(page, { deck: fixture })
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('ftg:')).sort())
  expect(keys).toEqual(['ftg:fixture:1', 'ftg:lifecycle:1', 'ftg:lifecycle:2'])
})
