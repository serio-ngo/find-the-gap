import { expect, test } from '@playwright/test'
import { wave } from '../../src/game/engine.ts'
import { aiChoice, deck, expectEnd, open, play, right, strings, wrong } from './helpers.ts'

test('each end-screen row links its source and the differing picks can be counted', async ({ page }) => {
  await open(page)
  const g = await play(page, { pick: (s) => (s.decisions.length % 2 ? wrong(deck, s) : right(deck, s)) })
  await expectEnd(page, g)
  const rows = page.locator('.ftg-table tr')
  await expect(rows).toHaveCount(g.decisions.length)
  let differ = 0
  for (const [i, d] of g.decisions.entries()) {
    const w = wave(deck, d.spec)
    const url = deck.evidence.find((e) => e.id === w.evidence)!.url
    await expect(rows.nth(i).getByRole('link', { name: strings.visible.en.source })).toHaveAttribute('href', url)
    if (w.symbols[d.pick] !== w.symbols[aiChoice(g, i)]) differ++
  }
  const shown = await rows.evaluateAll((trs) =>
    trs.filter((tr) => {
      const t = (n: number) => tr.children[n].textContent!.replace(/[✓✕—]/g, '').trim()
      return t(2) !== t(3)
    }).length,
  )
  expect(shown).toBe(differ)
  expect(differ).toBeGreaterThan(0)
})
