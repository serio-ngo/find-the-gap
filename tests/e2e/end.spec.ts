import { expect, test } from '@playwright/test'
import { aiPick, wave } from '../../src/game/engine.ts'
import { deck, expectEnd, open, play, right, run, strings, wrong } from './helpers.ts'

test('the end screen shows the loot of every wave, which picks were rewarded and which the AI hit, the deviation from chance, and the leaderboard', async ({ page }) => {
  await open(page)
  const g = await play(page, { pick: (s) => (s.decisions.length % 3 ? right(deck, s) : wrong(deck, s)) })
  await expectEnd(page)
  const loot = page.locator('.ftg-loot li')
  await expect(loot).toHaveCount(g.decisions.length)
  const won = g.decisions.filter((d) => d.anchor && d.hit).length
  const aiWon = g.decisions.filter((d, i) => { const a = aiPick(run, deck, g, i); return d.anchor && typeof a === 'number' && wave(deck, d.spec).answers.includes(a) }).length
  await expect(page.locator('.ftg-loot .ftg-me.ftg-won')).toHaveCount(won)
  await expect(page.locator('.ftg-loot .ftg-ai.ftg-won')).toHaveCount(aiWon)
  await expect(loot.first().locator('.ftg-me')).toHaveAccessibleName(new RegExp(`^${strings.labels.en.wave} 1\. ${strings.labels.en.you}: `))
  await expect(page.locator('.ftg-norm')).toHaveText(/^[+-]\d+\.\dσ$/)
  await expect(page.locator('.ftg-norm')).toHaveAccessibleName(/^[+-]\d+\.\dσ from chance\. typical \d+\/\d+, atypical \d+\/\d+$/)
  const board = page.getByRole('form', { name: strings.visible.en.board })
  await board.getByLabel(strings.visible.en.nick).fill('Tester 7')
  await board.getByRole('button', { name: strings.visible.en.save }).click()
  await expect(page.locator('.ftg-top .ftg-mine')).toContainText('Tester 7')
  await expect(page.locator('.ftg-top')).toBeFocused()
  await expect(page.locator('.ftg-norm')).toHaveAccessibleName(/\. better than \d+% of players$/)
})
