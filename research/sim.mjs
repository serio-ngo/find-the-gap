import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const HERE = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? process.env.ARCHIVE;
if (!HERE) { console.error('usage: node research/sim.mjs <run archive folder> [--self-test]'); process.exit(1); }
const GAME = new URL('../src/game/', import.meta.url);
const mod = (p) => import(new URL(p, GAME).href);
const { rows } = await mod('levels/rows.ts');
const { decks } = await mod('levels/index.ts');
const { wave, rng } = await mod('engine.ts');
const { shape, colors, families, hash } = await mod('gen.ts');
const { presentObjects } = await mod('objects.ts');
const { params } = await mod('levels/observations.ts');
const deck = decks.observations;
const ai = JSON.parse(readFileSync(new URL('eval/ai-run.json', GAME), 'utf8')).standard;
const read = (f) => readFileSync(join(HERE, f), 'utf8');
const PUBLIC = ['serio-focus', 'lifecycle-sandbox'], AGENT = ['lifecycle', 'codex', 'bot'], HUMAN = ['owner', 'person'];
const snaps = Object.fromEntries(PUBLIC.map((r) => [r, JSON.parse(read(`snapshot/serio-ngo/${r}.json`))]));
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const gateRecords = PUBLIC.flatMap((r) => walk(join(HERE, 'runs', 'serio-ngo', r))).filter((f) => f.endsWith('-gate.json')).map((f) => JSON.parse(readFileSync(f, 'utf8')).gate);
const gateAt = new Map(gateRecords.map((g) => [`https://github.com/${g.repository}/actions/runs/${g.run}`, g.at]));
const cases = read('cases.jsonl').trim().split('\n').map((l) => JSON.parse(l));
const gates = new Map(cases.filter((c) => c.kind === 'gate').map((c) => [c.links.run, c]));
const byId = new Map(rows.map((r) => [r.id, r]));

const contextOf = (run) => {
  const c = gates.get(run), T = gateAt.get(run), repo = c.repo.split('/')[1], p = snaps[repo].prs[c.pr], n = c.tests.passed + c.tests.failed;
  const base = { run, T, t: Date.parse(T), pr: `${repo}#${c.pr}`, n, passed: c.tests.passed, failed: c.tests.failed, share: n ? c.tests.passed / n : 0, criteria: c.criteria.length, job: c.jobs.tests, outcome: c.outcome, next: c.next_action, defects: c.defects.join('+') || '-', date: c.date };
  if (!p) return { ...base, known: false };
  const before = (x) => x.at < T, commits = p.commits.filter((x) => before(x) && !x.merge), count = (list, who) => list.filter((x) => who.includes(x.by)).length;
  return {
    ...base, known: true, locks: p.tests_ok.filter(before).length, impacts: p.findings.filter(before).length + p.change_requests.filter(before).length,
    agent: count(commits, AGENT), human: count(commits, HUMAN), lastHuman: HUMAN.includes(commits.at(-1)?.by),
    final: { locks: p.locks, impacts: p.findings.length + p.change_requests.length, agent: count(p.commits, AGENT), human: count(p.commits.filter((x) => !x.merge), HUMAN) },
  };
};
const ctx = new Map([...new Set(rows.map((r) => r.run))].map((u) => [u, contextOf(u)]));
const C = (row) => ctx.get(row.run);
const prGates = new Map();
for (const g of gateRecords) { const k = `${g.repository}#${g.pr}`; prGates.set(k, [...(prGates.get(k) || []), g].sort((a, b) => a.at.localeCompare(b.at))); }
for (const c of ctx.values()) {
  const g = gates.get(c.run), list = prGates.get(`${g.repo}#${g.pr}`) || [], k = list.findIndex((x) => x.at === c.T), prev = k > 0 ? list[k - 1] : null;
  const p = snaps[g.repo.split('/')[1]].prs[g.pr], since = (x) => prev && x.at >= prev.at && x.at < c.T, pc = prev && gates.get(`https://github.com/${prev.repository}/actions/runs/${prev.run}`);
  c.rel = { order: k + 1, tests: !pc ? 'first' : Math.sign(c.n - (pc.tests.passed + pc.tests.failed)), impacts: !prev || !p ? 'first' : Math.min(2, p.findings.filter(since).length + p.change_requests.filter(since).length), agent: !prev || !p ? 'first' : Math.min(2, p.commits.filter((x) => since(x) && !x.merge && AGENT.includes(x.by)).length) };
}

const H = (xs) => {
  const m = new Map();
  for (const x of xs) m.set(x, (m.get(x) || 0) + 1);
  return -[...m.values()].reduce((s, k) => s + (k / xs.length) * Math.log2(k / xs.length), 0);
};
const MI = (a, b) => H(a) + H(b) - H(a.map((x, i) => `${x}|${b[i]}`));
const shuffle = (r, xs) => xs.map((x) => [r(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
const leak = (a, g, perms = 2000) => {
  const mi = MI(a, g), r = rng(7), base = Array.from({ length: perms }, () => MI(a, shuffle(r, g))), mean = base.reduce((s, x) => s + x, 0) / perms;
  return { ami: (mi - mean) / (H(g) - mean), p: (base.filter((x) => x >= mi).length + 1) / (perms + 1) };
};
const RULES = ['odd_revision', 'missing_link', 'pair'];
const known = (f) => (c) => (c.known ? f(c) : '?');
const FIELDS = {
  'tests run, log2 bin': (c) => Math.round(Math.log2(1 + c.n)),
  'failed tests': (c) => c.failed,
  'pass share, quartile': (c) => Math.min(3, Math.floor(c.share * 4)),
  'criteria count': (c) => c.criteria,
  'tests job': (c) => c.job,
  'locks before T': known((c) => c.locks),
  'locks, PR final': known((c) => c.final.locks),
  'review impacts before T': known((c) => c.impacts),
  'review impacts, PR final': known((c) => c.final.impacts),
  'agent commits before T': known((c) => c.agent),
  'agent commits, PR final': known((c) => c.final.agent),
  'human commits before T': known((c) => c.human),
  'human commits, PR final': known((c) => c.final.human),
  'last commit by a human': known((c) => c.lastHuman),
  'gate number within the PR': (c) => Math.min(4, c.rel.order),
  'tests run vs previous gate (sign)': (c) => c.rel.tests,
  'review impacts since previous gate': (c) => c.rel.impacts,
  'agent commits since previous gate': (c) => c.rel.agent,
  'pull request': (c) => c.pr,
  'day': (c) => c.date,
  'outcome (after T)': (c) => c.outcome,
  'next action (from the gap)': (c) => c.next,
  'defects (from the gap)': (c) => c.defects,
};
const audit = Object.entries(FIELDS).map(([name, f]) => {
  const all = [...ctx.values()].map((c) => String(f(c)));
  return { name, distinct: new Set(all).size, H: H(all), rules: RULES.map((rule) => { const rs = rows.filter((r) => r.rule === rule); return leak(rs.map((r) => String(f(C(r)))), rs.map((r) => String(r.gap))); }) };
});

const W = 960, HH = 600, BAND = 64, TOP = 8, FIELD = '#16130f';
const grid = (count) => {
  const cell = (c) => Math.min(W / c, (HH - BAND - TOP) / Math.ceil(count / c));
  const cols = Array.from({ length: count }, (_, i) => i + 1).reduce((b, c) => (cell(c) > cell(b) ? c : b)), rs = Math.ceil(count / cols);
  return { R: Math.max(14, Math.min(W / cols, (HH - BAND - TOP) / rs) / 2), at: (slot) => { const row = Math.floor(slot / cols), len = Math.min(cols, count - row * cols); return [((slot % cols) + 0.5) / len * W, TOP + ((row + 0.5) / rs) * (HH - BAND - TOP)]; } };
};
const TAU = 2 * Math.PI;
const at = (a, r, c = [0, 0]) => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
const circle = (c, r, n = 14) => Array.from({ length: n }, (_, i) => at((i * TAU) / n, r, c));
const oval = (c, a, b, angle = 0, n = 12) => Array.from({ length: n }, (_, i) => {
  const x = a * Math.cos((i * TAU) / n), y = b * Math.sin((i * TAU) / n);
  return [c[0] + x * Math.cos(angle) - y * Math.sin(angle), c[1] + x * Math.sin(angle) + y * Math.cos(angle)];
});
const sizeOf = (c, alpha = 1) => 1 - 0.2 * alpha * (1 - Math.min(1, Math.log(1 + c.n) / Math.log(61)));
const mix = (a, b, t) => `#${[1, 3, 5].map((i) => Math.round(parseInt((colors[a] ?? a).slice(i, i + 2), 16) * t + parseInt((colors[b] ?? b).slice(i, i + 2), 16) * (1 - t)).toString(16).padStart(2, '0')).join('')}`;
const halo = (c, alpha = 1) => {
  if (!c.known || !c.locks) return [];
  const [glow, core] = (c.job === 'success' ? ['#2f4570', '#7fa8ff'] : ['#3a3f4a', '#8b93a8']).map((k) => mix(k, FIELD, alpha)), span = Math.max(0.08, c.share) * TAU;
  return Array.from({ length: Math.min(3, c.locks) }, (_, k) => {
    const r = 0.8 + 0.065 * k, m = Math.max(2, Math.round((48 * span) / TAU));
    const points = Array.from({ length: m + 1 }, (_, i) => at(-Math.PI / 2 - span / 2 + (i * span) / m, r));
    return [{ points, stroke: glow, width: 0.05 }, { points, stroke: core, width: 0.018 }];
  }).flat();
};
const spots = (k) => {
  const pairs = Math.min(2, Math.floor(k / 2)), axis = Math.min(2, k - 2 * pairs);
  return [...[[0, -0.36], [0, 0.36]].slice(0, axis), ...[[0.3, -0.14], [0.26, 0.2]].slice(0, pairs).flatMap(([x, y]) => [[-x, y], [x, y]])];
};
const craters = (c, family, alpha = 1) => {
  if (!c.known) return [];
  return spots(Math.min(6, c.impacts)).flatMap((p) => {
    const size = 0.075, flat = 1 - Math.min(0.5, Math.hypot(p[0], p[1]) * 0.9), angle = Math.atan2(p[1], p[0]), tone = (k) => mix(`${family}${k}`, `${family}2`, alpha);
    return [
      { points: oval(p, size * flat, size, angle), fill: tone(1), width: 0 },
      { points: oval([p[0], p[1] + size * 0.28], size * flat * 0.72, size * 0.72, angle), fill: tone(3), width: 0 },
      { points: oval([p[0], p[1] + size * 0.12], size * flat * 0.62, size * 0.62, angle), fill: tone(2), width: 0 },
    ];
  });
};
const alien = (c, family = 'basalt', alpha = 1) => {
  if (!c.known || !c.agent) return [];
  const [lit, shade] = (c.lastHuman ? ['#d9a441', '#6e4f14'] : ['#f2d45c', '#8a7322']).map((k) => mix(k, `${family}2`, alpha)), r = 0.09 + 0.015 * Math.min(3, c.agent - 1), y = 0.04;
  const eyes = [[0], [-0.38, 0.38], [-0.45, 0, 0.45]][Math.min(3, c.agent) - 1];
  return [
    ...[-1, 1].flatMap((s) => [
      { points: [[s * 0.35 * r, y - 0.8 * r], [s * 0.62 * r, y - 1.45 * r]], stroke: shade, width: 0.014 },
      { points: circle([s * 0.62 * r, y - 1.45 * r], 0.16 * r, 10), fill: lit, stroke: shade, width: 0.006 },
    ]),
    { points: oval([0, y], r, r * 1.05, 0, 18), fill: shade, stroke: shade, width: 0.008 },
    { points: oval([0, y - 0.12 * r], r * 0.86, r * 0.9, 0, 18), fill: lit, width: 0 },
    ...eyes.flatMap((e) => [
      { points: circle([e * r, y - 0.12 * r], 0.22 * r, 12), fill: mix('armor', `${family}2`, alpha), width: 0 },
      { points: circle([e * r, y - 0.08 * r], 0.1 * r, 10), fill: mix('void', `${family}2`, alpha), width: 0 },
    ]),
  ];
};
const rock2 = (row, c, family, alpha = 1, group = 'stable') => {
  const s = shape({ rule: row.rule, values: row.values }, group === 'off' ? 'plain' : c.pr, family);
  const body = s.body.filter((p) => !(p.fill && p.points.length === 12) && !(!p.fill && p.points.length === 4));
  const context = alpha ? [...halo(c, alpha), ...body, ...craters(c, family, alpha), ...alien(c, family, alpha)] : body;
  return { parts: [...context, ...s.marks], context };
};

const OCC = (level, i, mode = 'standard') => `observations:${level}:${mode}:${i}`;
const current = (w, occurrence) => {
  const objs = presentObjects(deck, w, occurrence), g = grid(objs.length);
  return objs.map((o, slot) => ({ row: byId.get(w.ids[o.sourceIndex]), source: o.sourceIndex, parts: [...o.shape.body, ...o.shape.marks], context: o.shape.body, scale: 1, pos: g.at(slot), R: g.R, family: o.shape.family }));
};
const mineralOf = (prs) => {
  const used = new Set(), out = new Map();
  for (const pr of [...new Set(prs)].sort()) {
    let k = hash(pr) % families.length;
    while (used.has(k)) k = (k + 1) % families.length;
    used.add(k);
    out.set(pr, families[k]);
  }
  return out;
};
const relative = (c) => (c.known ? { ...c, n: 60, impacts: c.rel.impacts === 'first' ? 0 : c.rel.impacts, agent: c.rel.agent === 'first' ? 0 : c.rel.agent, lastHuman: false } : c);
const proposed = (w, alpha = 1, group = 'stable', by = 'hash', mode = 'absolute') => {
  const rs = w.ids.map((id, source) => ({ row: byId.get(id), source })), minerals = mineralOf(rs.map((x) => C(x.row).pr));
  const order = by === 'time' ? [...rs].sort((a, b) => C(a.row).t - C(b.row).t) : [...rs].sort((a, b) => hash(a.row.id) - hash(b.row.id)), g = grid(rs.length);
  return order.map((x, slot) => {
    const family = group === 'off' ? 'basalt' : minerals.get(C(x.row).pr), c = mode === 'relative' ? relative(C(x.row)) : C(x.row);
    return { ...x, ...rock2(x.row, c, family, alpha, group), scale: sizeOf(c, alpha), pos: g.at(slot), R: g.R, family, group: C(x.row).pr, c };
  });
};

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const canvas = (w, h, bg = FIELD) => { const px = new Uint8Array(w * h * 3), c = rgbOf(bg); for (let i = 0; i < w * h; i++) px.set(c, i * 3); return { w, h, px }; };
const fill = (cv, pts, rgb) => {
  const ys = pts.map((p) => p[1]), y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(cv.h - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5, xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if (ay > yc !== by > yc) xs.push(ax + ((yc - ay) * (bx - ax)) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(cv.w - 1, Math.floor(xs[k + 1] - 0.5)); x++) cv.px.set(rgb, (y * cv.w + x) * 3);
  }
};
const stroke = (cv, pts, width, rgb) => {
  const h = Math.max(0.5, width / 2);
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], l = Math.hypot(bx - ax, by - ay) || 1, nx = (-(by - ay) / l) * h, ny = ((bx - ax) / l) * h;
    fill(cv, [[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]], rgb);
  }
  for (const p of pts) fill(cv, circle(p, h, 8), rgb);
};
const paint = (cv, parts, cx, cy, R) => {
  for (const p of parts) {
    const pts = p.points.map(([x, y]) => [cx + x * R, cy + y * R]);
    if (p.fill) fill(cv, pts, rgbOf(colors[p.fill] ?? p.fill));
    if (p.stroke) stroke(cv, p.fill ? [...pts, pts[0]] : pts, Math.max(0.85, p.width * R), rgbOf(colors[p.stroke] ?? p.stroke));
  }
};
const N = 64;
const picture = (rock) => { const cv = canvas(N, N); paint(cv, rock.parts, N / 2, N / 2, (N / 2) * rock.scale); return cv; };
const features = (cv) => {
  const bg = rgbOf(FIELD), hist = new Float64Array(64), light = rgbOf(colors.light);
  let area = 0, off = 0, holes = 0;
  for (let y = 0; y < cv.h; y++) for (let x = 0; x < cv.w; x++) {
    const i = (y * cv.w + x) * 3, r = cv.px[i], g = cv.px[i + 1], b = cv.px[i + 2], j = (y * cv.w + (cv.w - 1 - x)) * 3;
    if (r === bg[0] && g === bg[1] && b === bg[2]) continue;
    area++;
    hist[(r >> 6) * 16 + (g >> 6) * 4 + (b >> 6)]++;
    off += +(cv.px[j] !== r || cv.px[j + 1] !== g || cv.px[j + 2] !== b);
    holes += +(r === light[0] && g === light[1] && b === light[2]);
  }
  return { hist: [...hist].map((v) => v / (N * N)), area: area / (N * N), lop: area ? off / area : 0, holes, px: cv.px };
};
const dHist = (a, b) => a.hist.reduce((s, v, i) => s + Math.abs(v - b.hist[i]), 0);
const dPix = (a, b) => { let s = 0; for (let i = 0; i < a.px.length; i++) s += Math.abs(a.px[i] - b.px[i]); return s / (a.px.length * 255); };

const argmax = (xs) => xs.indexOf(Math.max(...xs));
const spearman = (a, b) => {
  const rank = (xs) => { const o = xs.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]), r = Array(xs.length); for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2; i = j + 1; } return r; };
  const ra = rank(a), rb = rank(b), m = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length, ma = m(ra), mb = m(rb);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < ra.length; i++) { num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : 0;
};
const tSpan = Math.max(...[...ctx.values()].map((c) => c.t)) - Math.min(...[...ctx.values()].map((c) => c.t));
const NUM = { n: [(c) => Math.log2(1 + c.n), Math.log2(61)], share: [(c) => c.share, 1], criteria: [(c) => c.criteria, 5], locks: [(c) => c.locks, 4], impacts: [(c) => c.impacts, 3], agent: [(c) => c.agent, 3], human: [(c) => c.human, 7], t: [(c) => c.t, tSpan] };
const gower = (a, b) => {
  const ca = C(a), cb = C(b), parts = [+(params(a).pattern !== params(b).pattern), +(ca.job !== cb.job), +(ca.pr !== cb.pr)];
  for (const [k, [f, range]] of Object.entries(NUM)) if (['n', 'share', 'criteria', 't'].includes(k) || (ca.known && cb.known)) parts.push(Math.min(1, Math.abs(f(ca) - f(cb)) / range));
  if (ca.known && cb.known) parts.push(+(ca.lastHuman !== cb.lastHuman));
  return parts.reduce((s, x) => s + x, 0) / parts.length;
};
const contextGap = (a, b) => {
  const ca = C(a), cb = C(b), parts = [+(ca.job !== cb.job), +(ca.pr !== cb.pr)];
  for (const [k, [f, range]] of Object.entries(NUM)) if (['n', 'share', 'criteria', 't'].includes(k) || (ca.known && cb.known)) parts.push(Math.min(1, Math.abs(f(ca) - f(cb)) / range));
  return parts.reduce((s, x) => s + x, 0) / parts.length;
};

const evaluate = (scenes) => {
  const items = scenes.map((s) => ({ ...s, rocks: s.rocks.map((r) => ({ ...r, f: features(picture(r)), g: features(picture({ ...r, parts: r.context })) })) }));
  const pairs = items.flatMap((s) => s.rocks.flatMap((a, i) => s.rocks.slice(i + 1).map((b) => [a, b])));
  const sd = (xs) => { const m = xs.reduce((s, x) => s + x, 0) / xs.length; return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length) || 1; };
  const preOf = (k) => {
    const sH = sd(pairs.map(([a, b]) => dHist(a[k], b[k]))), sA = sd(pairs.map(([a, b]) => Math.abs(a[k].area - b[k].area))), sL = sd(pairs.map(([a, b]) => Math.abs(a[k].lop - b[k].lop)));
    return (a, b) => dHist(a[k], b[k]) / sH + Math.abs(a[k].area - b[k].area) / sA + Math.abs(a[k].lop - b[k].lop) / sL;
  };
  const pre = preOf('f'), preCtx = preOf('g');
  const per = items.map((s) => {
    const gap = s.rocks.findIndex((r) => r.row.gap), sal = (d) => s.rocks.map((a, i) => s.rocks.reduce((t, b, j) => (i === j ? t : t + d(a, b)), 0) / (s.rocks.length - 1));
    const rankOf = (xs) => 1 + xs.filter((x) => x > xs[gap] + 1e-12).length + (xs.filter((x) => Math.abs(x - xs[gap]) <= 1e-12).length - 1) / 2;
    const holes = s.rocks.map((r) => r.f.holes), lops = s.rocks.map((r) => r.f.lop);
    const hit = (xs) => { const top = Math.max(...xs), ties = xs.filter((x) => x >= top - 1e-9 * Math.max(1, Math.abs(top))).length; return xs[gap] >= top - 1e-9 * Math.max(1, Math.abs(top)) ? 1 / ties : 0; };
    const preS = sal(pre), pixS = sal((a, b) => dPix(a.f, b.f));
    return { ...s, n: s.rocks.length, gap, pre: hit(preS), preRank: rankOf(preS), pix: hit(pixS), pixRank: rankOf(pixS), rule: Math.max(...holes) > 0 ? hit(holes) : hit(lops), ctx: hit(sal(preCtx)), first: +(gap === 0), last: +(gap === s.rocks.length - 1) };
  });
  const rsa = (dist) => {
    const d = pairs.map(([a, b]) => gower(a.row, b.row)), v = pairs.map(dist), rho = spearman(d, v), r = rng(11);
    let hits = 0;
    const PERM = 499;
    for (let k = 0; k < PERM; k++) {
      const pp = items.flatMap((s) => { const sh = shuffle(r, s.rocks.map((x) => x.row)), rs = s.rocks.map((x, i) => ({ ...x, row: sh[i] })); return rs.flatMap((a, i) => rs.slice(i + 1).map((b) => [a, b])); });
      hits += +(spearman(pp.map(([a, b]) => gower(a.row, b.row)), v) >= rho);
    }
    return { rho, p: (hits + 1) / (PERM + 1) };
  };
  const parts = items.flatMap((s) => s.rocks.map((r) => r.parts.length)), hues = items.flatMap((s) => s.rocks.map((r) => new Set(r.parts.flatMap((p) => [p.fill, p.stroke]).filter(Boolean)).size));
  const bytes = items.flatMap((s) => s.rocks.map((r) => deflateSync(Buffer.from(r.f.px), { level: 9 }).length));
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return {
    waves: per.length, chance: mean(per.map((p) => 1 / p.n)), pre: mean(per.map((p) => p.pre)), preMRR: mean(per.map((p) => 1 / p.preRank)), pix: mean(per.map((p) => p.pix)), pixMRR: mean(per.map((p) => 1 / p.pixRank)), rule: mean(per.map((p) => p.rule)),
    ctx: mean(per.map((p) => p.ctx)), first: mean(per.map((p) => p.first)), last: mean(per.map((p) => p.last)),
    rsaLook: rsa(([a, b]) => pre(a, b)), rsaPlace: rsa(([a, b]) => Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1])),
    parts: mean(parts), hues: mean(hues), bytes: mean(bytes), per,
  };
};

const levels = deck.levels.map((l) => ({ level: l.id, rule: l.start.rule, specs: l.sequence.map((spec, i) => ({ spec, i, w: wave(deck, spec), step: spec.step })) }));
if (process.argv.includes('--self-test')) {
  const assert = (await import('node:assert/strict')).default;
  assert.equal(spearman([1, 2, 3, 4], [2, 4, 6, 9]), 1);
  assert.equal(spearman([1, 2, 3], [3, 2, 1]), -1);
  assert.equal(MI(['x', 'y', 'x', 'z'], ['x', 'y', 'x', 'z']), H(['x', 'y', 'x', 'z']));
  for (const { specs } of levels) {
    const { w } = specs[0], same = (a, b) => assert.deepEqual(a.map((r) => [r.row.id, r.parts, r.pos]), b.map((r) => [r.row.id, r.parts, r.pos]));
    same(proposed(w), proposed(w));
    same(proposed(w), proposed({ ...w, answers: [] }));
    same(proposed(w, 1, 'stable', 'hash', 'relative'), proposed({ ...w, answers: [(w.answers[0] + 1) % w.ids.length] }, 1, 'stable', 'hash', 'relative'));
  }
  const busy = { known: true, pr: 'self', n: 30, share: 0.6, job: 'failure', locks: 3, impacts: 5, agent: 3, lastHuman: true };
  for (const k of [1, 2, 3, 4, 5, 6]) assert.equal(features(picture({ parts: rock2({ rule: 'odd_revision', values: ['a1b2c3d', 'a1b2c3d'] }, { ...busy, impacts: k }, 'ice').parts, scale: 1 })).lop, 0);
  assert.ok(features(picture({ parts: rock2({ rule: 'odd_revision', values: ['a1b2c3d', '9f8e7d6'] }, busy, 'ice').parts, scale: 1 })).lop > 0.02);
  console.log('self-test ok');
  process.exit(0);
}
const scenesOf = (design) => levels.flatMap(({ level, specs }) => specs.map(({ w, i, step }) => ({ level, i, step, rocks: design === 'current' ? current(w, OCC(level, i)) : proposed(w) })));
const results = Object.fromEntries(['current', 'proposed'].map((d) => [d, Object.fromEntries(levels.map(({ level }) => [level, evaluate(scenesOf(d).filter((s) => s.level === level))]))]));

const noise = (design) => levels.map(({ level, specs }) => {
  const seen = new Map();
  for (const { w, i } of specs) for (const r of design === 'current' ? current(w, OCC(level, i)) : proposed(w)) seen.set(r.row.id, [...(seen.get(r.row.id) || []), { ...r, f: features(picture(r)) }]);
  const same = [...seen.values()].flatMap((list) => list.flatMap((a, i) => list.slice(i + 1).map((b) => dPix(a.f, b.f))));
  const firsts = [...seen.values()].map((list) => list[0]), diff = firsts.flatMap((a, i) => firsts.slice(i + 1).map((b) => dPix(a.f, b.f)));
  const moved = specs.flatMap(({ w, i }) => {
    const a = design === 'current' ? current(w, OCC(level, i)) : proposed(w), b = design === 'current' ? current(w, OCC(level, i, 'adaptive')) : proposed(w);
    return a.map((x) => { const y = b.find((z) => z.source === x.source); return Math.hypot(x.pos[0] - y.pos[0], x.pos[1] - y.pos[1]) / (2 * x.R); });
  });
  const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  return { level, repeated: [...seen.values()].filter((l) => l.length > 1).length, same: mean(same), diff: mean(diff), ratio: mean(same) / mean(diff), moved: mean(moved) };
});
const noiseResults = { current: noise('current'), proposed: noise('proposed') };

const COUNTS = [4, 5, 6, 6, 7];
const rebuilt = levels.map(({ level, rule, specs }) => ({
  level, specs: specs.map(({ w, i, step }) => {
    const gap = byId.get(w.ids[w.answers[0]]), from = rows.filter((x) => x.rule === rule && x.research === gap.research && !x.gap && x.run !== gap.run);
    const sorted = [...from].sort((a, b) => contextGap(gap, a) - contextGap(gap, b) || a.id.localeCompare(b.id)), uniq = [];
    for (const x of sorted) if (!uniq.some((u) => u.run === x.run)) uniq.push(x);
    const k = COUNTS[step - 1] - 1, offset = Math.round(((step - 1) / 4) * Math.max(0, uniq.length - k)), controls = uniq.slice(offset, offset + k);
    const ids = [gap, ...controls].sort((a, b) => C(a).t - C(b).t).map((x) => x.id);
    return { i, step, w: { ...w, ids, answers: [ids.indexOf(gap.id)], symbols: ids.map(String) } };
  }),
}));
const rebuiltResults = Object.fromEntries(rebuilt.map(({ level, specs }) => [level, evaluate(specs.map(({ w, i, step }) => ({ level, i, step, rocks: proposed(w) })))]));
const ALPHAS = [0, 0.25, 0.5, 1], GROUPS = ['off', 'stable'], BUILDERS = ['current waves', 'context-ordered waves'];
const sweep = GROUPS.flatMap((group) => ALPHAS.flatMap((alpha) => BUILDERS.map((builder) => ({
  group, alpha, builder, mode: 'absolute', by: Object.fromEntries(levels.map(({ level, specs }, k) => [level, evaluate((builder === BUILDERS[0] ? specs : rebuilt[k].specs).map(({ w, i, step }) => ({ level, i, step, rocks: proposed(w, alpha, group) })))])),
})))).concat([['off', 1], ['stable', 0.5], ['stable', 1]].flatMap(([group, alpha]) => BUILDERS.map((builder) => ({
  group, alpha, builder, mode: 'relative', by: Object.fromEntries(levels.map(({ level, specs }, k) => [level, evaluate((builder === BUILDERS[0] ? specs : rebuilt[k].specs).map(({ w, i, step }) => ({ level, i, step, rocks: proposed(w, alpha, group, 'hash', 'relative') })))])),
}))));
const timed = Object.fromEntries(levels.map(({ level, specs }) => [level, evaluate(specs.map(({ w, i, step }) => ({ level, i, step, rocks: proposed(w, 1, 'stable', 'time') })))]));
const X = (r) => r.c ?? C(r.row);
const CHANNELS = {
  mineral: (r) => r.family, 'halo rings': (r) => (X(r).known ? Math.min(3, X(r).locks) : '?'), 'halo colour': (r) => (X(r).known && X(r).locks ? X(r).job : 'none'),
  'halo arc': (r) => (X(r).known && X(r).locks ? Math.min(3, Math.floor(X(r).share * 4)) : 'none'), craters: (r) => (X(r).known ? Math.min(6, X(r).impacts) : '?'),
  'alien eyes': (r) => (X(r).known ? Math.min(3, X(r).agent) : '?'), 'alien colour': (r) => (X(r).known && X(r).agent ? X(r).lastHuman : 'none'), 'size bin': (r) => Math.round(Math.log2(1 + X(r).n)),
};
const channelLeak = (design, drawn) => levels.map(({ level, specs }) => {
  const seen = new Map();
  for (const { w, i } of specs) for (const r of design(w, level, i)) if (!seen.has(r.row.id)) seen.set(r.row.id, r);
  const rocks = [...seen.values()];
  return { level, channels: Object.fromEntries(Object.entries(CHANNELS).map(([k, f]) => [k, drawn.includes(k) ? leak(rocks.map((r) => String(f(r))), rocks.map((r) => String(r.row.gap))) : null])) };
});
const leaks = { proposed: channelLeak((w) => proposed(w), Object.keys(CHANNELS)), 'proposed, relative': channelLeak((w) => proposed(w, 1, 'stable', 'hash', 'relative'), ['mineral', 'halo rings', 'halo colour', 'halo arc', 'craters', 'alien eyes']), current: channelLeak((w, level, i) => current(w, OCC(level, i)), ['mineral']) };
const meanOf = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const admissible = (e) => levels.every(({ level }) => e.by[level].rule === 1 && e.by[level].pre >= results.current[level].pre && e.by[level].ctx <= e.by[level].chance + 0.1);
const chosen = sweep.filter(admissible).sort((a, b) => meanOf(levels.map(({ level }) => b.by[level].rsaLook.rho)) - meanOf(levels.map(({ level }) => a.by[level].rsaLook.rho)))[0] ?? null;
const heterogeneity = (scene) => { const rs = scene.rocks.map((r) => r.row); const ps = rs.flatMap((a, i) => rs.slice(i + 1).map((b) => contextGap(a, b))); return ps.reduce((s, x) => s + x, 0) / ps.length; };

const byStep = (per, key) => [1, 2, 3, 4, 5].map((k) => { const xs = per.filter((p) => p.step === k && p.i < 20); return xs.length ? xs.reduce((s, p) => s + p[key], 0) / xs.length : null; });
const aiStep = levels.map(({ level, specs }) => [1, 2, 3, 4, 5].map((k) => {
  const xs = specs.filter((s) => s.step === k && s.i < 20).map((s) => ai[level][s.i]), ws = specs.filter((s) => s.step === k && s.i < 20).map((s) => s.w);
  return xs.reduce((t, p, j) => t + +(typeof p === 'number' && ws[j].answers.includes(p)), 0) / xs.length;
}));

const gapUse = levels.map(({ level, specs }) => {
  const scored = specs.filter((s) => s.i < 20).map((s) => s.w.ids[s.w.answers[0]]), m = new Map();
  for (const id of scored) m.set(id, (m.get(id) || 0) + 1);
  return { level, distinct: m.size, max: Math.max(...m.values()) };
});
const prsPerWave = levels.map(({ level, specs }) => {
  const xs = specs.map((s) => new Set(s.w.ids.map((id) => C(byId.get(id)).pr)).size / s.w.ids.length);
  return { level, share: xs.reduce((s, x) => s + x, 0) / xs.length };
});
const obs = read('observations.jsonl').trim().split('\n').map((l) => JSON.parse(l));
const fix94 = snaps['serio-focus'].prs['94']?.merged_at ?? null;
const caseDate = new Map(cases.map((c) => [c.case, c.date]));
const oddAfter = fix94 && obs.filter((o) => o.relation === 'odd_revision' && o.flags.visibility === 'public' && o.gap).map((o) => caseDate.get(o.case)).filter((d) => d > fix94.slice(0, 10)).length;
const oddGaps = obs.filter((o) => o.relation === 'odd_revision' && o.flags.visibility === 'public' && o.gap).length;
const publicGates = cases.filter((c) => c.kind === 'gate' && c.visibility === 'public');
const days = new Set(publicGates.map((c) => c.date)).size;
const growth = {
    publicGateRecords: gateRecords.length, publicGateCases: publicGates.length, days, perDay: publicGates.length / days,
  gapsPerRule: Object.fromEntries(['odd_revision', 'missing_link', 'pair', 'lock_only'].map((r) => [r, obs.filter((o) => o.relation === r && o.flags.visibility === 'public' && o.gap).length])),
  junitCases: gateRecords.reduce((s, g) => s + (g.cases?.length || 0), 0), fix94, oddGaps, oddAfter,
  modelRunsLinked: publicGates.filter((g) => cases.some((r) => r.kind === 'run' && r.repo === g.repo && r.pr === g.pr)).length,
  contextKnown: [...ctx.values()].filter((c) => c.known).length, runs: ctx.size,
};

const png = (cv) => {
  const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type, 'ascii'), data]), out = Buffer.alloc(body.length + 8); out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc32(body), body.length + 4); return out; };
  const raw = Buffer.alloc((cv.w * 3 + 1) * cv.h);
  for (let y = 0; y < cv.h; y++) Buffer.from(cv.px.buffer, y * cv.w * 3, cv.w * 3).copy(raw, y * (cv.w * 3 + 1) + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0); ihdr.writeUInt32BE(cv.h, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
};
const down = (cv) => {
  const out = canvas(cv.w / 2, cv.h / 2);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) for (let k = 0; k < 3; k++) {
    const a = (2 * y * cv.w + 2 * x) * 3 + k;
    out.px[(y * out.w + x) * 3 + k] = (cv.px[a] + cv.px[a + 3] + cv.px[a + cv.w * 3] + cv.px[a + cv.w * 3 + 3]) / 4;
  }
  return out;
};
const blit = (dst, src, ox, oy) => { for (let y = 0; y < src.h; y++) dst.px.set(src.px.subarray(y * src.w * 3, (y + 1) * src.w * 3), ((oy + y) * dst.w + ox) * 3); };
const LAYERS = [[60, 1, '#4a423a'], [35, 1.5, '#8a7f72'], [15, 2, '#e8dfd2']];
const scene = (rocks, trail) => {
  const S = 2, cv = canvas(W * S, HH * S);
  LAYERS.forEach(([n, size, c], i) => { const r = rng(101 + i); for (let k = 0; k < n; k++) { const x = r() * W, y = r() * HH; fill(cv, [[x * S, y * S], [(x + size) * S, y * S], [(x + size) * S, (y + size) * S], [x * S, (y + size) * S]], rgbOf(c)); } });
  if (trail) for (let i = 0; i + 1 < rocks.length; i++) if (rocks[i].group === rocks[i + 1].group) stroke(cv, [rocks[i].pos.map((v) => v * S), rocks[i + 1].pos.map((v) => v * S)], 1.5 * S, rgbOf('#4a423a'));
  for (const r of rocks) paint(cv, r.parts, r.pos[0] * S, r.pos[1] * S, r.R * r.scale * S);
  const sx = (W / 2) * S, sy = (HH - BAND / 2) * S, k = 1.4 * S, T = (pts) => pts.map(([x, y]) => [sx + x * k, sy + y * k]);
  fill(cv, T([[-4, 9], [4, 9], [0, 21]]), rgbOf('#fdfbf7'));
  fill(cv, T([[0, -18], [16, 14], [0, 8], [-16, 14]]), rgbOf('#a84b32'));
  fill(cv, T(oval([0, 0], 3.5, 6, 0, 16)), rgbOf('#fdfbf7'));
  return down(cv);
};
const OUT = fileURLToPath(new URL('./results/', import.meta.url));
mkdirSync(OUT, { recursive: true });
for (const { level, specs } of levels) {
  const pick = [0, 16].map((i) => specs[i]), sheet = canvas(W * 3 + 16, HH * pick.length + 8 * (pick.length - 1), '#fdfbf7');
  pick.forEach(({ w, i }, k) => { blit(sheet, scene(current(w, OCC(level, i)), false), 0, k * (HH + 8)); blit(sheet, scene(proposed(w, 0, 'off'), false), W + 8, k * (HH + 8)); blit(sheet, scene(proposed(w, 1, 'stable', 'hash', 'relative'), false), 2 * (W + 8), k * (HH + 8)); });
  writeFileSync(join(OUT, `level-${level}.png`), png(sheet));
}
const STRENGTHS = [['off', 0], ['stable', 0], ['stable', 0.25], ['stable', 0.5], ['stable', 1]];
const salience = canvas(STRENGTHS.length * (W / 2 + 8) - 8, HH / 2, '#fdfbf7');
STRENGTHS.forEach(([group, alpha], k) => blit(salience, down(scene(proposed(levels[1].specs[16].w, alpha, group), false)), k * (W / 2 + 8), 0));
writeFileSync(join(OUT, 'salience.png'), png(salience));
const tile = (parts, scale = 1) => { const S = 2, cv = canvas(240 * S, 240 * S); paint(cv, parts, 120 * S, 120 * S, 112 * scale * S); return down(cv); };
const legendRow = (list) => list.map(([c, n]) => tile(rock2({ rule: 'odd_revision', values: ['a1b2c3d', 'a1b2c3d'] }, { known: true, pr: 'legend', n: 16, share: 1, job: 'success', locks: 0, impacts: 0, agent: 0, lastHuman: false, ...c }, 'ice').parts, sizeOf({ n: n ?? 16 })));
const legend = [
  legendRow([[{ n: 0 }, 0], [{ n: 4 }, 4], [{ n: 16 }, 16], [{ n: 58 }, 58]]),
  legendRow([[{ locks: 1 }], [{ locks: 2 }], [{ locks: 3, share: 0.6 }], [{ locks: 1, job: 'failure', share: 0.3 }]]),
  legendRow([[{ impacts: 1 }], [{ impacts: 2 }], [{ impacts: 3 }], [{ impacts: 5 }]]),
  legendRow([[{ agent: 1 }], [{ agent: 2 }], [{ agent: 3 }], [{ agent: 2, lastHuman: true }]]),
];
const legendSheet = canvas(4 * 240 + 3 * 6, 4 * 240 + 3 * 6, '#fdfbf7');
legend.forEach((row, y) => row.forEach((t, x) => blit(legendSheet, t, x * 246, y * 246)));
writeFileSync(join(OUT, 'legend.png'), png(legendSheet));
const reps = levels.flatMap(({ level, specs }) => specs.flatMap(({ w, i }) => current(w, OCC(level, i)).map((r) => ({ level, i, w, r }))));
const counts = new Map();
for (const x of reps) counts.set(x.r.row.id, [...(counts.get(x.r.row.id) || []), x]);
const most = [...counts.values()].filter((l) => l[0].r.row.gap).sort((a, b) => b.length - a.length)[0].slice(0, 6);
const strip = canvas(most.length * 246 - 6, 2 * 246 - 6, '#fdfbf7');
most.forEach(({ r, w }, x) => { blit(strip, tile(r.parts), x * 246, 0); const p = proposed(w, 1, 'stable', 'hash', 'relative').find((z) => z.row.id === r.row.id); blit(strip, tile(p.parts, p.scale), x * 246, 246); });
writeFileSync(join(OUT, 'same-run.png'), png(strip));

const pct = (x) => (x === null ? '—' : `${Math.round(x * 100)}%`);
const f2 = (x) => x.toFixed(2);
const lines = [];
const out = (s = '') => lines.push(s);
out('## A. Field audit: entropy and gap leakage (adjusted mutual information, 2000 permutations; p < 0.05 marked *)');
out('| Field | Distinct | H bits | odd_revision | missing_link | pair |');
out('|---|---|---|---|---|---|');
for (const a of audit) out(`| ${a.name} | ${a.distinct} | ${f2(a.H)} | ${a.rules.map((r) => `${f2(r.ami)}${r.p < 0.05 ? '*' : ''}`).join(' | ')} |`);
out();
out('## B. Observers on the 63 waves of the three levels');
out('| Level | Design | Chance | Pre-attentive | MRR | Pixel | MRR | Rule reader | Look vs data ρ (p) | Place vs data ρ (p) | Parts/rock | Colours/rock | Bytes/rock |');
out('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const d of ['current', 'proposed']) for (const { level } of levels) {
  const r = results[d][level];
  out(`| ${level} | ${d} | ${pct(r.chance)} | ${pct(r.pre)} | ${f2(r.preMRR)} | ${pct(r.pix)} | ${f2(r.pixMRR)} | ${pct(r.rule)} | ${f2(r.rsaLook.rho)} (${f2(r.rsaLook.p)}) | ${f2(r.rsaPlace.rho)} (${f2(r.rsaPlace.p)}) | ${r.parts.toFixed(0)} | ${r.hues.toFixed(1)} | ${r.bytes.toFixed(0)} |`);
}
out();
out('## C. Noise: the same run drawn in different waves');
out('| Level | Design | Runs seen twice+ | Same run, pixel distance | Different runs, pixel distance | Noise ratio | Position change, cells (standard vs adaptive) |');
out('|---|---|---|---|---|---|---|');
for (const d of ['current', 'proposed']) for (const n of noiseResults[d]) out(`| ${n.level} | ${d} | ${n.repeated} | ${n.same.toFixed(3)} | ${n.diff.toFixed(3)} | ${f2(n.ratio)} | ${f2(n.moved)} |`);
out();
out('## D. Difficulty by step (scored waves 1-20; four waves per step)');
out('| Level | Measure | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 |');
out('|---|---|---|---|---|---|---|');
for (const { level } of levels) {
  out(`| ${level} | chance | ${byStep(results.current[level].per.map((p) => ({ ...p, c: 1 / p.n })), 'c').map(pct).join(' | ')} |`);
  out(`| ${level} | AI stored run | ${aiStep[level - 1].map(pct).join(' | ')} |`);
  out(`| ${level} | pre-attentive, current | ${byStep(results.current[level].per, 'pre').map(pct).join(' | ')} |`);
  out(`| ${level} | pre-attentive, proposed look | ${byStep(results.proposed[level].per, 'pre').map(pct).join(' | ')} |`);
  out(`| ${level} | pre-attentive, proposed look + context-ordered controls | ${byStep(rebuiltResults[level].per, 'pre').map(pct).join(' | ')} |`);
  out(`| ${level} | context spread, current waves | ${byStep(scenesOf('current').filter((s) => s.level === level).map((s) => ({ ...s, h: heterogeneity(s) })), 'h').map((x) => f2(x)).join(' | ')} |`);
  out(`| ${level} | context spread, context-ordered | ${byStep(rebuilt[level - 1].specs.map(({ w, i, step }) => ({ i, step, h: heterogeneity({ rocks: proposed(w) }) })), 'h').map((x) => f2(x)).join(' | ')} |`);
}
out();
out('## E. Context-ordered controls, all 21 waves');
out('| Level | Pre-attentive | MRR | Pixel | Rule reader | Look vs data ρ (p) |');
out('|---|---|---|---|---|---|');
for (const { level } of levels) { const r = rebuiltResults[level]; out(`| ${level} | ${pct(r.pre)} | ${f2(r.preMRR)} | ${pct(r.pix)} | ${pct(r.rule)} | ${f2(r.rsaLook.rho)} (${f2(r.rsaLook.p)}) |`); }
out();
out('## G. Salience sweep: group encoding (mineral and outline per pull request) x context strength α (halo, craters, alien, size)');
out('| Context | Group | α | Waves | Pre-attentive L1/L2/L3 | Context-only L1/L2/L3 | Rule reader L1/L2/L3 | Look vs data ρ L1/L2/L3 | Bytes/rock | Admissible |');
out('|---|---|---|---|---|---|---|---|---|---|');
for (const e of sweep) {
  const v = (k) => levels.map(({ level }) => pct(e.by[level][k])).join(' / ');
  out(`| ${e.mode} | ${e.group} | ${e.alpha} | ${e.builder} | ${v('pre')} | ${v('ctx')} | ${v('rule')} | ${levels.map(({ level }) => f2(e.by[level].rsaLook.rho)).join(' / ')} | ${meanOf(levels.map(({ level }) => e.by[level].bytes)).toFixed(0)} | ${admissible(e) ? 'yes' : 'no'} |`);
}
out(`- Current design for reference: pre-attentive ${levels.map(({ level }) => pct(results.current[level].pre)).join(' / ')}, context-only ${levels.map(({ level }) => pct(results.current[level].ctx)).join(' / ')}, look vs data ρ ${levels.map(({ level }) => f2(results.current[level].rsaLook.rho)).join(' / ')}, bytes/rock ${meanOf(levels.map(({ level }) => results.current[level].bytes)).toFixed(0)}.`);
out(`- Rule: highest mean ρ with rule reader 100%, pre-attentive not below the current design and context-only within 10 points of chance on every level. Chosen: ${chosen ? `${chosen.mode} context, group ${chosen.group}, α ${chosen.alpha}, ${chosen.builder}` : 'none'}.`);
out();
out('## H. Placement: where the gap lands and how place follows data');
out('| Level | Layout | Chance | Gap first | Gap last | Place vs data ρ (p) |');
out('|---|---|---|---|---|---|');
for (const { level } of levels) for (const [name, r] of [['current, shuffled grid', results.current[level]], ['proposed, neutral order (content hash)', results.proposed[level]], ['proposed, time order', timed[level]]]) out(`| ${level} | ${name} | ${pct(r.chance)} | ${pct(r.first)} | ${pct(r.last)} | ${f2(r.rsaPlace.rho)} (${f2(r.rsaPlace.p)}) |`);
out();
out('## I. Learnable leaks: does a drawn channel predict the gap? (each run once per level; adjusted mutual information; * p < 0.05; — not drawn)');
out(`| Design | Level | ${Object.keys(CHANNELS).join(' | ')} |`);
out(`|---|---|${Object.keys(CHANNELS).map(() => '---').join('|')}|`);
for (const [name, list] of Object.entries(leaks)) for (const { level, channels } of list) out(`| ${name} | ${level} | ${Object.values(channels).map((r) => (r ? `${f2(r.ami)}${r.p < 0.05 ? '*' : ''}` : '—')).join(' | ')} |`);
out();
out('## F. Data volume');
out(`- Public gate records: ${growth.publicGateRecords}; public gate cases: ${growth.publicGateCases} over ${growth.days} days (${growth.perDay.toFixed(1)} per day).`);
out(`- Public gap rows per relation: ${Object.entries(growth.gapsPerRule).map(([k, v]) => `${k} ${v}`).join(', ')}. JUnit case results in public gate records: ${growth.junitCases}.`);
out(`- odd_revision gaps after serio-focus#94 merged (${growth.fix94}): ${growth.oddAfter} of ${growth.oddGaps}.`);
out(`- Public gate cases whose pull request has a model-run record: ${growth.modelRunsLinked} of ${growth.publicGateCases}. Game runs with pull-request context at T: ${growth.contextKnown} of ${growth.runs}.`);
out(`- Distinct gap rows in the 20 scored waves: ${gapUse.map((g) => `level ${g.level} ${g.distinct} (max ${g.max} uses)`).join(', ')}.`);
out(`- Share of distinct pull requests per wave: ${prsPerWave.map((p) => `level ${p.level} ${pct(p.share)}`).join(', ')}.`);
const report = lines.join('\n');
writeFileSync(join(OUT, 'report.md'), `${report}\n`);
console.log(report);
