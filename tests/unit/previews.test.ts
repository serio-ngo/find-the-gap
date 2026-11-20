import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { png } from '../../scripts/make-previews.ts';

const levels = [1, 2, 3, 4];

const pixels = (b: Buffer) => {
  const data: Buffer[] = [];
  for (let i = 8; i < b.length; i += b.readUInt32BE(i) + 12) {
    if (b.toString('ascii', i + 4, i + 8) === 'IDAT') data.push(b.subarray(i + 8, i + 8 + b.readUInt32BE(i)));
  }
  return inflateSync(Buffer.concat(data));
};

describe('previews', () => {
  it('writes valid PNG headers', () => {
    for (const l of levels) {
      const b = png(l);
      expect(b.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(b.readUInt32BE(16)).toBe(1200);
      expect(b.readUInt32BE(20)).toBe(630);
    }
  });
  it('differs per level', () => {
    expect(new Set(levels.map((l) => png(l).toString('hex'))).size).toBe(4);
  });
  it('matches the committed files', () => {
    for (const l of levels) {
      expect(pixels(readFileSync(new URL(`../../src/game/levels/preview-${l}.png`, import.meta.url))).equals(pixels(png(l)))).toBe(true);
    }
  });
});
