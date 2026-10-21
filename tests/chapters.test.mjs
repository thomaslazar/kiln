import test from 'node:test';
import assert from 'node:assert/strict';
import { chapterOf, difficulty, levelLook, hash, makeLevel, startState } from '../src/core.js';

test('chapter 1 is levels 1-40, later chapters 30-40 levels back to back', () => {
  assert.deepEqual(chapterOf(1), { n: 1, start: 1, length: 40 });
  assert.deepEqual(chapterOf(40), { n: 1, start: 1, length: 40 });
  assert.equal(chapterOf(41).n, 2); assert.equal(chapterOf(41).start, 41);
  let prev = chapterOf(41);
  for (let lv = 41; lv <= 2000; lv++) {
    const c = chapterOf(lv);
    assert.ok(c.length >= 30 && c.length <= 40);
    assert.equal(c.length, 30 + hash(c.n) % 11);
    assert.ok(lv >= c.start && lv < c.start + c.length);
    if (c.n !== prev.n) { assert.equal(c.n, prev.n + 1); assert.equal(c.start, prev.start + prev.length); }
    prev = c;
  }
});
test('chapter 1 difficulty is unchanged', () => {
  for (let lv = 1; lv <= 40; lv++) {
    const base = Math.min(.75, (lv - 1) / 50), saw = [0, .06, .12, .18, -.08][(lv - 1) % 5];
    assert.ok(Math.abs(difficulty(lv, 0) - Math.max(0, Math.min(1, base + saw))) < 1e-9, `level ${lv}`);
  }
});
test('later chapters dip to the level 10-15 floor and ramp to the ceiling', () => {
  const base = lv => difficulty(lv, 0) - [0, .06, .12, .18, -.08][(lv - 1) % 5];
  for (let lv = 41; lv <= 1500; lv++) {
    const c = chapterOf(lv);
    if (lv === c.start) assert.ok(base(lv) >= 9 / 50 - 1e-9 && base(lv) <= 14 / 50 + 1e-9, `start ${lv}: ${base(lv)}`);
    if (lv - c.start >= Math.ceil(c.length * .7)) assert.ok(Math.abs(base(lv) - .75) < 1e-9, `peak ${lv}`);
    if (lv > c.start) assert.ok(base(lv) >= base(lv - 1) - 1e-9, `no drop inside chapter at ${lv}`);
  }
});
test('easing from the 4th fail still works in later chapters', () => {
  assert.ok(Math.abs(difficulty(100, 4) - Math.max(0, difficulty(100, 0) - .18)) < 1e-9);
  assert.equal(difficulty(100, 3), difficulty(100, 0));
});
test('with easier retries off, fails never lower targets or difficulty, layout unchanged', () => {
  const needs = g => g.type === 'score' ? [g.need] : g.targets.map(t => t.need);   // gem colours may differ per attempt
  for (const type of ['score', 'gems', 'rush']) for (const lv of [9, 30, 75]) for (const f of [4, 6, 9]) {
    const hard = makeLevel(lv, f, 0, type, false), easy = makeLevel(lv, f, 0, type), base = makeLevel(lv, 0, 0, type);
    assert.deepEqual(needs(hard.goal), needs(base.goal), `${type} ${lv} fail ${f}: targets`);
    assert.equal(hard.d, base.d);
    assert.deepEqual(hard.color, easy.color); assert.deepEqual(hard.gem, easy.gem);   // same attempt layout
    assert.deepEqual(hard.goal.targets?.map(t => t.g), easy.goal.targets?.map(t => t.g));   // same gem colours
  }
  assert.deepEqual(startState(30, 6, 0, 'score', false).goal, makeLevel(30, 0, 0, 'score').goal);
});
test('level looks: about 70/15/15, never two special looks in a row, stable', () => {
  const n = { normal: 0, mono: 0, pattern: 0 }, kinds = new Set();
  for (let lv = 1; lv <= 4000; lv++) {
    const L = levelLook(lv); n[L.mode]++;
    if (L.mode === 'pattern') { assert.ok(['rows', 'columns', 'diagonal', 'rings'].includes(L.pattern)); kinds.add(L.pattern); }
    else assert.equal(L.pattern, null);
    if (lv > 1) assert.ok(L.mode === 'normal' || levelLook(lv - 1).mode === 'normal', `two specials at ${lv}`);
  }
  assert.equal(levelLook(1).mode, 'normal'); assert.equal(levelLook(2).mode, 'normal');
  assert.ok(n.normal / 4000 > .64 && n.normal / 4000 < .76, JSON.stringify(n));
  assert.ok(n.mono / 4000 > .11 && n.pattern / 4000 > .11, JSON.stringify(n));
  assert.equal(kinds.size, 4);
  assert.deepEqual(levelLook(321), levelLook(321));
});
