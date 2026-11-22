import { crc32, deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { rng, wave } from '../src/game/engine.ts'
import { colors, paintObject } from '../src/game/gen.ts'
import type { Part } from '../src/game/gen.ts'
import { presentObjects } from '../src/game/objects.ts'
import { decks } from '../src/game/levels/index.ts'

const deck = decks.observations!

const W = 1200
const H = 630
const SS = 2
const WIDTH = W * SS
const HEIGHT = H * SS
const rgb = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16))

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

export function png(level: number): Buffer {
  const px = Buffer.alloc(WIDTH * HEIGHT * 3)
  const put = (x: number, y: number, c: number[]) => px.set(c, (y * WIDTH + x) * 3)
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const glow = Math.max(0, 1 - Math.hypot((x - WIDTH / 2) / WIDTH, (y - HEIGHT / 2) / (HEIGHT * 0.64)))
      put(x, y, [15 + 12 * glow, 17 + 15 * glow, 19 + 18 * glow])
    }
  }
  const color = ['#646b6d', '#3a4852', '#96978c'].map(rgb)
  const stars = rng(101)
  for (let i = 0; i < 290; i++) {
    const x = Math.floor(stars() * (WIDTH - 3))
    const y = Math.floor(stars() * (HEIGHT - 3))
    const size = i % 8 === 0 ? 3 : 2
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) put(x + dx, y + dy, color[i % color.length])
  }

  const raster = ({ points, width, fill, stroke }: Part, cx: number, cy: number, radius: number) => {
    const path = points.map(([x, y]) => [cx + x * radius, cy + y * radius])
    const margin = 1 + width * radius / 2
    const left = Math.floor(Math.min(...path.map(([x]) => x)) - margin)
    const right = Math.ceil(Math.max(...path.map(([x]) => x)) + margin)
    const top = Math.floor(Math.min(...path.map(([, y]) => y)) - margin)
    const bottom = Math.ceil(Math.max(...path.map(([, y]) => y)) + margin)
    const closed = fill ? [...path, path[0]] : path
    const edges = closed.slice(1).map(([x2, y2], i) => {
      const [x, y] = closed[i]
      const dx = x2 - x
      const dy = y2 - y
      return { x, y, y2, dx, dy, length: dx * dx + dy * dy }
    })
    const interior = fill && rgb(colors[fill] ?? fill)
    const line = stroke && rgb(colors[stroke] ?? stroke)
    for (let y = top; y <= bottom; y++) {
      const intersections = interior && edges.filter((p) => (p.y > y) !== (p.y2 > y))
        .map((p) => p.x + (y - p.y) * p.dx / p.dy).sort((a, b) => a - b)
      if (intersections) {
        for (let i = 0; i < intersections.length; i += 2) {
          for (let x = Math.ceil(intersections[i]); x < intersections[i + 1]; x++) put(x, y, interior)
        }
      }
      if (line) {
        for (let x = left; x <= right; x++) {
          const onEdge = edges.some((p) => {
            const t = Math.max(0, Math.min(1, ((x - p.x) * p.dx + (y - p.y) * p.dy) / (p.length || 1)))
            return (x - p.x - t * p.dx) ** 2 + (y - p.y - t * p.dy) ** 2 <= (width * radius / 2) ** 2
          })
          if (onEdge) put(x, y, line)
        }
      }
    }
  }

  const spec = deck.levels.find((l) => l.id === level)!.sequence[0]!
  const objects = presentObjects(deck, wave(deck, spec))
  const radius = Math.min(170, W / (2 * objects.length))
  for (const [i, { shape }] of objects.entries()) {
    const x = W * (i + 0.5) / objects.length
    paintObject(shape, (part) => raster(part, x * SS, H * SS / 2, radius * SS))
  }

  const raw = Buffer.alloc((W * 3 + 1) * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
    const at = (y * SS * WIDTH + x * SS) * 3 + c
    raw[y * (W * 3 + 1) + x * 3 + c + 1] = (px[at] + px[at + 3] + px[at + WIDTH * 3] + px[at + WIDTH * 3 + 3]) / 4
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const { id } of deck.levels) writeFileSync(new URL(`../src/game/levels/preview-${id}.png`, import.meta.url), png(id))
}
