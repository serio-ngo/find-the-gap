import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gateReport } from './gates.ts'
import { gapOf } from '../src/game/levels/observations.ts'
import { rows } from '../src/game/levels/rows.ts'
import { world } from '../src/game/levels/world.ts'

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
    `  B --> C["public deck: ${deck}"] -->|other relations: ${deck - game}| X3[out]`,
    `  C --> D["game relations: ${game}"] -->|curation.json: ${Object.keys(curation).length}| X4[out]`,
    `  D --> E["placed: ${rows.length}"]`,
    '```', '')
}

const byId = new Map(rows.map((r) => [r.id, r]))
const doors = Object.entries(Object.groupBy(world.doors, (d) => `${d.kind} ${d.git}`)).map(([k, v]) => `${k} ${v!.length}`).join(', ')
out.push(`## World ${world.edition}`, '', `Archive ${world.archive.commit}, seed ${world.seed}, key ${world.key}, start ${world.start}, gate ${world.gate}. Doors: ${world.doors.length} (${doors}).`, '')
for (const w of world.wings) {
  const rooms = w.suites.flatMap((s) => s.rooms)
  out.push(`### Wing ${w.repo}`, '', `${w.suites.length} suites, ${rooms.length} rooms, ${rooms.flatMap((r) => r.monsters).length} monsters, trunk ${w.trunk.join(' ')}.`, '',
    '| Suite | PRs | Room | Relation | Monsters | Gaps | Certain | Herring | Stage | Clues |', '|---|---|---|---|---|---|---|---|---|---|')
  for (const s of w.suites) for (const r of s.rooms) out.push(`| ${s.id} | ${s.prs.join(' ')} | ${r.id} | ${r.relation ?? ''} | ${r.monsters.length} | ${r.monsters.filter((id) => byId.get(id)!.gap).length} | ${r.certain ? 'yes' : ''} | ${r.herring ? 'yes' : ''} | ${r.stage.join(' ')} | ${r.clues.join(' ')} |`)
  out.push('')
}

const g = gateReport(world, rows)
out.push('### Gates', '', '| Gate | Value | Limit |', '|---|---|---|',
  ...Object.entries(g.fields).map(([f, v]) => `| field ${f} | ${v.toFixed(2)} | 0.65 |`),
  `| reader | ${g.reader.toFixed(2)} | 0.65 |`, `| rooms with a red herring | ${g.herrings} of 4 | 2 |`, `| permutation p | ${g.p.toFixed(3)} | 0.05 |`,
  `| certain values seen on both sides | ${g.mixed} | true |`, `| gap and control values equal | ${g.mirrored} | true |`, `| reused rows | ${g.reused} | 0 |`, '')

const cut = Object.entries(curation)
if (cut.length) out.push('## Excluded by curation.json', '', '| Row | Reason |', '|---|---|', ...cut.map(([id, why]) => `| \`${id}\` | ${why} |`), '')
console.log(out.join('\n'))
