/* w276pure.test.mjs: wave276's pure helpers (slot, unslot, hours, best). Evaluates build/src/276_wave276.seg in a
   sandbox with a stub window and document, then reads window.w276. Run: node --test test/w276pure.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '..', 'build', 'src', '276_wave276.seg'), 'utf8');

function load() {
  const el = () => ({ style: {}, appendChild() {}, setAttribute() {}, addEventListener() {}, classList: { contains: () => false, add() {}, remove() {}, toggle() {} } });
  const document = {
    head: el(), body: el(), documentElement: el(),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    createElement: el, addEventListener() {}
  };
  const window = { addEventListener() {} };
  const ctx = { window, document, location: { hash: '' }, console, setTimeout, clearTimeout };
  vm.runInNewContext(src, ctx);
  return window.w276;
}
const w = load();
const T = 1440, W = 2 * 1440, TH = 3 * 1440;
const members = [
  { email: 'a@x.org', name: 'A', slots: [T + 1020, T + 1050, T + 1080, W + 600, W + 630, TH + 540] },
  { email: 'b@x.org', name: 'B', slots: [T + 1020, T + 1050, T + 1080, W + 600, W + 630, TH + 540] },
  { email: 'c@x.org', name: 'C', slots: [T + 1020, T + 1050, T + 1080, TH + 540] }
];

test('slot and unslot', () => {
  assert.equal(w.slot(1, 1020), 2460);
  assert.deepEqual({ ...w.unslot(2460) }, { di: 1, min: 1020 });
});

test('hours', () => {
  assert.equal(w.hours([0, 30, 60], 30), 1.5);
  assert.equal(w.hours([], 30), 0);
});

test('best: Tuesday 17:00 to 18:30 first, Wednesday 10:00 to 11:00 next, no 30-minute window', () => {
  const r = w.best(members, 30, []);
  assert.equal(r.length, 2);
  assert.deepEqual([r[0].di, r[0].start, r[0].end, r[0].n], [1, 1020, 1110, 3]);
  assert.deepEqual([r[1].di, r[1].start, r[1].end, r[1].n], [2, 600, 660, 2]);
  assert.ok(!r.some(x => x.di === 3), 'the Thursday 30-minute window is excluded');
});

test('best: clashes break a headcount tie', () => {
  const two = [
    { email: 'a@x.org', slots: [T + 1020, T + 1050, W + 600, W + 630] },
    { email: 'b@x.org', slots: [T + 1020, T + 1050, W + 600, W + 630] }
  ];
  const r = w.best(two, 30, [{ email: 'a@x.org', slot: T + 1020 }]);
  assert.equal(r[0].di, 2);
  assert.equal(r[1].di, 1);
  assert.equal(r[1].clash, 1);
});
