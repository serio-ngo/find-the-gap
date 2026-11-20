import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { aiPick, aiScore, begin, score, shoot, upcoming, wave } from '../../src/game/engine.ts'
import type { AiRun, Deck, Game, Mode } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'

export type Lang = 'pl' | 'en'
export const deck = decks.lifecycle
export const run = JSON.parse(readFileSync('src/game/eval/ai-run.json', 'utf8')) as AiRun
export const strings = JSON.parse(readFileSync('src/game/strings.json', 'utf8')) as {
  visible: Record<Lang, Record<string, string>>
  labels: Record<Lang, Record<string, string>>
}

export const urlPath = (lang: Lang, level = 1, query = '') => `${lang === 'en' ? '/en' : ''}/find-the-gap/${level}/${query}`
export const levelUrl = (lang: Lang, level = 1) => `https://serio.org.pl${lang === 'en' ? '/en' : ''}/find-the-gap/${level}`

export const right = (d: Deck, g: Game) => wave(d, upcoming(d, g)!).answers[0] ?? 0
export const wrong = (d: Deck, g: Game) => {
  const w = wave(d, upcoming(d, g)!)
  return Math.max(0, w.symbols.findIndex((_, i) => !w.answers.includes(i)))
}

export const open = (page: Page, lang: Lang = 'en', level = 1, query = '') => page.goto(urlPath(lang, level, query))
export const playButton = (page: Page, lang: Lang = 'en') => page.getByRole('button', { name: `▶ ${strings.visible[lang].play}`, exact: true })

type Options = {
  deck?: Deck
  level?: number
  mode?: Mode
  lang?: Lang
  by?: 'click' | 'keys' | 'tap'
  pick?: (g: Game) => number
  limit?: number
  begun?: boolean
}

export async function play(page: Page, o: Options = {}) {
  const { deck: d = deck, level = 1, mode = 'standard', lang = 'en', by = 'click', pick = (g: Game) => right(d, g), limit = Infinity, begun = false } = o
  const labels = strings.labels[lang]
  if (!begun) await playButton(page, lang).click()
  let g = begin(d, level, mode)
  for (let spec = upcoming(d, g); spec && g.decisions.length < limit; spec = upcoming(d, g)) {
    const i = pick(g)
    const w = wave(d, spec)
    const twin = page.getByRole('button', { name: labels.rock.replace('{n}', String(i + 1)).replace('{s}', w.symbols[i]), exact: true })
    const before = await page.locator('.ftg-wave').textContent()
    if (by === 'keys') {
      for (let k = 0; k < i; k++) await page.keyboard.press('ArrowRight')
      await page.keyboard.press(i % 2 ? 'Enter' : 'Space')
    } else if (by === 'tap') await twin.tap()
    else await twin.click()
    g = shoot(d, g, i)
    await page.waitForFunction(
      (b) => document.querySelector('.ftg')!.getAttribute('data-phase') === 'end' || document.querySelector('.ftg-wave')!.textContent !== b,
      before,
    )
  }
  return g
}

export async function expectEnd(page: Page, g: Game, lang: Lang = 'en') {
  await expect(page.locator('.ftg')).toHaveAttribute('data-phase', 'end')
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(`${strings.visible[lang].you} ${score(g)} : ${aiScore(deck, run, g)} 🤖`)
}

export const aiChoice = (g: Game, i: number) => Number(aiPick(run, g, i)!.choice.slice(1))
