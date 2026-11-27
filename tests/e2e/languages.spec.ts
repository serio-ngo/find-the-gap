import { expect, test, type Page } from '@playwright/test'
import { Run, open, playButton, strings, trunk, type Lang } from './helpers.ts'

const letters = (s: string) => s.replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim()

const visibleTexts = (page: Page) =>
  page.locator('.ftg').evaluate((root) => {
    const out: string[] = []
    const walk = (n: Node) => {
      if (n.nodeType === 3) {
        const el = n.parentElement!
        const t = n.textContent!.trim()
        if (t && !el.closest('.ftg-sr, .ftg-foot, .ftg-sha') && el.checkVisibility()) out.push(t)
      }
      n.childNodes.forEach(walk)
    }
    walk(root)
    return out
  })

const fits = (t: string, n: string) => {
  const p = t.split(/\{\w+\}/)
  return n.startsWith(p[0]!) && n.endsWith(p.at(-1)!) && p.every((x) => n.includes(x))
}

const names = (page: Page) =>
  page.locator('.ftg').evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>('button, a')].filter((e) => !e.dataset.walk?.startsWith('m')).map((e) => e.ariaLabel ?? e.textContent ?? ''))

const unnamed = (page: Page) =>
  page.locator('.ftg').evaluate((root) => {
    const letters = (s: string) => s.replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase()
    return [...root.querySelectorAll<HTMLElement>('button, a.ftg-next')]
      .filter((e) => e.checkVisibility() && letters(e.textContent!))
      .filter((e) => !letters(e.ariaLabel ?? e.textContent!).startsWith(letters(e.textContent!)))
      .map((e) => e.textContent)
  })

for (const lang of ['pl', 'en'] as const)
  test(`every ${lang} button with visible text carries it in its accessible name`, async ({ page }) => {
    await open(page, lang)
    expect(await unnamed(page)).toEqual([])
    await playButton(page, lang).click()
    await page.keyboard.press('p')
    expect(await unnamed(page)).toEqual([])
    await page.keyboard.press('p')
    await new Run(page).finish()
    expect(await unnamed(page)).toEqual([])
  })

for (const lang of ['pl', 'en'] as const)
  test(`the ${lang} page declares its language and uses only its own strings`, async ({ page }) => {
    await open(page, lang)
    await expect(page.locator('html')).toHaveAttribute('lang', lang)
    const templates = [...Object.values(strings.visible[lang]), ...Object.values(strings.labels[lang])]
    const seen = new Set<string>()
    const given: string[] = []
    const collect = async () => {
      for (const t of await visibleTexts(page)) if (letters(t)) seen.add(letters(t))
      given.push(...(await names(page)))
    }
    await collect()
    await playButton(page, lang as Lang).click()
    await collect()
    const r = new Run(page)
    await r.go(trunk[0]!.id)
    await collect()
    await page.keyboard.press('p')
    await collect()
    await page.keyboard.press('p')
    await r.finish()
    await collect()
    const visible = new Set(Object.values(strings.visible[lang]).map(letters))
    for (const s of seen) expect(visible, s).toContain(s)
    expect(seen.size).toBeLessThanOrEqual(12)
    for (const n of given) expect(templates.some((t) => fits(t, n)), n).toBe(true)
    expect(given.length).toBeGreaterThan(0)
  })
