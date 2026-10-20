import test from 'node:test';
import assert from 'node:assert/strict';
import { N, SHAPES, fits, placeOcc, fullLines, occOf, anyFit, startState, rescueTray, comboContinue, levelContinue, freeContinue } from '../src/core.js';

// Most lines a tray can clear, trying every order and position.
function bestLines(o, pieces) {
  if (!pieces.length) return 0;
  let best = -1;
  pieces.forEach((p, i) => {
    const s = SHAPES[p.s], rest = pieces.filter((_, j) => j !== i);
    for (let r = 0; r <= N - s.h; r++) for (let c = 0; c <= N - s.w; c++) {
      if (!fits(o, s, r, c)) continue;
      const n = o.slice(); for (const [dr, dc] of s.cells) n[(r + dr) * N + c + dc] = 1;
      const f = fullLines(n), l = f.rows.length + f.cols.length;
      const sub = bestLines(placeOcc(o, s, r, c), rest);
      if (sub >= 0) best = Math.max(best, l + sub);
    }
  });
  return best;   // -1: the tray cannot all be placed
}
// A stuck board: rows of holes no big piece fits, no full line.
function stuck(level, type = 'score') {
  const S = startState(level, 0, 0, type);
  for (let i = 0; i < 64; i++) S.color[i] = (Math.floor(i / 8) * 3 + i % 8) % 4 ? 2 : 0;
  S.gem.fill(0); S.tray = [{ s: 0, c: 1, g: [0] }];   // placeholder
  return S;
}

test('rescue tray fits and clears at least 2 lines on stuck boards', () => {
  for (const lv of [3, 20, 60]) {
    const S = stuck(lv), o = occOf(S.color);
    assert.equal(fullLines(o).rows.length + fullLines(o).cols.length, 0);
    const t0 = Date.now(), tray = rescueTray(S), ms = Date.now() - t0;
    assert.equal(tray.length, 3);
    tray.forEach(p => assert.equal(p.g.length, SHAPES[p.s].n));
    assert.ok(bestLines(o, tray) >= 2, `level ${lv}: ${bestLines(o, tray)} lines`);
    assert.ok(ms < 200, `took ${ms} ms`);
  }
});
test('rescue tray in a gem level carries gems', () => {
  const S = stuck(40, 'gems');
  assert.ok(rescueTray(S).some(p => p.g.some(Boolean)));
});
test('rescue tray is deterministic', () => {
  assert.deepEqual(rescueTray(stuck(25)), rescueTray(stuck(25)));
});
test('a continue for every 10 in a combo streak, score levels only', () => {
  const S = startState(20, 0, 0, 'score'), m = { lines: 1 };
  for (const [combo, want] of [[9, false], [10, true], [11, false], [20, true]]) { S.combo = combo; assert.equal(comboContinue(S, m), want, `combo ${combo}`); }
  S.combo = 10; assert.equal(comboContinue(S, { lines: 0 }), false);   // combo kept alive, not raised
  const G = startState(20, 0, 0, 'gems'); G.combo = 10; assert.equal(comboContinue(G, m), false);
});
test('a continue for clearing every 5th level the first time', () => {
  assert.equal(levelContinue(5, 5), true);    // best 5: level 5 reached, not yet cleared
  assert.equal(levelContinue(5, 9), false);   // cleared before
  assert.equal(levelContinue(4, 4), false);
  assert.equal(levelContinue(10, 10), true);
});
test('one free continue per level after 2 fails', () => {
  const S = { ...startState(12, 0, 0), level: 12 };   // the UI keeps level next to the start state
  for (const [fails, freeLevel, want] of [[1, 0, false], [2, 0, true], [3, 0, true], [3, 12, false], [2, 11, true]]) {
    S.fails = fails; S.freeLevel = freeLevel; assert.equal(freeContinue(S), want, `fails ${fails} free ${freeLevel}`);
  }
});
