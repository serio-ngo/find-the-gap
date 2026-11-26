import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gapOf } from '../src/game/levels/observations.ts'
import type { Context, Row } from '../src/game/levels/observations.ts'

type Observation = {
  id: string; relation: string; items: { role: string; value: unknown }[]; gap: boolean
  links: { run: string }; flags: { visibility: string; split: string; labelled: boolean }; context?: Context | null
}

const value = (v: unknown) => String(v).replace(/^AC\d+(-AC\d+)?:\s*/, '')

type Snapshots = Record<string, { private: boolean; taken: string }>
const KEYS = ['locks', 'impacts', 'agent', 'job', 'share', 'tests', 'criteria'] as const

export const toRows = (text: string, curation: Record<string, string> = {}) => {
  const all = text.trim().split('\n').map((line) => JSON.parse(line) as Observation)
    .filter((o) => o.flags.visibility === 'public' && o.flags.split === 'deck' && o.relation in gapOf)
    .map((o): Row => ({
      id: o.id, rule: o.relation, roles: o.items.map((i) => i.role), values: o.items.map((i) => value(i.value)),
      gap: o.gap, research: !o.flags.labelled, run: o.links.run, context: o.context ?? null,
    }))
  const reason = (r: Row) => {
    if (gapOf[r.rule]!(r.values) !== r.gap) return `${r.rule} [${r.values}] archive gap ${r.gap}`
    const nulls = r.context ? KEYS.filter((k) => r.context![k] == null) : ['context']
    return nulls.length ? `null ${nulls.join(', ')}` : ''
  }
  const open = all.filter((r) => !(r.id in curation))
  const findings = open.flatMap((r) => (reason(r) ? [{ id: r.id, reason: reason(r) }] : []))
  return {
    rows: open.filter((r) => !reason(r)), findings,
    stale: Object.keys(curation).filter((id) => !all.some((r) => r.id === id)),
    manual: all.filter((r) => r.id in curation && !reason(r)).map((r) => r.id),
  }
}

export const staleRepos = (gates: { repo: string; key: string; at: string }[], caseKeys: Set<string>, snapshots: Snapshots): string[] => {
  const pub = gates.filter((g) => snapshots[g.repo] && !snapshots[g.repo]!.private)
  const newest = (repo: string) => Math.max(...pub.filter((g) => g.repo === repo).map((g) => Date.parse(g.at)))
  const when = (t: number) => (Number.isNaN(t) ? 'an unreadable time' : new Date(t).toISOString())
  return [
    ...pub.filter((g) => !caseKeys.has(g.key)).map((g) => `${g.repo}: gate ${g.key} is not in cases.jsonl`),
    ...[...new Set(pub.map((g) => g.repo))].filter((r) => !(Date.parse(snapshots[r]!.taken) >= newest(r))).map((r) => `${r}: snapshot taken ${snapshots[r]!.taken} is not after its newest gate at ${when(newest(r))}`),
  ]
}

const fail = (msg: string): never => { console.error(msg); process.exit(1) }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2]!
  const git = (...args: string[]) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim()
  const json = (...p: string[]) => JSON.parse(readFileSync(join(dir, ...p), 'utf8'))
  const dirty = git('status', '--porcelain', '--', 'observations.jsonl', 'cases.jsonl', 'runs', 'snapshot')
  if (dirty) fail(`archive has uncommitted changes:\n${dirty}`)
  const curation: Record<string, string> = JSON.parse(readFileSync(new URL('deck/curation.json', import.meta.url), 'utf8'))
  const gates = readdirSync(join(dir, 'runs/serio-ngo'), { recursive: true, encoding: 'utf8' }).map((f) => f.replaceAll('\\', '/')).sort()
    .filter((f) => /^[^/]+\/[^/]+\/[^/]+-gate\.json$/.test(f))
    .map((f) => { const [repo, , file] = f.split('/') as [string, string, string]; return { repo, key: `serio-ngo/${repo}/${file.replace('.json', '')}`, at: json('runs/serio-ngo', f).gate.at as string } })
  const caseKeys = new Set(readFileSync(join(dir, 'cases.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l).case as string))
  const snapshots: Snapshots = Object.fromEntries(readdirSync(join(dir, 'snapshot/serio-ngo')).filter((f) => f.endsWith('.json')).sort().map((f) => [f.slice(0, -5), json('snapshot/serio-ngo', f)]))
  const staleList = staleRepos(gates, caseKeys, snapshots)
  if (staleList.length) fail(`stale archive:\n${staleList.join('\n')}`)
  const { rows, findings, stale, manual } = toRows(readFileSync(join(dir, 'observations.jsonl'), 'utf8'), curation)
  if (findings.length || stale.length) {
    fail([
      ...findings.length ? ['findings, review and paste into curation.json:', ...findings.map((f) => `"${f.id}": ${JSON.stringify(f.reason)},`)] : [],
      ...stale.length ? ['curation ids that are not public deck rows:', ...stale] : [],
    ].join('\n'))
  }
  if (manual.length) console.log(`excluded by hand with no automatic finding: ${manual.join(', ')}`)
  const text = `import type { Row } from './observations.ts'\n\nexport const rows: Row[] = [\n${rows.map((r) => `  ${JSON.stringify(r)},`).join('\n')}\n]\n`
  const lines = text.trimEnd().split('\n').length
  if (lines > 200) fail(`rows.ts would have ${lines} lines; the host allows 200`)
  writeFileSync(fileURLToPath(new URL('../src/game/levels/rows.ts', import.meta.url)), text)
  const taken = Object.fromEntries(Object.entries(snapshots).filter(([, s]) => !s.private).map(([r, s]) => [r, s.taken]))
  const provenance = { observations: git('rev-parse', 'HEAD:observations.jsonl'), taken, rows: rows.length, excluded: Object.keys(curation).length }
  writeFileSync(fileURLToPath(new URL('deck/provenance.json', import.meta.url)), `${JSON.stringify(provenance, null, 2)}\n`)
  console.log(`${rows.length} rows, ${provenance.excluded} excluded`)
}
