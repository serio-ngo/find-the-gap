import { expect, test } from '@playwright/test'
import { deviation } from '../../src/game/engine.ts'
import { deck, expectEnd, open, play, right, run, strings, wrong } from './helpers.ts'

for (const lang of ['en', 'pl'] as const)
  for (const level of [1, 2])
    test(`the end screen indicators equal the deviation of the picks in ${lang} level ${level}`, async ({ page }) => {
      await open(page, lang, level)
      const g = await play(page, { lang, level, pick: (s) => (s.decisions.length % 2 ? wrong(deck, s) : right(deck, s)) })
      await expectEnd(page, g, lang)
      const dev = deviation(deck, run, g)!
      await expect(page.locator('.ftg-ind')).toBeVisible()
      await expect(page.locator('.ftg-agree')).toHaveText(`${dev.agree}%`)
      await expect(page.locator('.ftg-atyp')).toHaveText(String(dev.atypical))
      await expect(page.locator('.ftg-ind dt')).toHaveText([strings.visible[lang].agreement, strings.visible[lang].atypical])
    })

test('after two plays the top list has two entries and one is current', async ({ page }) => {
  await open(page)
  await play(page)
  await page.getByRole('button', { name: strings.labels.en.replay, exact: true }).click()
  const g = await play(page, { begun: true, pick: (s) => (s.decisions.length % 2 ? wrong(deck, s) : right(deck, s)) })
  await expectEnd(page, g)
  await expect(page.locator('.ftg-top li')).toHaveCount(2)
  await expect(page.locator('.ftg-top [aria-current]')).toHaveCount(1)
})
