import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { BINDINGS, clueOf, gapOf } from '../src/game/levels/observations.ts'
import type { Context, Door, Relation, Room, Row, Suite, Wing, World } from '../src/game/levels/observations.ts'
import { failed, gateReport, rng } from './gates.ts'

type Observation = {
  id: string; relation: string; items: { role: string; value: unknown }[]; gap: boolean
  links: { run: string; pr?: string }; flags: { visibility: string; split: string; labelled: boolean }; context?: Context | null
}
type Placed = Row & { pr: string }
type Case = { repo: string; pr: number | null; date: string; defects: string[]; visibility: string; context?: { merged_at?: string } }

const TRUNK_REPO = 'serio-focus'
const DEFECT = 'wrong_tested_sha'
const KEY = 12
const ATTEMPTS = 20000
const LINES = 190
const RELATIONS = Object.keys(gapOf) as Relation[]
const FIELDS = BINDINGS.map((b) => b.field)

const value = (v: unknown) => String(v).replace(/^AC\d+(-AC\d+)?:\s*/, '')

export const toRows = (text: string, curation: Record<string, string> = {}) => {
  const seen = text.trim().split('\n').map((line) => JSON.parse(line) as Observation).filter((o) => o.flags.visibility === 'public')
  const all = seen.filter((o) => o.flags.split === 'deck' && o.relation in gapOf)
    .map((o): Placed => ({
      id: o.id, rule: o.relation, roles: o.items.map((i) => i.role), values: o.items.map((i) => value(i.value)),
      gap: o.gap, research: !o.flags.labelled, run: o.links.run, context: o.context ?? null, pr: o.links.pr ?? '',
    }))
  const reason = (r: Row) => {
    if (gapOf[r.rule]!(r.values) !== r.gap) return `${r.rule} [${r.values}] archive gap ${r.gap}`
    const nulls = r.context ? FIELDS.filter((k) => r.context![k] == null) : ['context']
    return nulls.length ? `null ${nulls.join(', ')}` : ''
  }
  const open = all.filter((r) => !(r.id in curation))
  const findings = open.flatMap((r) => (reason(r) ? [{ id: r.id, reason: reason(r) }] : []))
  return {
    rows: open.filter((r) => !reason(r)), findings,
    stale: Object.keys(curation).filter((id) => !all.some((r) => r.id === id)),
    manual: all.filter((r) => r.id in curation && !reason(r)).map((r) => r.id),
    public: seen.length, holdout: seen.filter((o) => o.flags.split !== 'deck').length, other: seen.filter((o) => o.flags.split === 'deck' && !(o.relation in gapOf)).length,
  }
}

const shuffle = <T>(r: () => number, a: T[]) => a.map((x) => [r(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1])
const repoOf = (r: Row) => r.run.split('/')[4]!
const prOf = (r: Placed) => +r.pr.split('/').pop()!
const room = (id: string, cell: [number, number], rows: Row[] = [], certain = false, relation?: Relation): Room => {
  const varies = (f: (typeof FIELDS)[number]) => new Set(rows.map((r) => clueOf(f, r.context!))).size > 1
  return { id, cell, ...relation ? { relation } : {}, monsters: rows.map((r) => r.id), certain, herring: false, stage: rows.length ? FIELDS.filter((f) => !varies(f)) : [], clues: rows.length ? FIELDS.filter(varies) : [] }
}

const draw = (pool: Placed[], seed: number) => {
  const r = rng(seed)
  const gaps = shuffle(r, pool.filter((x) => x.gap)).slice(0, 4)
  const controls = shuffle(r, pool.filter((x) => !x.gap))
  return gaps.map((g, k) => shuffle(r, [g, ...controls.splice(0, 2 + Math.floor(r() * 3))]))
}

const split = (n: number) => { const k = Math.ceil(n / 5); return Array.from({ length: k }, (_, i) => Math.floor(n / k) + +(i < n % k)) }

const certainRooms = (pool: Placed[], all: Row[]) => {
  const why = new Map<string, number>()
  for (let seed = 0; seed < ATTEMPTS; seed++) {
    const picks = draw(pool, seed)
    const rooms = picks.map((rows, k) => room(`t${k + 1}`, [0, 0], rows, true, 'odd_revision'))
    const miss = failed(gateReport({ wings: [{ suites: [{ rooms }] }], bindings: BINDINGS }, all))
    if (!miss.length) return { seed, picks }
    why.set(miss[0]!, (why.get(miss[0]!) ?? 0) + 1)
  }
  throw new Error(`no certain draw passes every gate in ${ATTEMPTS} seeds; first failing gate: ${[...why].map(([g, n]) => `${g} ${n}`).join(', ')}`)
}

const grid = (dates: string[]) => {
  const day = (d: string) => Math.floor(Date.parse(d) / 864e5)
  const days = dates.map(day)
  const first = Math.min(...days) - ((Math.min(...days) + 4) % 7)
  const weeks = Math.ceil((Math.max(...days) - first + 1) / 7)
  const counts = Array.from({ length: weeks * 7 }, (_, i) => days.filter((d) => d - first === i).length)
  return counts.map((c) => Math.ceil((4 * c) / Math.max(...counts)))
}

type Snapshot = { private: boolean; prs: Record<string, { merged_at: string | null; commits: { at: string }[] }> }

export const buildWorld = ({ observations, cases, snapshots = {} }: { observations: string; cases: string; snapshots?: Record<string, string> }, curation: Record<string, string>): Record<string, string> => {
  const { rows } = toRows(observations, curation)
  const info = cases.trim().split('\n').map((l) => JSON.parse(l) as Case).filter((c) => c.visibility === 'public')
  const snaps = new Map(Object.entries(snapshots).map(([repo, text]) => [repo, JSON.parse(text) as Snapshot] as const).filter(([, s]) => !s.private))
  const when = (repo: string, pr: number) => snaps.get(repo)?.prs[pr]?.merged_at ?? info.filter((c) => c.repo.endsWith(`/${repo}`) && c.pr === pr).map((c) => c.context?.merged_at ?? '9999').sort().at(-1) ?? '9999'
  const defects = (repo: string, prs: number[]) => info.some((c) => c.repo.endsWith(`/${repo}`) && c.pr !== null && prs.includes(c.pr) && c.defects.includes(DEFECT))
  const { seed, picks } = certainRooms(rows.filter((r) => r.rule === 'odd_revision' && !r.research && repoOf(r) === TRUNK_REPO), rows)
  const taken = new Set(picks.flat().map((r) => r.id))
  const left = rows.filter((r) => !taken.has(r.id))
  const draws = rng(seed)
  const repos = [TRUNK_REPO, ...[...new Set(rows.map(repoOf))].filter((x) => x !== TRUNK_REPO).sort()]
  const groups = new Map<string, { prs: number[]; rows: Placed[] }[]>()
  for (const repo of repos) {
    const mine = left.filter((r) => repoOf(r) === repo)
    const order = [...new Set(mine.map(prOf))].sort((a, b) => when(repo, a).localeCompare(when(repo, b)) || a - b)
    const ok = (prs: number[]) => {
      const part = mine.filter((r) => prs.includes(prOf(r)))
      return new Set(part.map((r) => r.run)).size >= 3 && RELATIONS.every((rel) => { const n = part.filter((r) => r.rule === rel).length; return n === 0 || n >= 3 })
    }
    const sets: number[][] = []
    let cur: number[] = []
    for (const n of order) { cur.push(n); if (ok(cur)) { sets.push(cur); cur = [] } }
    if (cur.length) sets.length ? sets.at(-1)!.push(...cur) : sets.push(cur)
    groups.set(repo, sets.map((prs) => ({ prs, rows: mine.filter((r) => prs.includes(prOf(r))) })))
  }
  const built = new Map(repos.map((repo) => [repo, groups.get(repo)!.map(({ prs, rows: part }) => {
    const prefix = repo[0]!
    const sizes = RELATIONS.flatMap((rel) => split(part.filter((r) => r.rule === rel).length).map((n) => [rel, n] as const)).filter(([, n]) => n > 0)
    const bad = sizes.find(([, n]) => n < 3)
    if (bad) throw new Error(`${repo} #${prs.join('+')} has a ${bad[0]} room of ${bad[1]}`)
    const queue = new Map(RELATIONS.map((rel) => [rel, shuffle(draws, part.filter((r) => r.rule === rel))]))
    return { id: `${prefix}${prs[0]}`, prs, plan: sizes.map(([rel, n]) => ({ rel, rows: queue.get(rel)!.splice(0, n) })) }
  })]))
  const pitch = 1 + Math.max(...[...built.values()].flat().map((s) => Math.ceil(s.plan.length / 2)))
  const doors: Door[] = []
  const link = (a: string, b: string, kind: Door['kind'], git: Door['git']) => doors.push({ a, b, kind, git })
  const wings: Wing[] = repos.map((repo) => {
    const suites = built.get(repo)!
    const prefix = repo[0]!
    const halls = Math.ceil(suites.length / 2) + 1
    const trunkWing = repo === TRUNK_REPO
    const slots = trunkWing
      ? [`${prefix}h0`, ...Array.from({ length: 4 }, (_, j) => [...Array.from({ length: Math.floor((halls - 1) / 4) + +(j < (halls - 1) % 4) }, () => 'hall'), `t${j + 1}`]).flat(), 'gate']
      : Array.from({ length: halls - 1 }, () => 'hall')
    let hall = 1
    const ids = slots.map((s) => (s === 'hall' ? `${prefix}h${hall++}` : s))
    const x0 = trunkWing ? 0 : -(ids.length + 1) * pitch
    const at = new Map(ids.map((id, k) => [id, x0 + k * pitch]))
    ids.slice(1).forEach((id, k) => link(ids[k]!, id, 'open', id === 'gate' ? 'merge' : 'parent'))
    const anchors = ids.filter((id) => /h\d+$/.test(id))
    const made: Suite[] = suites.map((s, i) => {
      const above = i % 2 === 0
      const anchor = anchors[trunkWing ? 1 + (i >> 1) : i >> 1]!
      const cells = s.plan.map((_, k): [number, number] => [at.get(anchor)! + (k >> 1), above ? -1 - (k % 2) : 1 + (k % 2)])
      const rooms = s.plan.map((p, k) => room(`${s.id}.${k}`, cells[k]!, p.rows, false, p.rel))
      link(anchor, rooms[0]!.id, 'open', 'parent')
      rooms.forEach((a, i) => rooms.slice(i + 1).forEach((b) => { if (Math.abs(b.cell[0] - a.cell[0]) + Math.abs(b.cell[1] - a.cell[1]) === 1) link(a.id, b.id, 'open', 'parent') }))
      return { id: s.id, prs: s.prs, origin: [Math.min(...cells.map((c) => c[0])), Math.min(...cells.map((c) => c[1]))], rooms }
    })
    const cell = (id: string): [number, number] => [at.get(id)!, 0]
    const pseudo = (id: string, prs: Room[]): Suite => ({ id, prs: [], origin: prs[0]!.cell, rooms: prs })
    const hallRooms = ids.filter((id) => /h\d+$/.test(id) || id === 'gate').map((id) => room(id, cell(id)))
    const certain = ids.filter((id) => id.startsWith('t')).map((id, k) => room(id, cell(id), picks[k], true, 'odd_revision'))
    return {
      id: repo, repo: `serio-ngo/${repo}`, trunk: ids, grid: grid(snaps.has(repo) ? Object.values(snaps.get(repo)!.prs).flatMap((p) => p.commits.map((c) => c.at)) : info.filter((c) => c.repo.endsWith(`/${repo}`)).map((c) => c.date)),
      suites: [pseudo('hall', hallRooms), ...trunkWing ? [pseudo('trunk', certain)] : [], ...made, ...trunkWing ? [pseudo('vault', [room('vault', [at.get('gate')!, -1])])] : []],
    }
  })
  const first = (repo: string, last = false) => { const s = built.get(repo)!.filter((x) => defects(repo, x.prs)); return last ? s.at(-1) : s[0] }
  const defect = first(TRUNK_REPO)
  const sandbox = repos.slice(1).flatMap((repo) => built.get(repo)!.filter((s) => defects(repo, s.prs)).map((s) => ({ repo, s })))
    .sort((p, q) => Math.abs(Date.parse(when(p.repo, p.s.prs.at(-1)!)) - Date.parse(when(TRUNK_REPO, defect!.prs[0]!))) - Math.abs(Date.parse(when(q.repo, q.s.prs.at(-1)!)) - Date.parse(when(TRUNK_REPO, defect!.prs[0]!))))[0]
  if (defect && sandbox) link(`${defect.id}.0`, `${sandbox.s.id}.0`, 'hidden', 'defect')
  const fix = first(TRUNK_REPO, true)
  if (defect && fix && fix !== defect) link(`${defect.id}.0`, `${fix.id}.0`, 'hidden', 'fix')
  const focus = wings[0]!
  link(focus.trunk.at(-3)!, 'vault', 'hidden', 'vault')
  const head = { archive: { commit: JSON.parse(readFileSync(new URL('deck/provenance.json', import.meta.url), 'utf8')).commit ?? '' }, seed, key: KEY, start: focus.trunk[0]!, gate: 'gate' }
  const flat = wings.flatMap((w) => w.suites.flatMap((s) => s.rooms))
  const reader = gateReport({ wings, bindings: BINDINGS }, rows)
  for (const r of flat) r.herring = reader.herringRooms.includes(r.id)
  return { ...output(head, wings, doors), ...rowFiles(flat.flatMap((r) => r.monsters).map((id) => rows.find((x) => x.id === id)!).map(({ pr: _, ...row }) => row)) }
}

const j = JSON.stringify
const output = (head: { archive: { commit: string }; seed: number; key: number; start: string; gate: string }, wings: Wing[], doors: Door[]) => {
  const edition = `world:${createHash('sha256').update(j([head, wings, doors, BINDINGS])).digest('hex').slice(0, 12)}`
  const text = [
    "import type { World } from './observations.ts'", "import { doors } from './world-doors.ts'", '',
    'export const world: World = {',
    `  edition: ${j(edition)}, archive: ${j(head.archive)}, seed: ${head.seed}, key: ${head.key}, start: ${j(head.start)}, gate: ${j(head.gate)},`,
    `  bindings: ${j(BINDINGS)}, doors,`,
    '  wings: [',
    ...wings.flatMap((w) => [
      `    { "id": ${j(w.id)}, "repo": ${j(w.repo)}, "trunk": ${j(w.trunk)}, "grid": ${j(w.grid)}, "suites": [`,
      ...w.suites.flatMap((s) => [`      { "id": ${j(s.id)}, "prs": ${j(s.prs)}, "origin": ${j(s.origin)}, "rooms": [`, ...s.rooms.map((r) => `        ${j(r)},`), '      ] },']),
      '    ] },',
    ]),
    '  ],', '}', '',
  ].join('\n')
  const doorText = ["import type { Door } from './observations.ts'", '', 'export const doors: Door[] = [', ...doors.map((d) => `  ${j(d)},`), ']', ''].join('\n')
  return { 'world.ts': text, 'world-doors.ts': doorText } as Record<string, string>
}

const rowFiles = (rows: Row[]) => {
  const size = LINES - 6
  const parts = Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size))
  return {
    ...Object.fromEntries(parts.map((p, i) => [`rows-${i + 1}.ts`, ["import type { Row } from './observations.ts'", '', 'export const rows: Row[] = [', ...p.map((r) => `  ${j(r)},`), ']', ''].join('\n')])),
    'rows.ts': [...parts.map((_, i) => `import { rows as part${i + 1} } from './rows-${i + 1}.ts'`), '', `export const rows = [${parts.map((_, i) => `...part${i + 1}`).join(', ')}]`, ''].join('\n'),
  }
}
