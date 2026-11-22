import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gapOf } from '../src/game/levels/observations.ts'
import type { Context, Row } from '../src/game/levels/observations.ts'

type Observation = {
  id: string; relation: string; items: { role: string; value: unknown }[]; gap: boolean
  links: { run: string }; flags: { visibility: string; split: string; labelled: boolean }; context?: Context | null
}

const value = (v: unknown) => String(v).replace(/^AC\d+(-AC\d+)?:\s*/, '')
const label = (rule: string, v: string[]) => (rule === 'pair' ? v.map((x) => `t${v.indexOf(x) + 1}`) : v)

// A row whose visible values contradict the archive's gap flag is left out and named in `dropped`, never silently.
export const toRows = (text: string): { rows: Row[]; dropped: string[] } => {
  const all = text.trim().split('\n').map((line) => JSON.parse(line) as Observation)
    .filter((o) => o.flags.visibility === 'public' && o.flags.split === 'deck' && o.relation in gapOf)
    .map((o): Row => ({
      id: o.id, rule: o.relation, roles: o.items.map((i) => i.role), values: label(o.relation, o.items.map((i) => value(i.value))),
      gap: o.gap, research: !o.flags.labelled, run: o.links.run, context: o.context ?? null,
    }))
  const ok = (r: Row) => gapOf[r.rule]!(r.values) === r.gap
  return { rows: all.filter(ok), dropped: all.filter((r) => !ok(r)).map((r) => `${r.id} ${r.rule} [${r.values}] archive gap ${r.gap}`) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { rows, dropped } = toRows(readFileSync(process.argv[2]!, 'utf8'))
  if (dropped.length) console.error(`dropped, values contradict the archive flag:\n${dropped.join('\n')}`)
  const out = fileURLToPath(new URL('../src/game/levels/rows.ts', import.meta.url))
  writeFileSync(out, `import type { Row } from './observations.ts'\n\nexport const rows: Row[] = [\n${rows.map((r) => `  ${JSON.stringify(r)},`).join('\n')}\n]\n`)
  console.log(`${rows.length} rows`)
}
