import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { png } from '../../scripts/make-previews.ts';

const levels = [1, 2, 3, 4];

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
      expect(readFileSync(new URL(`../../src/game/levels/preview-${l}.png`, import.meta.url)).equals(png(l))).toBe(true);
    }
  });
});
