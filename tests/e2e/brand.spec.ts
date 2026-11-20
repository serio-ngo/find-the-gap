import { expect, test } from '@playwright/test'
import { open } from './helpers.ts'

const style = (page: import('@playwright/test').Page) =>
  page.locator('.ftg').evaluate((e) => {
    const s = getComputedStyle(e)
    return { bg: s.backgroundColor, fg: s.color, font: s.fontFamily }
  })

test('the root uses local fallbacks without brand variables', async ({ page }) => {
  await open(page)
  expect(await style(page)).toEqual({ bg: 'rgb(246, 243, 236)', fg: 'rgb(21, 23, 28)', font: 'system-ui, sans-serif' })
})

test('the root switches to brand variables when they are defined', async ({ page }) => {
  await open(page)
  await page.addStyleTag({ content: ':root { --surface-page: #112233; --text-strong: #ffeedd; --font-ui: monospace; }' })
  expect(await style(page)).toEqual({ bg: 'rgb(17, 34, 51)', fg: 'rgb(255, 238, 221)', font: 'monospace' })
})
