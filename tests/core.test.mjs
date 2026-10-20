import test from 'node:test';
import assert from 'node:assert/strict';
import { difficulty, levelType, makeLevel, startsEmpty, fullLines, occOf } from '../src/core.js';

test('fails 1 to 3 do not ease', () => {
  for (const lv of [10, 37, 60]) for (const f of [1, 2, 3])
    assert.equal(difficulty(lv, f), difficulty(lv, 0));
});
test('each fail from the 4th eases by 0.18', () => {
  assert.ok(Math.abs(difficulty(40, 4) - (difficulty(40, 0) - 0.18)) < 1e-9);
  assert.ok(Math.abs(difficulty(40, 5) - Math.max(0, difficulty(40, 0) - 0.36)) < 1e-9);
});
test('level types: early levels, no three in a row, rough mix', () => {
  assert.equal(levelType(1), 'score'); assert.equal(levelType(2), 'score');
  for (let lv = 3; lv <= 5; lv++) assert.notEqual(levelType(lv), 'rush');
  const n = { score: 0, gems: 0, rush: 0 };
  for (let lv = 3; lv <= 2000; lv++) {
    const t = levelType(lv);
    assert.ok(!(t === levelType(lv - 1) && t === levelType(lv - 2)), `three in a row at ${lv}`);
    if (lv >= 6) n[t]++;
  }
  for (const t in n) assert.ok(n[t] > 0.25 * 1995, `${t} too rare: ${n[t]}`);
  assert.equal(levelType(123), levelType(123));
});

const count = L => L.color.filter(Boolean).length;

test('block count is fixed per level, placement changes on retry', () => {
  let moved = 0, withBlocks = 0;
  for (let lv = 3; lv <= 80; lv++) {
    const base = makeLevel(lv, 0, 0), n = count(base);
    for (const [f, s] of [[1,0],[4,0],[6,0],[0,1],[0,3]]) assert.equal(count(makeLevel(lv, f, s)), n, `level ${lv}`);
    if (n) withBlocks++;
    if (n && makeLevel(lv, 1, 0).color.join() !== base.color.join()) moved++;
  }
  assert.ok(moved >= 0.9 * withBlocks);
});
test('empty starts: level 1 and roughly 30%, independent of retries', () => {
  assert.equal(count(makeLevel(1, 0, 0)), 0);
  let e = 0;
  for (let lv = 2; lv <= 401; lv++) { if (startsEmpty(lv)) { e++; assert.equal(count(makeLevel(lv, 5, 2)), 0); } }
  assert.ok(e > 80 && e < 160, `empty ${e}`);
});
test('pre-placed tiles are glaze colours and never complete a line', () => {
  for (let lv = 1; lv <= 120; lv++) {
    const L = makeLevel(lv, 0, 0);
    assert.ok(L.color.every(v => v >= 0 && v <= 5));
    const f = fullLines(occOf(L.color)); assert.equal(f.rows.length + f.cols.length, 0);
  }
});
test('score goal', () => {
  for (let lv = 3; lv <= 90; lv++) {
    const L = makeLevel(lv, 0, 0, 'score');
    assert.equal(L.goal.type, 'score'); assert.ok(L.gem.every(g => g === 0));
    assert.ok(L.goal.need >= 100 && L.goal.need <= 3000 && L.goal.need % 10 === 0);
  }
  assert.ok(makeLevel(40, 4, 0, 'score').goal.need < makeLevel(40, 0, 0, 'score').goal.need);
});
test('gem goals', () => {
  for (let lv = 3; lv <= 90; lv++) {
    const L = makeLevel(lv, 0, 0, 'gems'), t = L.goal.targets, gs = t.map(x => x.g);
    assert.ok(t.length >= 1 && t.length <= 5 && new Set(gs).size === t.length);
    assert.ok(gs.every(g => g >= 1 && g <= 5) && t.every(x => x.need >= 1));
    assert.equal(makeLevel(lv, 5, 0, 'gems').goal.targets.length, t.length);
    L.gem.forEach((g, i) => { if (g) { assert.ok(gs.includes(g)); assert.ok(L.color[i]); } });
  }
});
test('gem rush', () => {
  for (let lv = 6; lv <= 90; lv++) {
    const L = makeLevel(lv, 0, 0, 'rush'), [t] = L.goal.targets;
    assert.equal(L.goal.targets.length, 1); assert.ok(t.need >= 100 && t.need <= 500);
    L.color.forEach((v, i) => assert.equal(L.gem[i], v ? t.g : 0));
  }
});

import { deal, startState, activeGems, SHAPES } from '../src/core.js';

test('score pieces carry no gems, g matches cell count', () => {
  const S = startState(12, 0, 0, 'score');
  for (let k = 0; k < 50; k++) for (const p of deal(S)) {
    assert.equal(p.g.length, SHAPES[p.s].n); assert.ok(p.g.every(g => g === 0));
  }
});
test('rush pieces are all gems until the target is met', () => {
  const S = startState(30, 0, 0, 'rush'), g = S.goal.targets[0].g;
  for (const p of deal(S)) assert.ok(p.g.every(x => x === g));
  S.got[g] = S.goal.targets[0].need;
  assert.deepEqual(activeGems(S), []);
  for (const p of deal(S)) assert.ok(p.g.every(x => x === 0));
});
test('gem goal pieces: about a third carry 1-2 gems of active colours only', () => {
  const S = startState(60, 0, 0, 'gems'), done = S.goal.targets[0];
  S.got[done.g] = done.need;
  let pieces = 0, withGems = 0;
  for (let k = 0; k < 300; k++) for (const p of deal(S)) {
    pieces++; const n = p.g.filter(Boolean).length;
    if (n) { withGems++; assert.ok(n <= 2); }
    assert.ok(!p.g.includes(done.g));
    p.g.forEach(x => assert.ok(x === 0 || activeGems(S).includes(x)));
  }
  assert.ok(withGems / pieces > 0.2 && withGems / pieces < 0.5);
});
test('deal is deterministic', () => {
  const a = startState(44, 2, 1), b = startState(44, 2, 1);
  assert.deepEqual(a.tray, b.tray); assert.deepEqual(deal(a), deal(b));
});
