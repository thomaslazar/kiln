import test from 'node:test';
import assert from 'node:assert/strict';
import { chapterTheme, SYMBOLS, symbolSVG, hueGap, safeTile, monoTile, patternPos, patternColour } from '../src/theme.js';

const ALIKE = [['circle', 'ring'], ['circle', 'hexagon'], ['ring', 'hexagon'], ['drop', 'leaf']];
test('chapter 1 keeps today’s look', () => {
  const t = chapterTheme(1);
  assert.deepEqual(t.symbols, ['diamond', 'circle', 'triangle', 'star', 'hexagon']);
  assert.equal(t.style, 'matte'); assert.equal(t.light.bg, '#E4E8E1'); assert.equal(t.tiles.dark[4], '#8F6CB5');
});
test('generated chapters are deterministic and well formed', () => {
  for (let n = 2; n <= 200; n++) {
    const t = chapterTheme(n);
    assert.deepEqual(t, chapterTheme(n));
    assert.equal(new Set(t.symbols).size, 5); t.symbols.forEach(s => assert.ok(SYMBOLS[s], s));
    assert.ok(!ALIKE.some(([a, b]) => t.symbols.includes(a) && t.symbols.includes(b)), `${n}: ${t.symbols}`);
    assert.ok(['jewel', 'matte', 'line', 'duotone', 'glow'].includes(t.style));
    for (const k of ['light', 'dark']) { assert.equal(t.tiles[k].length, 5); assert.equal(t.gems[k].length, 5);
      for (const v of Object.values(t[k])) assert.equal(typeof v, 'string'); }
    for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) assert.ok(hueGap(t.gemHues[a], t.gemHues[b]) >= 70);
  }
  assert.equal(new Set([2, 3, 4, 5, 6, 7, 8, 9].map(n => chapterTheme(n).hue)).size > 4, true);
});
test('hue gap', () => { assert.equal(hueGap(350, 10), 20); assert.equal(hueGap(0, 180), 180); assert.equal(hueGap(90, 90), 0); });
test('a gem never sits on a similar tile', () => {
  for (let n = 1; n <= 120; n++) {
    const t = chapterTheme(n);
    for (let tile = 0; tile < 5; tile++) for (let gem = 0; gem < 5; gem++) {
      const s = safeTile(t, tile, gem), ok = [0, 1, 2, 3, 4].some(i => hueGap(t.tileHues[i], t.gemHues[gem]) >= 35);
      if (ok) assert.ok(hueGap(t.tileHues[s], t.gemHues[gem]) >= 35, `ch ${n} tile ${tile} gem ${gem}`);
      if (hueGap(t.tileHues[tile], t.gemHues[gem]) >= 35) assert.equal(s, tile);
    }
  }
  const c1 = chapterTheme(1); assert.notEqual(safeTile(c1, 4, 4), 4);   // purple tile under amethyst gem
});
test('one-colour pick avoids the goal’s gem hues', () => {
  for (let n = 1; n <= 120; n++) {
    const t = chapterTheme(n);
    for (const gems of [[0], [1, 3], [0, 2, 4], []]) {
      const m = monoTile(t, gems), ok = [0, 1, 2, 3, 4].some(i => gems.every(g => hueGap(t.tileHues[i], t.gemHues[g]) >= 35));
      assert.ok(m >= 0 && m <= 4); if (ok) assert.ok(gems.every(g => hueGap(t.tileHues[m], t.gemHues[g]) >= 35));
    }
  }
});
test('pattern positions and colours', () => {
  assert.equal(patternPos('rows', 0, 5), 0); assert.equal(patternPos('rows', 7, 0), 1);
  assert.equal(patternPos('columns', 3, 7), 1); assert.equal(patternPos('diagonal', 7, 7), 1);
  assert.equal(patternPos('rings', 3, 4), patternPos('rings', 4, 3)); assert.ok(patternPos('rings', 0, 0) === 1);
  const t = chapterTheme(9);
  assert.ok(patternColour(t, 'light', 0).includes(t.tiles.light[0]));
  assert.ok(patternColour(t, 'dark', 1).includes(t.tiles.dark[4]));
});
test('symbol SVGs for every style', () => {
  for (const style of ['jewel', 'matte', 'line', 'duotone', 'glow']) for (const s of Object.keys(SYMBOLS)) {
    const svg = symbolSVG(s, style, 'var(--gem1)', 'x1');
    assert.ok(svg.startsWith('<svg') && svg.includes(SYMBOLS[s]) && svg.includes('var(--gem1)'), `${style} ${s}`);
  }
  assert.equal(Object.keys(SYMBOLS).length, 13);
});
