'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { pack, countExtra, MaxRects } = require('../js/packer.js');

function overlaps(a, b) {
  return a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 &&
         a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
}

function assertValid(res, W, H) {
  for (const page of res.pages) {
    const ps = page.placements;
    for (const p of ps) {
      assert.ok(p.x >= -1e-6 && p.y >= -1e-6, 'inside bin');
      assert.ok(p.x + p.w <= W + 1e-6 && p.y + p.h <= H + 1e-6, 'inside bin');
      const dims = [p.item.w, p.item.h].sort().join();
      assert.strictEqual([p.w, p.h].sort().join(), dims, 'size preserved');
    }
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++)
        assert.ok(!overlaps(ps[i], ps[j]), 'no overlap');
  }
}

const items = (n, w, h) => Array.from({ length: n }, (_, i) => ({ id: `${w}x${h}-${i}`, w, h }));

test('four 4x6 prints fit on one 8x12 sheet', () => {
  const res = pack(items(4, 4, 6), 8, 12);
  assert.strictEqual(res.pages.length, 1);
  assert.strictEqual(res.pages[0].placements.length, 4);
  assertValid(res, 8, 12);
});

test('uses rotation when needed', () => {
  // 6x4 items on a 4-wide sheet must be rotated.
  const res = pack(items(2, 6, 4), 4, 12);
  assert.strictEqual(res.pages.length, 1);
  assert.ok(res.pages[0].placements.every(p => p.rotated));
  assertValid(res, 4, 12);
});

test('items too big are reported as unplaced', () => {
  const res = pack([{ w: 20, h: 20 }, { w: 2, h: 2 }], 10, 10);
  assert.strictEqual(res.unplaced.length, 1);
  assert.strictEqual(res.pages.length, 1);
});

test('mixed sizes on letter paper stay valid and all get placed', () => {
  const W = 8.5 - 0.4 + 0.1, H = 11 - 0.4 + 0.1; // margins + gap, in inches
  const list = [...items(3, 4.1, 6.1), ...items(2, 5.1, 7.1), ...items(8, 2.6, 3.6), ...items(4, 2.1, 2.1)];
  const res = pack(list, W, H);
  assertValid(res, W, H);
  const placed = res.pages.reduce((n, p) => n + p.placements.length, 0);
  assert.strictEqual(placed, list.length);
  const totalArea = list.reduce((a, i) => a + i.w * i.h, 0);
  assert.ok(res.pages.length <= Math.ceil(totalArea / (W * H)) + 1, 'near-optimal page count');
});

test('countExtra reports remaining room', () => {
  assert.strictEqual(countExtra(new MaxRects(8, 12), 4, 6), 4);
  const res = pack(items(2, 4, 6), 8, 12);
  assert.ok(countExtra(res.pages[0].bin, 4, 6) >= 1);
  assert.strictEqual(countExtra(res.pages[0].bin, 9, 9), 0);
});
