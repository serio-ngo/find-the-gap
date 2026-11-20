import { expect, test } from '@playwright/test'
import { wave } from '../../src/game/engine.ts'
import { aiChoice, deck, expectEnd, open, play, right, wrong } from './helpers.ts'

for (const lang of ['en', 'pl'] as const)
  for (const level of [1, 2])
    test(`the end screen shows the score against the AI and both picks in ${lang} level ${level}`, async ({ page }) => {
      await open(page, lang, level)
      const g = await play(page, { lang, level, pick: (s) => (s.decisions.length % 2 ? wrong(deck, s) : right(deck, s)) })
      await expectEnd(page, g, lang)
      const rows = page.locator('.ftg-table tr')
      await expect(rows).toHaveCount(g.decisions.length)
      for (const [i, d] of g.decisions.entries()) {
        const w = wave(deck, d.spec)
        const cells = rows.nth(i).locator('td')
        await expect(cells.nth(2)).toContainText(w.symbols[d.pick])
        await expect(cells.nth(3)).toContainText(w.symbols[aiChoice(g, i)])
      }
    })
