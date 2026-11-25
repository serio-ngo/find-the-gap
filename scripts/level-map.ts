import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pool, wave } from '../src/game/engine.ts'
import { itemOf } from '../src/game/items.ts'
import { CERTAIN, gapOf, level as channels, observations as d, signs } from '../src/game/levels/observations.ts'
import { rows } from '../src/game/levels/rows.ts'

const curation: Record<string, string> = JSON.parse(readFileSync(new URL('deck/curation.json', import.meta.url), 'utf8'))
const archive = process.argv[2]
const out: string[] = []

if (archive) {
  const raw = readFileSync(join(archive, 'observations.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  const count = (f: (o: { relation: string; flags: { visibility: string; split: string } }) => boolean) => raw.filter(f).length
  const pub = count((o) => o.flags.visibility === 'public')
  const deck = count((o) => o.flags.visibility === 'public' && o.flags.split === 'deck')
  const game = count((o) => o.flags.visibility === 'public' && o.flags.split === 'deck' && o.relation in gapOf)
  out.push('```mermaid', 'flowchart LR',
    `  A["observations.jsonl: ${raw.length}"] -->|private: ${raw.length - pub}| X1[out]`,
    `  A --> B["public: ${pub}"] -->|holdout: ${pub - deck}| X2[out]`,
    `  B --> C["public deck: ${deck}"] -->|missing_link, pair, lock_only: ${deck - game}| X3[out]`,
    `  C --> D["game relations: ${game}"] -->|curation.json: ${Object.keys(curation).length}| X4[out]`,
    `  D --> E["rows.ts: ${rows.length}"]`,
    '```', '')
}

for (const l of d.levels) {
  const rule = l.start.rule
  const use = new Map<string, string[]>()
  const add = (id: string, s: string) => use.set(id, [...(use.get(id) ?? []), s])
  l.sequence.forEach((s, i) => {
    const w = wave(d, s)
    w.ids!.forEach((id, k) => add(id, `${i + 1}${CERTAIN.includes(i) ? (w.answers.includes(k) ? 'G' : 'c') : w.answers.includes(k) ? 'g' : ''}`))
  })
  const pooled = new Map<string, number>()
  for (const step of [1, 2, 3, 4, 5]) for (const s of [...pool(d, rule, step), ...pool(d, rule, step, true)]) for (const id of wave(d, s).ids!) pooled.set(id, (pooled.get(id) ?? 0) + 1)
  const mine = rows.filter((r) => r.rule === rule)
  const gaps = mine.filter((r) => r.gap)
  out.push(`## Level ${l.id}: ${rule}`, '',
    `${mine.length} rows from ${new Set(mine.map((r) => r.run)).size} gate runs: ${gaps.length} gaps (${gaps.filter((r) => !r.research).length} scored, ${gaps.filter((r) => r.research).length} research), ${mine.length - gaps.length} controls. Drawn signs: ${Object.keys(channels).join(', ')}.`, '',
    'Waves: number, then G the gap of a certain wave, c a control of a certain wave, g a gap on a research wave, nothing a control on a research wave. Pool: times in the adaptive pools.', '',
    '| # | Row | Run | Values | Gap | Set | Drawn signs | Item | Waves | Pool | Why |',
    '|---|---|---|---|---|---|---|---|---|---|---|')
  mine.forEach((r, i) => {
    const sg = signs(r)
    const drawn = sg ? Object.entries(sg).map(([c, n]) => `${c} ${n}`).join(', ') : 'none'
    const waves = use.get(r.id) ?? []
    const why = r.research ? (waves.length ? 'research row on the unseen wave' : 'research row, not drawn by this edition') : waves.some((w) => w.endsWith('G')) ? 'scored gap chosen for a certain wave' : waves.length || pooled.get(r.id) ? 'scored row' : 'scored row, not drawn by this edition'
    out.push(`| ${i + 1} | \`${r.id}\` | [run](${r.run}) | ${r.values.join(' / ')} | ${r.gap ? 'yes' : 'no'} | ${r.research ? 'research' : 'scored'} | ${drawn} | ${itemOf({ rule, values: r.values, clue: '', signs: sg })} | ${waves.join(' ') || '-'} | ${pooled.get(r.id) ?? 0} | ${why} |`)
  })
  out.push('')
}

const cut = Object.entries(curation)
if (cut.length) out.push('## Excluded by curation.json', '', '| Row | Reason |', '|---|---|', ...cut.map(([id, why]) => `| \`${id}\` | ${why} |`), '')
console.log(out.join('\n'))
