import { crc32, deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const W = 1200;
const H = 630;
const FONT: Record<string, string[]> = {
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
};
const COLORS = [[217, 83, 79], [240, 173, 78], [92, 184, 92], [91, 192, 222], [153, 102, 204]];

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

export function png(level: number): Buffer {
  const px = Buffer.alloc(W * H * 3);
  const rect = (x: number, y: number, w: number, h: number, c: number[]) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px.set(c, (j * W + i) * 3);
  };
  const diamond = (cx: number, cy: number, r: number, c: number[]) => {
    for (let d = -r; d <= r; d++) rect(cx - (r - Math.abs(d)), cy + d, 2 * (r - Math.abs(d)) + 1, 1, c);
  };
  rect(0, 0, W, H, [24, 26, 33]);

  const glyph = FONT[String(level)];
  const s = 22;
  glyph.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '#') rect(W / 2 - 5 * s / 2 + i * s, 90 + j * s, s, s, [240, 240, 240]);
  }));

  const n = 8;
  const colors = Array.from({ length: n }, (_, i) => COLORS[(i * 2 + level) % COLORS.length]);
  const a = level % 3;
  const b = a + 3 + (level % 2);
  colors[b] = colors[a];
  for (let i = 0; i < n; i++) {
    const cx = 105 + i * 140;
    const hot = i === a || i === b;
    if (hot) rect(cx - 62, 400, 124, 124, [255, 255, 255]);
    if (i % 2) diamond(cx, 462, 52, colors[i]);
    else rect(cx - 48, 414, 96, 96, colors[i]);
  }
  rect(105 + a * 140 + 62, 458, (b - a) * 140 - 124, 8, [255, 255, 255]);

  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (let l = 1; l <= 4; l++) writeFileSync(new URL(`../src/game/levels/preview-${l}.png`, import.meta.url), png(l));
}
