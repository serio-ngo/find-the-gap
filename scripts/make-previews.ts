import { chromium } from '@playwright/test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { encounters, rowMap } from '../src/game/engine.ts'
import { monster } from '../src/game/gen.ts'
import { rows } from '../src/game/levels/rows.ts'
import { world } from '../src/game/levels/world.ts'

const hatch = '<svg width="0" height="0"><defs><pattern id="rg-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="#2B2620" stroke-width="0.9" opacity="0.5"/></pattern></defs></svg>'

export const html = () => {
  const map = rowMap(rows)
  const room = encounters(world).find((r) => r.certain)!
  const row = (id: string) => `<div style="width:${100 / room.monsters.length}%">${monster(map.get(id)!)}</div>`
  return `<body style="margin:0;width:1200px;height:630px;display:flex;align-items:center;background:#E8DCC0">${hatch}${room.monsters.map(row).join('')}</body>`
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  await page.setContent(html())
  await page.screenshot({ path: fileURLToPath(new URL('../src/game/levels/preview-1.png', import.meta.url)) })
  await browser.close()
}
