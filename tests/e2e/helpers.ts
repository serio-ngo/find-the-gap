import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { aiPick, begin, report, shoot, upcoming, wave } from '../../src/game/engine.ts'
import type { AiRun, Deck, Game, Mode } from '../../src/game/engine.ts'
import { presentObjects } from '../../src/game/objects.ts'
import { label } from '../../src/game/chart.ts'
import type { Labels } from '../../src/game/chart.ts'
import { describe } from '../../src/game/debrief.ts'
import { decks } from '../../src/game/levels/index.ts'

export type Lang = 'pl' | 'en'
export const deck = decks.observations!
export const run = JSON.parse(readFileSync('src/game/eval/ai-run.json', 'utf8')) as AiRun
export const strings = JSON.parse(readFileSync('src/game/strings.json', 'utf8')) as {
  visible: Record<Lang, Record<string, string>>
  labels: Record<Lang, Record<string, string>>
}

export const urlPath = (lang: Lang, level = 1, query = '') => `${lang === 'en' ? '/en' : ''}/game/${level}/${query}`
export const levelUrl = (lang: Lang, level = 1) => `https://serio.org.pl${lang === 'en' ? '/en' : ''}/game/${level}`

export const right = (d: Deck, g: Game) => wave(d, upcoming(d, g)!).answers[0] ?? 0
export const wrong = (d: Deck, g: Game) => {
  const w = wave(d, upcoming(d, g)!)
  return Math.max(0, w.symbols.findIndex((_, i) => !w.answers.includes(i)))
}

export const displayed = (d: Deck, g: Game, i = g.decisions.length) =>
  presentObjects(d, wave(d, g.decisions[i]?.spec ?? upcoming(d, g)!))

export const rockNames = (d: Deck, g: Game, lang: Lang) => {
  const labels = strings.labels[lang]
  return displayed(d, g).map((o, k) => `${labels.rock.replace('{n}', String(k + 1)).replace('{s}', labels[o.shape.family]!)}. ${describe(o.shape.facts, labels)}`)
}

export const chartName = (g: Game, lang: Lang = 'en') => {
  const played = { ...g, decisions: g.decisions.map((d, i) => ({ ...d, ai: aiPick(run, deck, g, i) })) }
  return label(report(deck, played), { ...strings.visible[lang], chart: strings.labels[lang].chart } as Labels)
}

export const open = (page: Page, lang: Lang = 'en', level = 1, query = '') => page.goto(urlPath(lang, level, query))
export const playButton = (page: Page, lang: Lang = 'en') => page.getByRole('button', { name: strings.visible[lang].play, exact: true })

type Options = {
  deck?: Deck
  level?: number
  mode?: Mode
  lang?: Lang
  by?: 'click' | 'keys'
  pick?: (g: Game) => number
  limit?: number
  begun?: boolean
  start?: Game
  live?: { hit: number; miss: number }
}

export async function play(page: Page, o: Options = {}) {
  const { deck: d = deck, level = 1, mode = 'standard', lang = 'en', by = 'click', pick = (g: Game) => right(d, g), limit = Infinity, begun = false, live } = o
  if (!begun) await playButton(page, lang).click()
  let g = o.start ?? begin(d, level, mode)
  for (let spec = upcoming(d, g); spec && g.decisions.length < limit; spec = upcoming(d, g)) {
    const i = pick(g)
    const objects = displayed(d, g)
    const slot = objects.findIndex((o) => o.sourceIndex === i)
    const names = rockNames(d, g, lang)
    await expect.poll(() => page.locator('.ftg-rocks button').evaluateAll((bs) => bs.map((b) => b.ariaLabel))).toEqual(names)
    const before = await page.locator('.ftg-wave').textContent()
    if (by === 'keys') {
      for (let k = 0; k < slot; k++) await page.keyboard.press('ArrowRight')
      await page.keyboard.press(slot % 2 ? 'Enter' : 'Space')
    } else await page.locator(`[data-rock="${slot}"]`).dispatchEvent('click')
    g = shoot(d, g, i, 0, live)
    await page.waitForFunction(
      (b) => document.querySelector('.ftg')!.getAttribute('data-phase') === 'end' || document.querySelector('.ftg-wave')!.textContent !== b,
      before,
    )
  }
  return g
}

export const expectEnd = (page: Page) => expect(page.locator('.ftg')).toHaveAttribute('data-phase', 'end')

export const collected = (page: Page, scope: string) =>
  page.locator(`${scope} .ftg-count`).evaluateAll((counts) => counts.reduce((n, c) => n + Number(c.textContent), 0))
