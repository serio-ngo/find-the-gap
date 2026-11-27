import { MAX_MS } from './engine.ts'

export type VisitRecord = { room: number; route: number; pick: number; ms: number; switches: number; first: boolean; doors: number; stations: number[]; dwell: number[] }
export type Board = { top: [string, number][]; n: number; below: number; score: number }

const post = (api: string, path: string, body: unknown, init: RequestInit) =>
  fetch(`${api}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), ...init })

const ms = (x: number) => Math.min(MAX_MS, Math.max(0, Math.round(x)))
const pad = (xs: number[], fill: number) => Array.from({ length: 5 }, (_, i) => xs[i] ?? fill)

export const visitRow = (v: VisitRecord) => [
  v.room, v.route, v.pick, ms(v.ms), Math.min(99, v.switches), +v.first, v.doors, ...pad(v.stations, -1), ...pad(v.dwell, 0).map(ms),
]

export const sendResult = (api: string, body: unknown) => post(api, 'result', body, { keepalive: true }).then(() => {}, () => {})

export const resultRequest = (visits: number[][], edition: string) => ({ v: 0, level: 1, visits, edition })

export const boardRequest = (visits: number[][], edition: string, name: string, sent: boolean) => ({ ...resultRequest(visits, edition), name, sent: +sent })

export const askBoard = async (api: string, body: unknown): Promise<Board | null> => {
  try {
    const r = await post(api, 'board', body, { signal: AbortSignal.timeout(5000) })
    const a = await r.json()
    return r.ok && Array.isArray(a?.top) && Number.isInteger(a.n) ? a : null
  } catch {
    return null
  }
}
