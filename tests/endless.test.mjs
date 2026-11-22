import test from 'node:test';
import assert from 'node:assert/strict';
import { startEndless, finishRun, validEndless, won, activeGems, solvable, occOf, resolveMove, SHAPES, SINGLE } from '../src/core.js';

test('a run starts empty at d 0.75 with a fair tray and no gems', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const E = startEndless(seed);
    assert.equal(E.type, 'endless'); assert.equal(E.d, 0.75);
    assert.ok(E.color.every(v => v === 0) && E.gem.every(v => v === 0));
    assert.ok(solvable(occOf(E.color), E.tray.map(p => p.s), 25000));
    assert.ok(E.tray.every(p => p.g.every(g => g === 0)));
    assert.ok(Number.isInteger(E.chapter) && E.chapter >= 1 && E.chapter <= 50);
    assert.ok(['normal', 'mono', 'pattern'].includes(E.look.mode));
    assert.equal(E.look.pattern === null, E.look.mode !== 'pattern');
    assert.equal(won(E), false); assert.deepEqual(activeGems(E), []);
  }
});
test('same seed, same run; bests carry over', () => {
  assert.deepEqual(startEndless(7), startEndless(7));
  const E = startEndless(8, 1234, 9); assert.equal(E.best, 1234); assert.equal(E.bestCombo, 9);
});
test('looks vary across runs', () => {
  const modes = new Set(), chapters = new Set();
  for (let s = 1; s <= 300; s++) { const E = startEndless(s); modes.add(E.look.mode); chapters.add(E.chapter); }
  assert.equal(modes.size, 3); assert.ok(chapters.size > 30);
});
test('resolveMove tracks the top combo of the run', () => {
  const E = startEndless(3);
  for (let c = 0; c < 7; c++) E.color[c] = 1;              // row 0 misses one cell
  E.tray[0] = { s: SINGLE, c: 2, g: [0] };
  resolveMove(E, 0, 0, 7);
  assert.equal(E.combo, 1); assert.equal(E.top, 1);
});
test('finishRun raises bests once and flags them', () => {
  const E = startEndless(4, 100, 5); E.score = 150; E.top = 3;
  finishRun(E);
  assert.equal(E.best, 150); assert.equal(E.bestCombo, 5); assert.equal(E.newBest, true); assert.equal(E.newCombo, false); assert.equal(E.over, true);
  E.score = 999; finishRun(E); assert.equal(E.best, 150);
});
test('a first run is never flagged as a new best but still raises the bests', () => {
  const E = startEndless(7); E.score = 50; E.top = 2;
  finishRun(E);
  assert.equal(E.newBest, false); assert.equal(E.newCombo, false); assert.equal(E.best, 50); assert.equal(E.bestCombo, 2);
});
test('validEndless accepts a fresh or finished run and rejects broken ones', () => {
  const E = startEndless(5);
  assert.ok(validEndless(JSON.parse(JSON.stringify(E))));
  assert.ok(validEndless(JSON.parse(JSON.stringify(finishRun(startEndless(6))))));
  for (const bad of [null, {}, { ...E, type: 'score' }, { ...E, color: [] }, { ...E, best: 'x' }, { ...E, chapter: 0 },
    { ...E, look: { mode: 'odd', pattern: null } }, { ...E, tray: [null, null] }, { ...E, tray: [{ s: SHAPES.length, c: 1, g: [] }, null, null] }])
    assert.equal(validEndless(bad), false);
});
