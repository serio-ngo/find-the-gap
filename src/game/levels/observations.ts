export type Context = { locks: number | null; impacts: number | null; agent: number | null; job: string | null; share: number | null; tests: number | null; criteria: number | null }
export type Row = { id: string; rule: string; roles: string[]; values: string[]; gap: boolean; research: boolean; run: string; context: Context | null }

export type RoomId = string
export type Relation = 'odd_revision' | 'lock_only' | 'missing_link' | 'pair'
export type Room = { id: RoomId; cell: [number, number]; relation?: Relation; monsters: string[]; certain: boolean; herring: boolean; stage: string[]; clues: string[] }
export type Suite = { id: string; prs: number[]; origin: [number, number]; rooms: Room[] }
export type Wing = { id: string; repo: string; trunk: RoomId[]; grid: number[]; suites: Suite[] }
export type Door = { a: RoomId; b: RoomId; kind: 'open' | 'hidden'; git: 'parent' | 'merge' | 'defect' | 'fix' | 'vault' }
export type Binding = { field: 'job' | 'locks' | 'share' | 'agent' | 'impacts'; station: 'lamp' | 'padlock' | 'ring' | 'drone' | 'crack' }
export type World = { edition: string; archive: { commit: string }; seed: number; key: number; start: RoomId; gate: RoomId; wings: Wing[]; doors: Door[]; bindings: Binding[] }

export const gapOf: Record<string, (values: string[]) => boolean> = {
  odd_revision: (v) => v[0] !== v[1],
  lock_only: (v) => v[0] === 'passed' && v[1] === 'fail',
  missing_link: (v) => v.includes('missing'),
  pair: (v) => { const t = v.filter((x) => x !== '-'); return new Set(t).size < t.length },
}

export const clueOf = (field: Binding['field'], c: Context) => {
  const v = c[field]
  return field === 'share' ? Math.round((v as number) * 10) : field === 'locks' ? Math.min(v as number, 2) : field === 'impacts' ? Math.min(v as number, 1) : v
}

export const BINDINGS: Binding[] = [
  { field: 'job', station: 'lamp' }, { field: 'locks', station: 'padlock' }, { field: 'share', station: 'ring' },
  { field: 'agent', station: 'drone' }, { field: 'impacts', station: 'crack' },
]

export const place = (row: Row) => {
  const c = row.context!
  const band = (c.agent ?? 0) * 2 + Number(c.job === 'success')
  const n = Math.min((c.locks ?? 0) + (c.impacts ?? 0), 3)
  return { y: Math.min(Math.round((1 - (c.share ?? 1)) * 30), 3), band, items: Array.from({ length: n }, (_, i) => BINDINGS[(band + i) % BINDINGS.length]!.field) }
}
