import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildWorld, toRows } from './world.ts'

type Snapshots = Record<string, { private: boolean; taken: string }>

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
  const observations = readFileSync(join(dir, 'observations.jsonl'), 'utf8')
  const { rows, findings, stale, manual, public: total, holdout, other } = toRows(observations, curation)
  if (findings.length || stale.length) {
    fail([
      ...findings.length ? ['findings, review and paste into curation.json:', ...findings.map((f) => `"${f.id}": ${JSON.stringify(f.reason)},`)] : [],
      ...stale.length ? ['curation ids that are not public deck rows:', ...stale] : [],
    ].join('\n'))
  }
  if (manual.length) console.log(`excluded by hand with no automatic finding: ${manual.join(', ')}`)
  const taken = Object.fromEntries(Object.entries(snapshots).filter(([, s]) => !s.private).map(([r, s]) => [r, s.taken]))
  const provenance = { observations: git('rev-parse', 'HEAD:observations.jsonl'), commit: git('rev-parse', '--short', 'HEAD'), taken, public: total, rows: rows.length, holdout, other, excluded: Object.keys(curation).length }
  if (provenance.rows + holdout + other + provenance.excluded !== total) fail(`provenance does not add up: ${JSON.stringify(provenance)}`)
  writeFileSync(fileURLToPath(new URL('deck/provenance.json', import.meta.url)), `${JSON.stringify(provenance, null, 2)}\n`)
  const files = buildWorld({ observations, cases: readFileSync(join(dir, 'cases.jsonl'), 'utf8'), snapshots: Object.fromEntries(Object.keys(snapshots).filter((r) => !snapshots[r]!.private).map((r) => [r, readFileSync(join(dir, 'snapshot/serio-ngo', `${r}.json`), 'utf8')])) }, curation)
  const long = Object.entries(files).filter(([, text]) => text.trimEnd().split('\n').length > 200)
  if (long.length) fail(`over 200 lines, the host allows 200: ${long.map(([name]) => name).join(', ')}`)
  const levels = fileURLToPath(new URL('../src/game/levels/', import.meta.url))
  for (const f of readdirSync(levels).filter((f) => /^rows-\d+\.ts$/.test(f) && !(f in files))) rmSync(join(levels, f))
  for (const [name, text] of Object.entries(files)) writeFileSync(join(levels, name), text)
  console.log(`${rows.length} placed, ${holdout} holdout, ${other} other relation, ${provenance.excluded} excluded; ${Object.keys(files).length} files`)
}
