import { expect, test } from '@playwright/test'
import { decks } from '../../src/game/levels/index.ts'
import { expectEnd, open, play } from './helpers.ts'

const fixture = decks.fixture

test('?deck=fixture plays to its own end with a score, no indicators and no table', async ({ page }) => {
  await open(page, 'en', 1, '?deck=fixture')
  const g = await play(page, { deck: fixture })
  await expectEnd(page, g)
  await expect(page.locator('.ftg-ind')).toBeHidden()
  await expect(page.locator('table')).toHaveCount(0)
  expect(g.decisions).toHaveLength(fixture.levels[0].sequence.length)
})

test('saves keep levels and decks apart', async ({ page }) => {
  test.slow() // three full plays, each wave animates
  await open(page, 'en', 1)
  await play(page)
  await open(page, 'en', 2)
  await play(page, { level: 2 })
  await open(page, 'en', 1, '?deck=fixture')
  await play(page, { deck: fixture })
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('ftg:')).sort())
  expect(keys).toEqual(['ftg:fixture:1', 'ftg:lifecycle:1', 'ftg:lifecycle:2'])
})
